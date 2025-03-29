const fs = require('fs-extra');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ExcelJS = require('exceljs');
const os = require('os');
const config = require('./config');
const sharp = require('sharp');

// 主线程代码
if (isMainThread) {
  // 创建输出目录
  const outputDir = path.join(process.cwd(), 'output');
  const imagesDir = path.join(outputDir, 'images');
  const metadataDir = path.join(outputDir, 'metadata');

  // 存储生成统计
  const stats = {
    generated: 0,
    errors: 0,
    roleStats: {
      'employer': 0,
      'boss-1-star': 0,
      'boss-2-star': 0,
      'boss-3-star': 0,
      'boss-4-star': 0
    },
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    activeWorkers: 0
  };

  // 确保目录存在
  function setupDirectories() {
    console.log('创建输出目录...');
    [outputDir, imagesDir, metadataDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // 格式化时间
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  // 显示进度条
  function showProgress() {
    const total = config.collectionSize;
    const current = stats.generated + stats.errors;
    const percent = (current / total * 100).toFixed(2);
    
    // 计算进度条
    const barLength = 30;
    const completedLength = Math.floor(barLength * current / total);
    const bar = '■'.repeat(completedLength) + '□'.repeat(barLength - completedLength);
    
    // 计算时间和速度
    const now = Date.now();
    const elapsedMs = now - stats.startTime;
    const elapsed = formatDuration(elapsedMs);
    const speed = (current / (elapsedMs / 1000)).toFixed(2);

    // 如果还有NFT要生成，估计剩余时间
    let remaining = '';
    if (current < total && current > 0) {
      const remainingNFTs = total - current;
      const remainingMs = remainingNFTs / speed * 1000;
      remaining = `预计剩余时间: ${formatDuration(remainingMs)}`;
    }
    
    // 显示活动线程数
    const workersInfo = `活动线程: ${stats.activeWorkers}`;
    
    // 构建输出字符串
    let output = `\r进度: [${bar}] ${current}/${total} (${percent}%)`;
    output += ` | 已完成: ${stats.generated} | 错误: ${stats.errors}`;
    output += ` | ${workersInfo} | 运行时间: ${elapsed} | 速度: ${speed} NFT/s`;
    
    if (remaining) {
      output += ` | ${remaining}`;
    }

    // 只有在经过一定时间后才更新，避免过于频繁的刷新
    if (now - stats.lastUpdateTime > 300) {
      process.stdout.write(output);
      stats.lastUpdateTime = now;
    }
  }

  // 显示稀有度分布统计
  function showRarityStats() {
    console.log('\n\n角色稀有度统计:');
    console.log('---------------------------');
    const total = Object.values(stats.roleStats).reduce((a, b) => a + b, 0);
    
    if (total === 0) return;
    
    // 获取预期稀有度
    const expectedRarities = {
      'employer': 90,
      'boss-1-star': 6,
      'boss-2-star': 2.5,
      'boss-3-star': 1,
      'boss-4-star': 0.5
    };
    
    // 显示实际分布与预期分布
    console.log('角色名称\t\t数量\t实际比例\t预期比例');
    console.log('---------------------------');
    
    for (const role in stats.roleStats) {
      const count = stats.roleStats[role];
      const actualPercent = (count / total * 100).toFixed(2);
      const expectedPercent = expectedRarities[role].toFixed(2);
      
      // 添加差异标记
      const diff = Math.abs(parseFloat(actualPercent) - parseFloat(expectedPercent));
      let diffMarker = '';
      if (diff > 1) {
        diffMarker = diff > 3 ? ' (!!)' : ' (!)';
      }
      
      console.log(`${role}\t\t${count}\t${actualPercent}%\t${expectedPercent}%${diffMarker}`);
    }
  }

  // 生成稀有度报告
  async function generateRarityReport() {
    console.log('\n生成稀有度报告...');
    
    // 扫描所有生成的元数据文件
    const metadataFiles = fs.readdirSync(metadataDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(metadataDir, file));

    console.log(`找到 ${metadataFiles.length} 个元数据文件`);
    
    // 从元数据中收集特征信息
    const layerStats = {};
    const combinations = [];
    
    for (const file of metadataFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        combinations.push(data);
        
        if (data.attributes && Array.isArray(data.attributes)) {
          for (const attribute of data.attributes) {
            const { trait_type, value } = attribute;
            
            if (!layerStats[trait_type]) {
              layerStats[trait_type] = {};
            }
            
            if (!layerStats[trait_type][value]) {
              layerStats[trait_type][value] = 0;
            }
            
            layerStats[trait_type][value]++;
          }
        }
      } catch (err) {
        console.error(`解析元数据文件 ${file} 时出错:`, err.message);
      }
    }
    
    // 如果没有有效的元数据，退出
    if (combinations.length === 0) {
      console.error('没有找到有效的元数据文件');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('稀有度分析');

    // 格式化并写入Excel
    worksheet.columns = [
      { header: '特征类型', key: 'trait_type', width: 20 },
      { header: '特征值', key: 'value', width: 20 },
      { header: '数量', key: 'count', width: 10 },
      { header: '百分比', key: 'percentage', width: 15 }
    ];

    for (const trait_type in layerStats) {
      for (const value in layerStats[trait_type]) {
        const count = layerStats[trait_type][value];
        const percentage = (count / combinations.length * 100).toFixed(2) + '%';
        
        worksheet.addRow({
          trait_type,
          value,
          count,
          percentage
        });
      }
      
      // 添加一个空行分隔不同的特征类型
      worksheet.addRow({});
    }

    // 添加Role特征的专门统计
    worksheet.addRow({ trait_type: '===== Role特征稀有度 =====' });
    worksheet.addRow({});
    
    const roleStats = layerStats['Role'] || {};
    const expectedRarities = {
      'employer': 90,
      'boss-1-star': 6,
      'boss-2-star': 2.5,
      'boss-3-star': 1,
      'boss-4-star': 0.5
    };
    
    worksheet.addRow({ trait_type: 'Role', value: '特征值', count: '预期比例', percentage: '实际比例' });
    
    for (const role in expectedRarities) {
      const expectedPercentage = expectedRarities[role] + '%';
      const actualCount = roleStats[role] || 0;
      const actualPercentage = (actualCount / combinations.length * 100).toFixed(2) + '%';
      
      worksheet.addRow({
        trait_type: 'Role',
        value: role,
        count: expectedPercentage,
        percentage: actualPercentage
      });
    }

    // 保存Excel文件
    await workbook.xlsx.writeFile(path.join(outputDir, config.rarityReportFilename));
    console.log(`稀有度报告已生成: ${config.rarityReportFilename}`);
  }

  // 主函数
  async function main() {
    console.log('开始生成NFT...');
    setupDirectories();
    
    // 确定线程数量 - 使用CPU核心数，但最多8个线程
    const cpuCount = os.cpus().length;
    // 减少线程数，以避免可能的资源竞争问题
    const numWorkers = Math.min(cpuCount - 1, 4);
    console.log(`将使用 ${numWorkers} 个线程并行生成...`);
    
    // 计算每个线程处理的NFT数量
    const totalNFTs = config.collectionSize;
    const nftsPerWorker = Math.ceil(totalNFTs / numWorkers);
    
    let completedWorkers = 0;
    const workers = [];
    
    // 创建进度更新定时器
    const progressTimer = setInterval(showProgress, 100);
    
    return new Promise((resolve) => {
      // 为每个线程分配任务
      for (let i = 0; i < numWorkers; i++) {
        const startId = i * nftsPerWorker + 1;
        const endId = Math.min(startId + nftsPerWorker - 1, totalNFTs);
        
        console.log(`启动线程 ${i+1}/${numWorkers}，处理 NFT #${startId} 到 #${endId}...`);
        
        // 简化传递给工作线程的数据
        const threadData = {
          startId,
          endId,
          width: config.width,
          height: config.height,
          namePrefix: config.namePrefix,
          description: config.description,
          baseUri: config.baseUri,
          outputFormat: config.outputFormat,
          layers: config.layers,
          outputDir: outputDir,
          imagesDir: imagesDir,
          metadataDir: metadataDir
        };
        
        const worker = new Worker(__filename, { workerData: threadData });
        workers.push(worker);
        stats.activeWorkers++;
        
        // 处理线程消息
        worker.on('message', (message) => {
          try {
            if (message.type === 'progress') {
              // 更新统计
              stats.generated += message.generated || 0;
              stats.errors += message.errors || 0;
              
              // 更新角色统计
              if (message.roleStats) {
                for (const role in message.roleStats) {
                  stats.roleStats[role] = (stats.roleStats[role] || 0) + message.roleStats[role];
                }
              }
              
              // 显示进度更新
              showProgress();
            } else if (message.type === 'debug') {
              console.log(`[线程${startId}-${endId}] ${message.message}`);
            }
          } catch (err) {
            console.error('处理线程消息时出错:', err);
          }
        });
        
        // 线程完成
        worker.on('exit', (code) => {
          console.log(`线程 ${startId}-${endId} 完成，退出码: ${code}`);
          stats.activeWorkers--;
          completedWorkers++;
          
          // 所有线程都完成了
          if (completedWorkers === numWorkers) {
            clearInterval(progressTimer);
            showProgress();
            showRarityStats();
            
            // 生成最终报告
            generateRarityReport().then(() => {
              const totalTime = formatDuration(Date.now() - stats.startTime);
              console.log(`\nNFT生成完成！总耗时: ${totalTime}`);
              resolve();
            });
          }
        });
        
        // 线程错误处理
        worker.on('error', (err) => {
          console.error(`线程 ${startId}-${endId} 错误:`, err);
          worker.terminate();
        });
      }
    });
  }
  
  // 运行主程序
  main().catch(err => {
    console.error('生成NFT时出错:', err);
  });
}
// 工作线程代码
else {
  // 获取线程数据
  const { 
    startId, 
    endId, 
    width, 
    height, 
    namePrefix, 
    description, 
    baseUri, 
    outputFormat, 
    layers,
    outputDir, 
    imagesDir, 
    metadataDir 
  } = workerData;
  
  // 打印调试信息
  function debug(message) {
    parentPort.postMessage({ type: 'debug', message });
  }
  
  // 线程内统计
  const threadStats = {
    generated: 0,
    errors: 0,
    roleStats: {
      'employer': 0,
      'boss-1-star': 0,
      'boss-2-star': 0,
      'boss-3-star': 0,
      'boss-4-star': 0
    }
  };
  
  // 获取层的所有元素
  function getLayerElements(layerConfig) {
    const directory = layerConfig.directory;
    const elements = [];

    if (!fs.existsSync(directory)) {
      debug(`目录不存在: ${directory}`);
      return elements;
    }

    const files = fs.readdirSync(directory)
      .filter(file => (file.endsWith('.png') || file.endsWith('.jpg')) && file !== 'hand.png');

    for (const file of files) {
      const name = file.replace(/\.(png|jpg)$/, '');
      const filePath = path.join(directory, file);
      elements.push({ name, path: filePath });
    }

    return elements;
  }

  // 确定性分配计算
  function calculateExactDistribution(totalCount, layerConfig) {
    const distribution = {};
    
    // 如果是Role属性层，使用预定义的稀有度百分比
    if (layerConfig.name === 'Role') {
      // 预期稀有度百分比
      const expectedRarities = {
        'employer': 90,
        'boss-1-star': 6,
        'boss-2-star': 2.5,
        'boss-3-star': 1,
        'boss-4-star': 0.5
      };
      
      // 计算每个元素应该出现的确切数量
      let remaining = totalCount;
      const elements = Object.keys(expectedRarities);
      
      // 先按比例分配整数部分
      for (let i = 0; i < elements.length - 1; i++) {
        const element = elements[i];
        const count = Math.floor(totalCount * expectedRarities[element] / 100);
        distribution[element] = count;
        remaining -= count;
      }
      
      // 将剩余的分配给最后一个元素
      distribution[elements[elements.length - 1]] = remaining;
      
      return distribution;
    } else if (layerConfig.rarity_weights) {
      // 对于其他有稀有度权重的层，也使用确定性分配
      const elements = Object.keys(layerConfig.rarity_weights);
      const totalWeight = elements.reduce((sum, element) => sum + layerConfig.rarity_weights[element], 0);
      
      let remaining = totalCount;
      
      // 先按比例分配整数部分
      for (let i = 0; i < elements.length - 1; i++) {
        const element = elements[i];
        const weight = layerConfig.rarity_weights[element];
        const count = Math.floor(totalCount * weight / totalWeight);
        distribution[element] = count;
        remaining -= count;
      }
      
      // 将剩余的分配给最后一个元素
      distribution[elements[elements.length - 1]] = remaining;
      
      return distribution;
    }
    
    return null; // 对于没有稀有度设置的层，返回null表示使用随机选择
  }

  // 存储每个线程的确定性分配数量
  const threadDistributions = {};

  // 初始化确定性分配
  function initializeDistributions() {
    const totalNFTs = endId - startId + 1;
    
    for (const layerConfig of layers) {
      if (layerConfig.name === 'Role' || layerConfig.rarity_weights) {
        const distribution = calculateExactDistribution(totalNFTs, layerConfig);
        if (distribution) {
          threadDistributions[layerConfig.name] = {
            distribution: { ...distribution },  // 目标分配
            remaining: { ...distribution },     // 剩余要分配的数量
            elements: getLayerElements(layerConfig)  // 该层的所有可用元素
          };
        }
      }
    }
    
    debug(`初始化确定性分配: ${JSON.stringify(threadDistributions)}`);
  }

  // 基于确定性分配选择元素
  function selectElement(elements, rarityWeights, layerName) {
    // 如果该层有确定性分配计划
    if (threadDistributions[layerName]) {
      const distribution = threadDistributions[layerName];
      const remainingElements = [];
      
      // 找出还有剩余分配数量的元素
      for (const element of distribution.elements) {
        if (distribution.remaining[element.name] > 0) {
          remainingElements.push(element);
        }
      }
      
      // 如果还有元素可以分配
      if (remainingElements.length > 0) {
        // 随机选择一个有剩余配额的元素
        const selectedIndex = Math.floor(Math.random() * remainingElements.length);
        const selectedElement = remainingElements[selectedIndex];
        
        // 减少该元素的剩余分配数量
        distribution.remaining[selectedElement.name]--;
        
        return selectedElement;
      }
      
      // 如果没有剩余分配，使用后备的随机选择
      debug(`警告: 层 ${layerName} 的确定性分配已用完，使用随机选择`);
    }
    
    // 后备的随机选择方法（原来的实现）
    if (!rarityWeights) {
      // 如果没有指定稀有度，则平均随机选择
      return elements[Math.floor(Math.random() * elements.length)];
    }

    // 基于稀有度权重选择
    const weights = [];
    for (const element of elements) {
      const weight = rarityWeights[element.name] || 0;
      weights.push(weight);
    }

    // 计算总权重
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    // 生成随机数
    let random = Math.random() * totalWeight;
    
    // 选择元素
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return elements[i];
      }
    }
    
    // 如果因为舍入误差没有选择元素，返回最后一个
    return elements[elements.length - 1];
  }

  // 创建NFT的组合
  async function createCombination(nftIndex) {
    const combination = {
      id: nftIndex,
      attributes: []
    };

    // 加载层配置
    for (const layerConfig of layers) {
      // 如果是非必须的层，有30%的几率不包含
      if (!layerConfig.required && Math.random() > 0.7) {
        continue;
      }

      const elements = getLayerElements(layerConfig);
      
      if (elements.length === 0) {
        continue;
      }

      // 根据稀有度选择元素，传入层名称以支持确定性分配
      const selectedElement = selectElement(elements, layerConfig.rarity_weights, layerConfig.name);

      combination.attributes.push({
        trait_type: layerConfig.name,
        value: selectedElement.name
      });

      combination[layerConfig.name] = selectedElement;
      
      // 如果是Role属性，更新统计
      if (layerConfig.name === 'Role') {
        threadStats.roleStats[selectedElement.name] = (threadStats.roleStats[selectedElement.name] || 0) + 1;
      }
    }

    return combination;
  }

  // 使用 sharp 合成图像
  async function drawImage(combination) {
    try {
      // 创建一个白色背景图像
      let composite = sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      }).png();

      // 准备合成操作
      const compositeOperations = [];

      // 按顺序逐层添加
      for (const layerConfig of layers) {
        const element = combination[layerConfig.name];
        if (element && fs.existsSync(element.path)) {
          // 调整每个图层图像的尺寸
          const resizedImage = await sharp(element.path)
            .resize(width, height, { fit: 'contain' })
            .toBuffer();
          
          compositeOperations.push({ input: resizedImage });
        }
      }

      // 检查是否有hand.png，并添加到最上层
      const handLayer = path.join(process.cwd(), 'layers', 'Role', 'hand.png');
      if (fs.existsSync(handLayer)) {
        const handImage = await sharp(handLayer)
          .resize(width, height, { fit: 'contain' })
          .toBuffer();
        
        // 确保hand图层在最上方
        compositeOperations.push({ input: handImage });
      }

      // 执行合成
      if (compositeOperations.length > 0) {
        composite = composite.composite(compositeOperations);
      }

      return composite;
    } catch (err) {
      debug(`图像合成错误 #${combination.id}: ${err.message}`);
      throw err;
    }
  }

  // 生成元数据
  function generateMetadata(combination) {
    return {
      name: `${namePrefix}${combination.id}`,
      description: description,
      image: `${baseUri}${combination.id}.${outputFormat.imageFormat}`,
      attributes: combination.attributes
    };
  }

  // 保存NFT
  async function saveNFT(combination) {
    try {
      // 绘制并保存图像
      const composite = await drawImage(combination);
      await composite.toFile(path.join(imagesDir, `${combination.id}.${outputFormat.imageFormat}`));

      // 生成并保存元数据
      const metadata = generateMetadata(combination);
      fs.writeFileSync(
        path.join(metadataDir, `${combination.id}.json`),
        JSON.stringify(metadata, null, 2)
      );

      threadStats.generated++;
      return true;
    } catch (err) {
      threadStats.errors++;
      debug(`保存 NFT #${combination.id} 时出错: ${err.message}`);
      return false;
    }
  }

  // 线程主函数
  async function threadMain() {
    debug(`开始处理 NFT #${startId} 到 #${endId}`);
    
    // 初始化确定性分配
    initializeDistributions();
    
    // 发送初始进度更新
    sendProgressUpdate();
    
    // 生成并保存分配给该线程的NFT
    for (let i = startId; i <= endId; i++) {
      if (i % 10 === 0) {
        debug(`正在生成 NFT #${i}...`);
      }
      
      const combination = await createCombination(i);
      await saveNFT(combination);
      
      // 每5个NFT发送一次进度更新
      if ((i - startId + 1) % 5 === 0 || i === endId) {
        sendProgressUpdate();
      }
    }
    
    // 最后一次确保发送所有统计信息
    sendProgressUpdate();
    debug(`完成所有 NFT 生成，共处理 ${threadStats.generated + threadStats.errors} 个NFT，成功 ${threadStats.generated}，失败 ${threadStats.errors}`);
  }
  
  // 发送进度更新给主线程
  function sendProgressUpdate() {
    parentPort.postMessage({
      type: 'progress',
      generated: threadStats.generated,
      errors: threadStats.errors,
      roleStats: { ...threadStats.roleStats }
    });
    
    // 重置计数器以避免重复计算
    threadStats.generated = 0;
    threadStats.errors = 0;
    threadStats.roleStats = {
      'employer': 0,
      'boss-1-star': 0,
      'boss-2-star': 0,
      'boss-3-star': 0,
      'boss-4-star': 0
    };
  }
  
  // 运行线程主函数
  threadMain().catch(err => {
    debug(`线程主函数出错: ${err.message}`);
    console.error(`线程${startId}-${endId}出错:`, err);
  }).finally(() => {
    debug('线程工作完成');
  });
} 