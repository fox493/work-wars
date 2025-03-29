## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

# 上传元数据到IPFS

这个项目包含了用于上传NFT元数据文件到IPFS的脚本。

## 安装

```bash
pnpm install
```

## 使用说明

### 上传元数据文件到IPFS (Pinata)

此脚本将`output/metadata`目录中的JSON文件上传到IPFS (通过Pinata)，使其可以通过`ipfs/编号`的方式访问。

```bash
pnpm upload-metadata
```

上传前需要在`.env`文件中设置Pinata JWT令牌：

```
PINATA_JWT=your_jwt_token
```

您可以在Pinata控制台获取JWT令牌: https://app.pinata.cloud/developers/api-keys

如果需要强制重新上传，可以使用：

```bash
pnpm upload-metadata:force
```

上传完成后，将生成`upload-results.json`文件，包含所有上传文件的信息。

### 更新元数据中的图片链接

上传完成后，您可以使用以下命令更新元数据文件中的图片链接:

```bash
pnpm update-metadata
```

这将使用`upload-results.json`中的信息更新`output/metadata`目录中的元数据文件。

## 文件结构

- `upload-metadata.js`: 上传元数据文件到IPFS的脚本 (使用Pinata新版SDK)
- `update-metadata-images.js`: 更新元数据文件中图片链接的脚本
- `upload-results.json`: 上传结果文件，包含IPFS哈希信息
