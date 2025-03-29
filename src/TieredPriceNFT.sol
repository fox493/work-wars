// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/ERC721A/contracts/ERC721A.sol";
import "lib/ERC721A/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TieredPriceNFT is ERC721A, ERC721AQueryable, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // 最大供应量
    uint256 public constant MAX_SUPPLY = 1000;
    
    // 定价阶段和对应价格（以wei为单位）
    uint256 public constant TIER1_PRICE = 0.00001 ether;  // 前25%: 0.1 BNB
    uint256 public constant TIER2_PRICE = 0.000014 ether; // 26%-50%: 0.14 BNB
    uint256 public constant TIER3_PRICE = 0.00002 ether;  // 51%-75%: 0.20 BNB
    uint256 public constant TIER4_PRICE = 0.000028 ether; // 76%-100%: 0.28 BNB
    
    // 基础URI
    string private _baseTokenURI;
    
    // 是否可以铸造
    bool public mintEnabled = false;
    
    // 构造函数
    constructor() ERC721A("WorkWarsGen0", "WWGEN0") Ownable(msg.sender) {}
    
    // 重写_startTokenId函数，使tokenId从1开始
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }
    
    // 根据当前铸造进度计算价格
    function getMintPrice() public view returns (uint256) {
        uint256 totalMinted = _totalMinted();
        
        if (totalMinted < 250) {
            return TIER1_PRICE;
        } else if (totalMinted < 500) {
            return TIER2_PRICE;
        } else if (totalMinted < 750) {
            return TIER3_PRICE;
        } else {
            return TIER4_PRICE;
        }
    }
    
    // 铸造函数
    function mint(uint256 quantity) external payable nonReentrant {
        require(mintEnabled, "Minting is not enabled");
        require(_totalMinted() + quantity <= MAX_SUPPLY, "Exceeds max supply");
        
        uint256 totalCost = 0;
        uint256 currentMinted = _totalMinted();
        
        // 计算不同价格区间的总成本
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = currentMinted + i;
            
            if (tokenId < 250) {
                totalCost += TIER1_PRICE;
            } else if (tokenId < 500) {
                totalCost += TIER2_PRICE;
            } else if (tokenId < 750) {
                totalCost += TIER3_PRICE;
            } else {
                totalCost += TIER4_PRICE;
            }
        }
        
        require(msg.value >= totalCost, "Insufficient payment");
        
        _mint(msg.sender, quantity);
        
        // 退还多余的付款
        if (msg.value > totalCost) {
            (bool success, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }
    }
    
    // 设置铸造开关
    function setMintEnabled(bool enabled) external onlyOwner {
        mintEnabled = enabled;
    }
    
    // 设置基础URI
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    // 获取URI
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    // 提取合约余额
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Withdrawal failed");
    }
} 