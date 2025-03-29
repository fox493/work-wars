const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ExcelJS = require('exceljs');
const config = require('./config');

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
  startTime: 0,
  lastUpdateTime: 0
};

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
  if (current < total) {
    const remainingNFTs = total - current;
    const remainingMs = remainingNFTs / speed * 1000;
    remaining = `预计剩余时间: ${formatDuration(remainingMs)}`;
  }
  
  // 构建输出字符串
  let output = `\r进度: [${bar}] ${current}/${total} (${percent}%)`;
  output += ` | 已完成: ${stats.generated} | 错误: ${stats.errors}`;
  output += ` | 运行时间: ${elapsed} | 速度: ${speed} NFT/s`;
  
  if (remaining) {
    output += ` | ${remaining}`;
  }

  // 只有在经过一定时间后才更新，避免过于频繁的刷新
  if (now - stats.lastUpdateTime > 500) {
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

function setupDirectories() {
  [outputDir, imagesDir, metadataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// 获取层的所有元素
function getLayerElements(layerConfig) {
  const directory = layerConfig.directory;
  const elements = [];

  if (!fs.existsSync(directory)) {
    console.error(`目录不存在: ${directory}`);
    return elements;
  }

  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.png') || file.endsWith('.jpg'));

  for (const file of files) {
    const name = file.replace(/\.(png|jpg)$/, '');
    const filePath = path.join(directory, file);
    elements.push({ name, path: filePath });
  }

  return elements;
}

// 基于稀有度权重选择元素
function selectElement(elements, rarityWeights) {
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
  for (const layerConfig of config.layers) {
    // 如果是非必须的层，有30%的几率不包含
    if (!layerConfig.required && Math.random() > 0.7) {
      continue;
    }

    const elements = getLayerElements(layerConfig);
    
    if (elements.length === 0) {
      console.warn(`警告: ${layerConfig.name} 层没有找到有效元素`);
      continue;
    }

    // 根据稀有度选择元素
    const selectedElement = selectElement(elements, layerConfig.rarity_weights);

    combination.attributes.push({
      trait_type: layerConfig.name,
      value: selectedElement.name
    });

    combination[layerConfig.name] = selectedElement;
    
    // 如果是Role属性，更新统计
    if (layerConfig.name === 'Role') {
      stats.roleStats[selectedElement.name] = (stats.roleStats[selectedElement.name] || 0) + 1;
    }
  }

  return combination;
}

// 使用 sharp 合成图像
async function drawImage(combination) {
  // 创建一个白色背景图像
  let composite = sharp({
    create: {
      width: config.width,
      height: config.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).png();

  // 准备合成操作
  const compositeOperations = [];

  // 按顺序逐层添加
  for (const layerConfig of config.layers) {
    const element = combination[layerConfig.name];
    if (element && fs.existsSync(element.path)) {
      // 调整每个图层图像的尺寸
      const resizedImage = await sharp(element.path)
        .resize(config.width, config.height, { fit: 'contain' })
        .toBuffer();
      
      compositeOperations.push({ input: resizedImage });
    }
  }

  // 执行合成
  if (compositeOperations.length > 0) {
    composite = composite.composite(compositeOperations);
  }

  return composite;
}

// 生成元数据
function generateMetadata(combination) {
  return {
    name: `${config.namePrefix}${combination.id}`,
    description: config.description,
    image: `${config.baseUri}${combination.id}.${config.outputFormat.imageFormat}`,
    attributes: combination.attributes
  };
}

// 保存NFT
async function saveNFT(combination) {
  try {
    // 绘制并保存图像
    const composite = await drawImage(combination);
    await composite.toFile(path.join(imagesDir, `${combination.id}.${config.outputFormat.imageFormat}`));

    // 生成并保存元数据
    const metadata = generateMetadata(combination);
    fs.writeFileSync(
      path.join(metadataDir, `${combination.id}.json`),
      JSON.stringify(metadata, null, 2)
    );

    stats.generated++;
    showProgress();
    return combination;
  } catch (err) {
    stats.errors++;
    showProgress();
    console.error(`\n保存 NFT #${combination.id} 时出错: ${err.message}`);
    return null;
  }
}

// 生成稀有度报告
async function generateRarityReport(combinations) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('稀有度分析');

  // 计算每个层的属性分布
  const layerStats = {};

  for (const combination of combinations) {
    for (const attribute of combination.attributes) {
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
  console.log(`\n稀有度报告已生成: ${config.rarityReportFilename}`);
}

// 主程序
async function main() {
  try {
    console.log('开始生成NFT...');
    stats.startTime = Date.now();
    stats.lastUpdateTime = stats.startTime;
    
    // 创建输出目录
    setupDirectories();
    
    const combinations = [];
    const totalNFTs = config.collectionSize;
    
    // 生成并保存每个NFT
    for (let i = 1; i <= totalNFTs; i++) {
      const combination = await createCombination(i);
      const saved = await saveNFT(combination);
      if (saved) {
        combinations.push(saved);
      }
    }
    
    // 完成后显示统计信息
    showProgress();
    showRarityStats();
    
    // 生成稀有度报告
    await generateRarityReport(combinations);
    
    const totalTime = formatDuration(Date.now() - stats.startTime);
    console.log(`\nNFT生成完成！总耗时: ${totalTime}`);
  } catch (err) {
    console.error('生成NFT时出错:', err);
  }
}

// 运行主程序
main(); 