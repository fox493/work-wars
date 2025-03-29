#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// 目录和文件路径
const UPLOAD_RESULTS_FILE = path.join(__dirname, 'upload-results.json');
const METADATA_DIR = path.join(__dirname, 'output', 'metadata');

// 更新元数据函数
async function updateMetadataImages() {
  console.log('开始更新元数据文件的图片链接...');
  
  // 记录开始时间
  const startTime = performance.now();
  
  try {
    // 检查上传结果文件是否存在
    if (!fs.existsSync(UPLOAD_RESULTS_FILE)) {
      console.error(`错误: 找不到上传结果文件 ${UPLOAD_RESULTS_FILE}`);
      console.error('请先运行上传脚本生成上传结果文件');
      process.exit(1);
    }
    
    // 检查元数据目录是否存在
    if (!fs.existsSync(METADATA_DIR)) {
      console.error(`错误: 找不到元数据目录 ${METADATA_DIR}`);
      process.exit(1);
    }
    
    // 读取上传结果文件
    const uploadResults = JSON.parse(fs.readFileSync(UPLOAD_RESULTS_FILE, 'utf8'));
    
    if (!uploadResults.files || !Array.isArray(uploadResults.files)) {
      console.error('错误: 上传结果文件格式不正确，找不到files数组');
      process.exit(1);
    }
    
    console.log(`找到${uploadResults.files.length}个已上传的图片记录`);
    
    // 创建文件名到IPFS哈希的映射
    const ipfsHashMap = {};
    for (const file of uploadResults.files) {
      // 从文件名中提取编号 (例如 '500.png' -> '500')
      const fileNumber = path.basename(file.fileName, path.extname(file.fileName));
      ipfsHashMap[fileNumber] = file.ipfsHash;
    }
    
    // 获取所有元数据文件
    const metadataFiles = fs.readdirSync(METADATA_DIR)
      .filter(file => file.endsWith('.json'));
    
    console.log(`找到${metadataFiles.length}个元数据文件`);
    
    // 更新元数据文件
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const metadataFile of metadataFiles) {
      // 从文件名中提取编号 (例如 '500.json' -> '500')
      const fileNumber = path.basename(metadataFile, '.json');
      const metadataPath = path.join(METADATA_DIR, metadataFile);
      
      // 检查是否有对应的IPFS哈希
      if (!ipfsHashMap[fileNumber]) {
        console.warn(`警告: 找不到 ${fileNumber} 对应的IPFS哈希，跳过更新`);
        skippedCount++;
        continue;
      }
      
      try {
        // 读取元数据文件
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        // 更新image字段，只使用IPFS CID
        const ipfsHash = ipfsHashMap[fileNumber];
        metadata.image = `ipfs://${ipfsHash}`;
        
        // 写回文件
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        updatedCount++;
        
        // 每100个文件显示一次进度
        if (updatedCount % 100 === 0 || updatedCount === metadataFiles.length) {
          console.log(`进度: ${updatedCount}/${metadataFiles.length}`);
        }
      } catch (err) {
        console.error(`更新文件 ${metadataFile} 时出错:`, err.message);
        skippedCount++;
      }
    }
    
    // 记录结束时间
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000; // 转换为秒
    
    // 输出结果
    console.log('\n========== 更新完成 ==========');
    console.log(`成功更新: ${updatedCount}个文件`);
    console.log(`跳过: ${skippedCount}个文件`);
    console.log(`总耗时: ${duration.toFixed(2)}秒`);
    
  } catch (err) {
    console.error('更新过程中发生错误:', err.message);
    process.exit(1);
  }
}

// 执行更新
updateMetadataImages(); 