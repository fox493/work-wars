const fs = require('fs');
const path = require('path');

// 定义元数据目录
const metadataDir = path.join(__dirname, 'output', 'metadata');

// 读取目录中的所有文件
fs.readdir(metadataDir, (err, files) => {
  if (err) {
    console.error('读取目录时出错:', err);
    return;
  }

  // 筛选出.json文件
  const jsonFiles = files.filter(file => file.endsWith(''));
  
  // 计数器
  let processedCount = 0;
  const totalFiles = jsonFiles.length;
  
  console.log(`开始处理 ${totalFiles} 个文件...`);
  
  // 处理每个文件
  jsonFiles.forEach(file => {
    const oldPath = path.join(metadataDir, file);
    
    // 提取文件名中的数字部分
    const numberPart = parseInt(file.replace('.json', ''), 10);
    
    // 检查是否为有效数字
    if (isNaN(numberPart)) {
      console.error(`无法从文件名 ${file} 提取有效数字`);
      return;
    }
    
    // 计算新的文件名（数字减1并去掉.json后缀）
    const newNumberPart = numberPart - 1;
    const newPath = path.join(metadataDir, newNumberPart.toString());
    
    // 重命名文件
    fs.rename(oldPath, newPath, err => {
      if (err) {
        console.error(`重命名 ${file} 时出错:`, err);
      } else {
        processedCount++;
        
        // 每处理10个文件输出一次进度
        if (processedCount % 10 === 0 || processedCount === totalFiles) {
          console.log(`进度: ${processedCount}/${totalFiles}`);
        }
        
        // 所有文件处理完成后输出结果
        if (processedCount === totalFiles) {
          console.log('所有文件处理完成！');
          console.log('文件已从1-1000重命名为0-999，并移除了.json后缀');
        }
      }
    });
  });
}); 