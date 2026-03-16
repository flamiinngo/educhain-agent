const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Wallet:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Check if contracts exist
  const eduCode = await hre.ethers.provider.getCode("0x8e42ff12993117e19cCad52096c71fCca79a32ab");
  const nftCode = await hre.ethers.provider.getCode("0x14c5a01cE4FeF52fDc2C3B1c3761274ce37336DB");
  
  console.log("\nEduChain contract exists:", eduCode !== "0x");
  console.log("ImpactNFT contract exists:", nftCode !== "0x");
}

main().catch(console.error);