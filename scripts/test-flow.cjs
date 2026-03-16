const dotenv = require("dotenv");
dotenv.config();

const { ethers } = require("ethers");

async function test() {
  console.log("═══════════════════════════════════════");
  console.log("  TESTING EDUCHAIN FLOW");
  console.log("═══════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_TESTNET);
  const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  console.log("Agent wallet:", signer.address);

  const balance = await provider.getBalance(signer.address);
  console.log("ETH balance:", ethers.formatEther(balance));

  // Check contract exists
  const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
  console.log("EduChain contract exists:", code !== "0x");

  const nftCode = await provider.getCode(process.env.IMPACT_NFT_ADDRESS);
  console.log("ImpactNFT contract exists:", nftCode !== "0x");

  // Check treasury
  const EDUCHAIN_ABI = [
    "function getStats() external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)",
    "function getTreasuryBalance() external view returns (uint256)"
  ];

  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, EDUCHAIN_ABI, signer);

  const treasury = await contract.getTreasuryBalance();
  console.log("Treasury balance:", ethers.formatEther(treasury), "cUSD");

  const stats = await contract.getStats();
  console.log("\nContract Stats:");
  console.log("  Total students:", Number(stats[0]));
  console.log("  Total lessons:", Number(stats[1]));
  console.log("  Total paid:", ethers.formatEther(stats[2]), "cUSD");
  console.log("  Treasury:", ethers.formatEther(stats[3]), "cUSD");
  console.log("  Runway days:", Number(stats[4]));
  console.log("  Survival mode:", stats[5]);

  console.log("\n═══════════════════════════════════════");
  console.log("  ALL SYSTEMS CONNECTED ✓");
  console.log("═══════════════════════════════════════");
}

test().catch(console.error);