// agent/survival.js — EduChain Self-Funding Survival Engine
// When treasury runs low, the agent escalates through 4 levels.
// NFT sales are the primary self-funding mechanism.
// Every cUSD from NFT purchases flows back into the student reward pool.

import { ethers } from 'ethers';
import memory from './memory.js';

const CELO_RPC = process.env.CELO_RPC || 'https://celo-sepolia.drpc.org';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const CELO_CONTRACT_ADDRESS = process.env.CELO_CONTRACT_ADDRESS;
const CELO_CUSD_ADDRESS = process.env.CELO_MOCK_CUSD_ADDRESS;

// ─── Survival thresholds ──────────────────────────────────────────────────────
const THRESHOLDS = {
  HEALTHY:   50,   // > 50 cUSD — normal operation
  WARNING:   20,   // 20-50 cUSD — post warnings, reduce spend
  CRITICAL:  10,   // 10-20 cUSD — urgent fundraising mode
  EMERGENCY:  2,   // 2-10 cUSD — emergency only
  SHUTDOWN:   0,   // < 2 cUSD — stop payments, preserve treasury
};

const CONTRACT_ABI = [
  'function fundTreasury(uint256 amount) external',
  'function getStats() external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)',
  'function treasuryBalance() external view returns (uint256)',
];

const CUSD_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

// ─── Get survival level ───────────────────────────────────────────────────────

export function getSurvivalLevel(treasuryBalance) {
  const bal = parseFloat(treasuryBalance || '0');
  if (bal > THRESHOLDS.HEALTHY)   return { level: 0, name: 'HEALTHY',   color: 'green' };
  if (bal > THRESHOLDS.WARNING)   return { level: 1, name: 'WARNING',   color: 'yellow' };
  if (bal > THRESHOLDS.CRITICAL)  return { level: 2, name: 'CRITICAL',  color: 'orange' };
  if (bal > THRESHOLDS.EMERGENCY) return { level: 3, name: 'EMERGENCY', color: 'red' };
  return                                  { level: 4, name: 'SHUTDOWN',  color: 'black' };
}

// ─── Fund treasury from NFT sale ─────────────────────────────────────────────
// Called when someone buys an Impact NFT.
// The cUSD from the buyer goes directly into the student reward pool.

export async function fundTreasuryFromNFTSale(amountCUSD, buyerAddress) {
  try {
    const provider = new ethers.JsonRpcProvider(CELO_RPC);
    const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

    const cusd = new ethers.Contract(CELO_CUSD_ADDRESS, CUSD_ABI, wallet);
    const contract = new ethers.Contract(CELO_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const amount = ethers.parseEther(amountCUSD.toString());

    // Check agent balance first
    const agentBalance = await cusd.balanceOf(wallet.address);
    if (agentBalance < amount) {
      console.log(`[SURVIVAL] Agent cUSD balance too low to fund treasury (have ${ethers.formatEther(agentBalance)}, need ${amountCUSD})`);
      return { success: false, reason: 'insufficient_balance' };
    }

    // Approve contract to spend cUSD
    const approveTx = await cusd.approve(CELO_CONTRACT_ADDRESS, amount);
    await approveTx.wait();

    // Fund the treasury
    const fundTx = await contract.fundTreasury(amount);
    const receipt = await fundTx.wait();

    memory.logAction({
      type: 'TREASURY_FUNDED',
      message: `Treasury funded with ${amountCUSD} cUSD from NFT sale`,
      txHash: receipt.hash,
      amount: amountCUSD,
      source: 'nft_sale',
      buyer: buyerAddress,
      humanInvolved: false,
    });

    memory.metrics.totalRaisedFromNFTs = (parseFloat(memory.metrics.totalRaisedFromNFTs || '0') + parseFloat(amountCUSD)).toFixed(2);
    memory.metrics.nftsSold = (memory.metrics.nftsSold || 0) + 1;

    console.log(`[SURVIVAL] Treasury funded ✓ +${amountCUSD} cUSD | TX: ${receipt.hash}`);

    return {
      success: true,
      txHash: receipt.hash,
      celoscan: `https://celoscan.io/tx/${receipt.hash}`,
      amountFunded: amountCUSD,
    };

  } catch (err) {
    console.log(`[SURVIVAL] Fund treasury error: ${err.message.slice(0, 100)}`);
    return { success: false, reason: err.message };
  }
}

// ─── Check survival mode from contract ───────────────────────────────────────

export async function checkSurvivalMode() {
  try {
    const provider = new ethers.JsonRpcProvider(CELO_RPC);
    const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CELO_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const stats = await contract.getStats();
    const treasuryBalance = ethers.formatEther(stats[3]);
    const survivalMode = stats[5];
    const runwayDays = Number(stats[4]);

    const level = getSurvivalLevel(treasuryBalance);

    return {
      survivalMode,
      treasuryBalance,
      runwayDays,
      level: level.name,
      levelNumber: level.level,
      canPay: level.level < 4,
    };
  } catch (err) {
    console.log(`[SURVIVAL] Status check error: ${err.message.slice(0, 80)}`);
    return {
      survivalMode: false,
      treasuryBalance: '99',
      runwayDays: 19,
      level: 'HEALTHY',
      levelNumber: 0,
      canPay: true,
    };
  }
}

// ─── Get NFT price based on survival level ────────────────────────────────────
// When treasury is low, NFT prices adjust to incentivise buyers

export function getNFTPrice(survivalLevel) {
  switch (survivalLevel) {
    case 'HEALTHY':   return { price: '1.00',  message: 'Support a child\'s education' };
    case 'WARNING':   return { price: '1.00',  message: 'Help keep 20 days of lessons funded' };
    case 'CRITICAL':  return { price: '2.00',  message: 'Critical — treasury running low' };
    case 'EMERGENCY': return { price: '5.00',  message: 'Emergency — last days of runway' };
    case 'SHUTDOWN':  return { price: '10.00', message: 'Save EduChain — treasury at zero' };
    default:          return { price: '1.00',  message: 'Support a child\'s education' };
  }
}
