// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TieredPriceNFT.sol";

contract TieredPriceNFTTest is Test {
    TieredPriceNFT public nft;
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    function setUp() public {
        vm.startPrank(owner);
        nft = new TieredPriceNFT();
        nft.setMintEnabled(true);
        vm.stopPrank();
    }

    function testPriceTier1() public {
        assertEq(nft.getMintPrice(), 0.1 ether, "Initial price should be 0.1 ether");
    }

    function testMintTier1() public {
        vm.deal(user1, 10 ether);
        vm.startPrank(user1);
        
        nft.mint{value: 0.1 ether}(1);
        
        assertEq(nft.balanceOf(user1), 1, "User should have 1 NFT");
        assertEq(nft.ownerOf(0), user1, "User should own token 0");
        
        vm.stopPrank();
    }

    function testMintMultiple() public {
        vm.deal(user1, 10 ether);
        vm.startPrank(user1);
        
        // Mint 10 NFTs in tier 1
        uint256 cost = 0.1 ether * 10;
        nft.mint{value: cost}(10);
        
        assertEq(nft.balanceOf(user1), 10, "User should have 10 NFTs");
        
        vm.stopPrank();
    }
    
    function testPriceTierChanges() public {
        // 给用户足够多的资金
        vm.deal(user1, 1000 ether);
        vm.startPrank(user1);
        
        // Mint 250 NFTs to move to tier 2
        nft.mint{value: 0.1 ether * 250}(250);
        
        // Now price should be in tier 2
        assertEq(nft.getMintPrice(), 0.14 ether, "Price should be 0.14 ether after 250 mints");
        
        // Mint 250 more to move to tier 3
        nft.mint{value: 0.14 ether * 250}(250);
        
        // Now price should be in tier 3
        assertEq(nft.getMintPrice(), 0.2 ether, "Price should be 0.2 ether after 500 mints");
        
        // Mint 250 more to move to tier 4
        nft.mint{value: 0.2 ether * 250}(250);
        
        // Now price should be in tier 4
        assertEq(nft.getMintPrice(), 0.28 ether, "Price should be 0.28 ether after 750 mints");
        
        vm.stopPrank();
    }
    
    function testCrossTierMint() public {
        vm.deal(user1, 100 ether);
        vm.startPrank(user1);
        
        // Mint 249 NFTs
        nft.mint{value: 0.1 ether * 249}(249);
        
        // Now try to mint 5 more, which will cross tiers
        // 1 in tier 1 (0.1 ether) + 4 in tier 2 (0.14 ether * 4)
        uint256 cost = 0.1 ether + (0.14 ether * 4);
        nft.mint{value: cost}(5);
        
        assertEq(nft.balanceOf(user1), 254, "User should have 254 NFTs");
        
        vm.stopPrank();
    }
    
    function testCannotMintOverMaxSupply() public {
        vm.deal(user1, 1000 ether);
        vm.startPrank(user1);
        
        // Try to mint 1001 NFTs
        vm.expectRevert("Exceeds max supply");
        nft.mint{value: 1000 ether}(1001);
        
        // Mint 1000 NFTs
        uint256 costTier1 = 0.1 ether * 250;
        uint256 costTier2 = 0.14 ether * 250;
        uint256 costTier3 = 0.2 ether * 250;
        uint256 costTier4 = 0.28 ether * 250;
        uint256 totalCost = costTier1 + costTier2 + costTier3 + costTier4;
        
        nft.mint{value: totalCost}(1000);
        
        // Try to mint 1 more
        vm.expectRevert("Exceeds max supply");
        nft.mint{value: 0.28 ether}(1);
        
        vm.stopPrank();
    }
    
    function testWithdraw() public {
        vm.deal(user1, 10 ether);
        vm.startPrank(user1);
        
        nft.mint{value: 0.1 ether}(1);
        
        vm.stopPrank();
        
        uint256 ownerBalanceBefore = owner.balance;
        
        vm.prank(owner);
        nft.withdraw();
        
        uint256 ownerBalanceAfter = owner.balance;
        
        assertEq(ownerBalanceAfter - ownerBalanceBefore, 0.1 ether, "Owner should receive 0.1 ether");
    }
} 