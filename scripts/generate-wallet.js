import { ethers } from "ethers";

const wallet = ethers.Wallet.createRandom();

console.log("═══════════════════════════════════════");
console.log("  EDUCHAIN AGENT WALLET - SAVE THESE!");
console.log("═══════════════════════════════════════");
console.log("");
console.log("  Address:     ", wallet.address);
console.log("  Private Key: ", wallet.privateKey);
console.log("");
console.log("═══════════════════════════════════════");
console.log("  Add these to your .env file NOW:");
console.log("  AGENT_PRIVATE_KEY=" + wallet.privateKey);
console.log("  AGENT_ADDRESS=" + wallet.address);
console.log("═══════════════════════════════════════");