#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pinataSDK = require('@pinata/sdk');
const dotenv = require('dotenv');
const { performance } = require('perf_hooks');

// 加载环境变量
dotenv.config();

// 检查环境变量
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

if (!PINATA_API_KEY || !PINATA_API_SECRET) {
  console.error('错误: 请在.env文件中设置PINATA_API_KEY和PINATA_API_SECRET');
  process.exit(1);
}

// 创建Pinata客户端
const pinata = new pinataSDK(PINATA_API_KEY, PINATA_API_SECRET);

// 图片目录路径
const IMAGES_DIR = path.join(__dirname, 'output', 'images');
const UPLOAD_RESULTS_FILE = path.join(__dirname, 'upload-results.json');

// 默认并发数
const DEFAULT_CONCURRENCY = 5;

// 获取命令行参数中的并发数和组ID
const args = process.argv.slice(2);
const concurrencyArg = args.find(arg => arg.startsWith('--concurrency='));
const groupIdArg = args.find(arg => arg.startsWith('--groupId='));
const forceArg = args.find(arg => arg === '--force');

const concurrency = concurrencyArg 
  ? parseInt(concurrencyArg.split('=')[1], 10) 
  : DEFAULT_CONCURRENCY;
const forceReupload = !!forceArg;

// 上传图片函数
async function uploadImages() {
  try {
    // 测试Pinata连接
    await pinata.testAuthentication();
    console.log('✅ Pinata认证成功');

    // 获取目录下所有图片
    const files = fs.readdirSync(IMAGES_DIR)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif'].includes(ext);
      });
    
    if (files.length === 0) {
      console.error('没有找到图片文件');
      process.exit(1);
    }
    
    console.log(`找到${files.length}个图片文件，准备上传...`);
    console.log(`并发数: ${concurrency}`);
    
    // 检查是否存在之前的上传结果
    let previousResults = { files: [] };
    let groupId;
    
    if (groupIdArg) {
      // 使用命令行参数中指定的groupId
      groupId = groupIdArg.split('=')[1];
      console.log(`使用命令行指定的group: ${groupId}`);
    } else if (fs.existsSync(UPLOAD_RESULTS_FILE) && !forceReupload) {
      try {
        previousResults = JSON.parse(fs.readFileSync(UPLOAD_RESULTS_FILE, 'utf8'));
        groupId = previousResults.groupId;
        console.log(`发现先前的上传记录，将继续使用group: ${groupId}`);
        console.log(`之前已上传: ${previousResults.files.length}/${files.length} 文件`);
      } catch (err) {
        console.warn('无法解析之前的上传结果，将创建新的上传组');
        groupId = `upload-group-${Date.now()}`;
      }
    } else {
      // 创建一个新的唯一group名称
      groupId = `upload-group-${Date.now()}`;
      console.log(`创建新的上传group: ${groupId}`);
    }
    
    // 确定需要上传的文件
    const uploadedFileNames = new Set(previousResults.files.map(f => f.fileName));
    const filesToUpload = forceReupload 
      ? files 
      : files.filter(file => !uploadedFileNames.has(file));
    
    if (filesToUpload.length === 0) {
      console.log('所有文件已上传完成，无需再次上传');
      process.exit(0);
    }
    
    console.log(`待上传: ${filesToUpload.length}个文件`);
    
    // 记录开始时间
    const startTime = performance.now();
    
    // 上传结果
    const results = [...previousResults.files];
    let uploadedCount = 0;
    let failedCount = 0;
    
    // 使用并发控制的并行上传
    await processBatch(filesToUpload, concurrency, async (file) => {
      const filePath = path.join(IMAGES_DIR, file);
      const readStream = fs.createReadStream(filePath);
      
      const options = {
        pinataMetadata: {
          name: file,
          keyvalues: {
            group: groupId
          }
        },
        pinataOptions: {
          cidVersion: 1
        }
      };
      
      try {
        const result = await pinata.pinFileToIPFS(readStream, options);
        results.push({
          fileName: file,
          ipfsHash: result.IpfsHash,
          pinSize: result.PinSize,
          timestamp: result.Timestamp
        });
        
        uploadedCount++;
        console.log(`上传进度: ${uploadedCount + failedCount}/${filesToUpload.length} - ${file} -> ${result.IpfsHash}`);
        
        // 每上传10个文件或者上传完成时，保存中间结果
        if (uploadedCount % 10 === 0 || uploadedCount + failedCount === filesToUpload.length) {
          saveResults(results, groupId, files.length, startTime);
        }
        
        return true;
      } catch (err) {
        failedCount++;
        console.error(`上传文件 ${file} 失败:`, err.message);
        return false;
      }
    });
    
    // 记录结束时间和保存最终结果
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000; // 转换为秒
    
    // 输出结果
    console.log('\n========== 上传完成 ==========');
    console.log(`成功上传: ${results.length}/${files.length} 文件`);
    console.log(`本次上传: ${uploadedCount}个文件，失败: ${failedCount}个文件`);
    console.log(`总耗时: ${duration.toFixed(2)} 秒`);
    console.log(`平均每个文件耗时: ${(duration / uploadedCount).toFixed(2)} 秒`);
    console.log(`并发数: ${concurrency}`);
    console.log(`所有文件已上传至group: ${groupId}`);
    console.log(`如果还有未上传成功的文件，可以运行以下命令继续上传：`);
    console.log(`pnpm run upload -- --groupId=${groupId}`);
    
    // 保存最终结果
    saveResults(results, groupId, files.length, startTime, endTime);
    
  } catch (err) {
    console.error('上传过程中发生错误:', err.message);
    process.exit(1);
  }
}

/**
 * 保存上传结果到JSON文件
 */
function saveResults(results, groupId, totalFiles, startTime, endTime = null) {
  const currentTime = endTime || performance.now();
  const duration = (currentTime - startTime) / 1000;
  
  const resultsFilePath = path.join(__dirname, 'upload-results.json');
  fs.writeFileSync(resultsFilePath, JSON.stringify({
    groupId,
    totalFiles,
    successfulUploads: results.length,
    duration: duration.toFixed(2),
    averageTime: results.length > 0 ? (duration / results.length).toFixed(2) : "0.00",
    concurrency: concurrency,
    uploadTimestamp: new Date().toISOString(),
    isComplete: results.length === totalFiles,
    files: results
  }, null, 2));
}

/**
 * 并发处理函数
 * @param {Array} items - 要处理的项目数组
 * @param {number} concurrency - 并发数
 * @param {Function} fn - 处理每个项目的异步函数
 * @returns {Promise<Array>} - 处理结果数组
 */
async function processBatch(items, concurrency, fn) {
  // 复制一份数组，以便不修改原数组
  const queue = [...items];
  const results = [];
  
  // 创建并发worker
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      const result = await fn(item);
      results.push(result);
    }
  }
  
  // 创建多个worker并并行运行
  const workers = Array(Math.min(concurrency, items.length))
    .fill()
    .map(() => worker());
  
  // 等待所有worker完成
  await Promise.all(workers);
  
  return results;
}

// 执行上传
uploadImages(); 