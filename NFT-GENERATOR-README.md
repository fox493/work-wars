# Work Wars NFT 生成器

这个工具用于生成 Work Wars NFT 系列的图像和元数据，并生成稀有度分析报告。

## 特点

- 基于 layers 文件夹中的分层素材随机生成 NFT
- 支持基于稀有度权重的特征分配
- 生成 NFT 图像和符合标准的元数据
- 生成详细的稀有度分析 Excel 报表

## 稀有度设置

当前的 Role 特征稀有度设置为：
- employer: 90%
- boss-1-star: 6%
- boss-2-star: 2.5%
- boss-3-star: 1%
- boss-4-star: 0.5%

## 安装

```bash
# 安装依赖
pnpm install
```

## 使用方法

1. 确保所有分层素材都放在 `layers` 目录下的对应文件夹中
2. 根据需要调整 `config.js` 文件中的配置
3. 运行生成脚本

```bash
# 运行 NFT 生成器
pnpm run generate
```

## 输出

生成的文件将保存在 `output` 目录中：
- `output/images/` - 包含所有生成的 NFT 图像
- `output/metadata/` - 包含所有生成的 NFT 元数据 JSON 文件
- `output/rarity-report.xlsx` - 包含所有特征的稀有度分析

## 配置说明

在 `config.js` 文件中可以修改以下配置：

- `layers` - 图层配置，包括层名称、目录路径、是否必需以及稀有度权重
- `width` 和 `height` - 输出图像的尺寸
- `description` - NFT 系列描述
- `baseUri` - 元数据中图像 URI 的基础路径（通常为 IPFS CID）
- `collectionSize` - 要生成的 NFT 数量
- `rarityReportFilename` - 稀有度报告文件名 