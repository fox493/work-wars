// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TieredPriceNFT.sol";

contract DeployTieredPriceNFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        TieredPriceNFT nft = new TieredPriceNFT();
        
        vm.stopBroadcast();
        
        console.log("TieredPriceNFT deployed at:", address(nft));
    }
} 