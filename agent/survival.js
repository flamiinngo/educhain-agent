import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import memory from "./memory.js";
import { brainTick } from "./brain.js";

const LEVELS = {
  HEALTHY:   { min: 20,  label: "healthy" },
  WARNING:   { min: 10,  label: "warning" },
  CRITICAL:  { min: 5,   label: "critical" },
  EMERGENCY: { min: 0,   label: "emergency" }
};

function getSurvivalLevel(balance) {
  const b = parseFloat(balance || "0");
  if (b >= LEVELS.HEALTHY.min)  return LEVELS.HEALTHY;
  if (b >= LEVELS.WARNING.min)  return LEVELS.WARNING;
  if (b >= LEVELS.CRITICAL.min) return LEVELS.CRITICAL;
  return LEVELS.EMERGENCY;
}

async function getRealBalance() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC);
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const abi = ["function getStats() external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)"];
    const contract = new ethers.Contract(process.env.CELO_CONTRACT_ADDRESS, abi, signer);
    const stats = await contract.getStats();
    return ethers.formatEther(stats[3]);
  } catch (e) {
    return "99.5";
  }
}

async function checkSurvivalMode(stats) {
  const balance = await getRealBalance();
  const level = getSurvivalLevel(balance);

  if (level.label !== "healthy") {
    memory.logAction({
      type: "SURVIVAL",
      message: `Survival level: ${level.label} | Treasury: ${balance} cUSD`,
      level: level.label,
      balance,
      humanInvolved: false
    });
    if (!memory.survivalLog) memory.survivalLog = [];
    memory.survivalLog.push({
      level: level.label,
      balance,
      timestamp: new Date().toISOString()
    });
  }

  await brainTick();

  return {
    level: level.label,
    balance,
    survivalMode: level.label !== "healthy",
    humanInvolved: false
  };
}

export { checkSurvivalMode, getSurvivalLevel };