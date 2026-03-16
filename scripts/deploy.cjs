const hre = require("hardhat");

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  DEPLOYING EDUCHAIN TO BASE SEPOLIA");
  console.log("═══════════════════════════════════════");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  // ────────────────────────────────────────────
  // Deploy Mock cUSD token
  // ────────────────────────────────────────────
  console.log("\n[1/4] Deploying Mock cUSD token...");

  const MockToken = await hre.ethers.getContractFactory("MockCUSD");
  const mockCUSD = await MockToken.deploy();
  await mockCUSD.waitForDeployment();
  const cUSDAddress = await mockCUSD.getAddress();
  console.log("  Mock cUSD deployed at:", cUSDAddress);

  // ────────────────────────────────────────────
  // Deploy EduChain contract
  // ────────────────────────────────────────────
  console.log("\n[2/4] Deploying EduChain contract...");

  const EduChain = await hre.ethers.getContractFactory("EduChain");
  const eduChain = await EduChain.deploy(cUSDAddress);
  await eduChain.waitForDeployment();
  const eduChainAddress = await eduChain.getAddress();
  console.log("  EduChain deployed at:", eduChainAddress);

  // ────────────────────────────────────────────
  // Deploy ImpactNFT contract
  // ────────────────────────────────────────────
  console.log("\n[3/4] Deploying ImpactNFT contract...");

  const ImpactNFT = await hre.ethers.getContractFactory("ImpactNFT");
  const impactNFT = await ImpactNFT.deploy(cUSDAddress);
  await impactNFT.waitForDeployment();
  const impactNFTAddress = await impactNFT.getAddress();
  console.log("  ImpactNFT deployed at:", impactNFTAddress);

  // ────────────────────────────────────────────
  // Link contracts together
  // ────────────────────────────────────────────
  console.log("\n[4/4] Linking contracts...");

  const setNFTTx = await eduChain.setImpactNFT(impactNFTAddress);
  await setNFTTx.wait();
  console.log("  EduChain → ImpactNFT linked ✓");

  const setEduTx = await impactNFT.setEduChainContract(eduChainAddress);
  await setEduTx.wait();
  console.log("  ImpactNFT → EduChain linked ✓");

  // ────────────────────────────────────────────
  // Fund treasury with test cUSD
  // ────────────────────────────────────────────
  console.log("\n[BONUS] Funding treasury with 100 test cUSD...");

  const mintTx = await mockCUSD.mint(deployer.address, hre.ethers.parseEther("100"));
  await mintTx.wait();
  console.log("  Minted 100 cUSD to deployer ✓");

  const approveTx = await mockCUSD.approve(eduChainAddress, hre.ethers.parseEther("100"));
  await approveTx.wait();
  console.log("  Approved EduChain to spend cUSD ✓");

  const fundTx = await eduChain.fundPool(hre.ethers.parseEther("100"));
  await fundTx.wait();
  console.log("  Funded treasury with 100 cUSD ✓");

  // ────────────────────────────────────────────
  // Print summary
  // ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE ✓");
  console.log("═══════════════════════════════════════");
  console.log("");
  console.log("  Mock cUSD:    ", cUSDAddress);
  console.log("  EduChain:     ", eduChainAddress);
  console.log("  ImpactNFT:    ", impactNFTAddress);
  console.log("  Treasury:      100 cUSD funded");
  console.log("");
  console.log("  UPDATE YOUR .env FILE:");
  console.log("  CONTRACT_ADDRESS=" + eduChainAddress);
  console.log("  IMPACT_NFT_ADDRESS=" + impactNFTAddress);
  console.log("  MOCK_CUSD_ADDRESS=" + cUSDAddress);
  console.log("");
  console.log("  BaseScan Links:");
  console.log("  https://sepolia.basescan.org/address/" + eduChainAddress);
  console.log("  https://sepolia.basescan.org/address/" + impactNFTAddress);
  console.log("═══════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});