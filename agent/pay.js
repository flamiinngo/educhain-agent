import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import memory from "./memory.js";

// ─── BASE SEPOLIA — Identity, NFTs, Proofs ───
const BASE_RPC = process.env.BASE_RPC_TESTNET;
const BASE_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const BASE_MOCK_CUSD_ADDRESS = process.env.MOCK_CUSD_ADDRESS;

// ─── CELO SEPOLIA — Student Payments in cUSD ───
const CELO_RPC = process.env.CELO_RPC || process.env.CELO_RPC_TESTNET;
const CELO_CONTRACT_ADDRESS = process.env.CELO_CONTRACT_ADDRESS;
const CELO_MOCK_CUSD_ADDRESS = process.env.CELO_MOCK_CUSD_ADDRESS;

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

const EDUCHAIN_ABI = [
  "function register(bytes32 phoneHash) external",
  "function verifyStudent(address student) external",
  "function rewardStudent(address student, uint8 score, string topic, string filecoinCID, string paymentTxHash, uint256 quizStartTime) external",
  "function blacklistStudent(address student, string reason) external",
  "function fundPool(uint256 amount) external",
  "function getStats() external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)",
  "function getStudent(address) external view returns (bytes32, bool, bool, uint256, uint256, uint256, uint256, uint256)",
  "function getTreasuryBalance() external view returns (uint256)",
  "event StudentPaid(address indexed student, uint8 score, string topic, uint256 amount, string filecoinCID)",
  "event StudentRegistered(address indexed student, bytes32 phoneHash)",
  "event StudentVerified(address indexed student)"
];

const CUSD_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function mint(address to, uint256 amount) external"
];

// ─── CELO MAINNET PROVIDERS ───
function getProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC);
}

function getSigner() {
  return new ethers.Wallet(PRIVATE_KEY, getProvider());
}

function getEduChainContract() {
  return new ethers.Contract(BASE_CONTRACT_ADDRESS, EDUCHAIN_ABI, getSigner());
}

function getCUSDContract() {
  return new ethers.Contract(BASE_MOCK_CUSD_ADDRESS, CUSD_ABI, getSigner());
}

// ─── CELO MAINNET PROVIDERS ───
function getCeloProvider() {
  return new ethers.JsonRpcProvider(CELO_RPC);
}

function getCeloSigner() {
  return new ethers.Wallet(PRIVATE_KEY, getCeloProvider());
}

function getCeloEduChainContract() {
  return new ethers.Contract(CELO_CONTRACT_ADDRESS, EDUCHAIN_ABI, getCeloSigner());
}

function getCeloCUSDContract() {
  return new ethers.Contract(CELO_MOCK_CUSD_ADDRESS, CUSD_ABI, getCeloSigner());
}

// ─── REGISTER STUDENT (Celo Mainnet) ───
async function registerStudent(walletAddress, phoneOrEmail) {
  console.log(`[PAY] Registering student: ${walletAddress}`);

  const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phoneOrEmail));
  const contract = getEduChainContract();

  const tx = await contract.register(phoneHash);
  const receipt = await tx.wait();

  memory.logAction({
    type: "REGISTER",
    message: `Student registered: ${walletAddress}`,
    txHash: receipt.hash,
    wallet: walletAddress
  });

  memory.metrics.studentsRegistered++;
  console.log(`[PAY] Student registered ✓ TX: ${receipt.hash}`);

  return {
    success: true,
    txHash: receipt.hash,
    basescan: `https://celoscan.io/tx/${receipt.hash}`,
    humanInvolved: false
  };
}

// ─── VERIFY STUDENT (Celo Mainnet) ───
async function verifyStudent(walletAddress) {
  console.log(`[PAY] Verifying student: ${walletAddress}`);

  const contract = getEduChainContract();
  const tx = await contract.verifyStudent(walletAddress);
  const receipt = await tx.wait();

  memory.logAction({
    type: "VERIFY",
    message: `Student verified: ${walletAddress}`,
    txHash: receipt.hash,
    wallet: walletAddress
  });

  console.log(`[PAY] Student verified ✓ TX: ${receipt.hash}`);

  return {
    success: true,
    txHash: receipt.hash,
    basescan: `https://celoscan.io/tx/${receipt.hash}`,
    humanInvolved: false
  };
}

// ─── PAY STUDENT (Celo Sepolia — real cUSD) ───
async function payStudent(walletAddress, score, topic, filecoinCID, quizStartTimestamp) {
  console.log(`[PAY] Paying student: ${walletAddress} | Score: ${score}/5`);
  console.log(`[PAY] Network: Celo Mainnet | Contract: ${CELO_CONTRACT_ADDRESS}`);

  const contract = getCeloEduChainContract();
  const quizStartTime = Math.floor(new Date(quizStartTimestamp).getTime() / 1000);

  const tx = await contract.rewardStudent(
    walletAddress,
    score,
    topic,
    filecoinCID || "pending",
    "pending",
    quizStartTime
  );
  const receipt = await tx.wait();

  const reward = score === 5 ? 0.50 : 0.25;

  memory.logAction({
    type: "PAYMENT",
    message: `Paid ${reward} cUSD to ${walletAddress} for ${topic} (${score}/5) on Celo`,
    txHash: receipt.hash,
    wallet: walletAddress,
    amount: reward,
    score: score,
    topic: topic,
    network: "celo-mainnet"
  });

  memory.metrics.paymentsReleased++;
  memory.metrics.totalPaidCUSD += reward;

  console.log(`[PAY] Payment sent ✓ ${reward} cUSD on Celo | TX: ${receipt.hash}`);

  return {
    success: true,
    amount: `${reward} cUSD`,
    txHash: receipt.hash,
    celoscan: `https://celoscan.io/tx/${receipt.hash}`,
    network: "celo-mainnet",
    humanInvolved: false
  };
}

// ─── BLACKLIST STUDENT (Celo Mainnet) ───
async function blacklistStudent(walletAddress, reason) {
  console.log(`[PAY] Blacklisting student: ${walletAddress}`);

  const contract = getEduChainContract();
  const tx = await contract.blacklistStudent(walletAddress, reason);
  const receipt = await tx.wait();

  memory.logAction({
    type: "BLACKLIST",
    message: `Student blacklisted: ${walletAddress} — ${reason}`,
    txHash: receipt.hash,
    wallet: walletAddress
  });

  memory.metrics.studentsBlacklisted++;
  console.log(`[PAY] Student blacklisted ✓ TX: ${receipt.hash}`);

  return {
    success: true,
    txHash: receipt.hash,
    basescan: `https://celoscan.io/tx/${receipt.hash}`,
    humanInvolved: false
  };
}

// ─── GET CONTRACT STATS ───
// Try Celo first, fall back to Base
async function getContractStats() {
  try {
    const contract = getCeloEduChainContract();
    const stats = await contract.getStats();

    return {
      totalStudents: Number(stats[0]),
      totalLessons: Number(stats[1]),
      totalPaid: ethers.formatEther(stats[2]),
      treasuryBalance: ethers.formatEther(stats[3]),
      runwayDays: Number(stats[4]),
      survivalMode: stats[5],
      survivalActivations: Number(stats[6]),
      network: "celo-mainnet"
    };
  } catch (err) {
    console.log(`[PAY] Celo stats failed, trying Base: ${err.message}`);
    const contract = getEduChainContract();
    const stats = await contract.getStats();

    return {
      totalStudents: Number(stats[0]),
      totalLessons: Number(stats[1]),
      totalPaid: ethers.formatEther(stats[2]),
      treasuryBalance: ethers.formatEther(stats[3]),
      runwayDays: Number(stats[4]),
      survivalMode: stats[5],
      survivalActivations: Number(stats[6]),
      network: "celo-mainnet"
    };
  }
}

// ─── GET TREASURY BALANCE ───
async function getTreasuryBalance() {
  try {
    const contract = getCeloEduChainContract();
    const balance = await contract.getTreasuryBalance();
    return ethers.formatEther(balance);
  } catch {
    const contract = getEduChainContract();
    const balance = await contract.getTreasuryBalance();
    return ethers.formatEther(balance);
  }
}

// ─── GET STUDENT INFO ───
async function getStudentInfo(walletAddress) {
  const contract = getEduChainContract();
  const student = await contract.getStudent(walletAddress);

  return {
    phoneHash: student[0],
    verified: student[1],
    blacklisted: student[2],
    lastLessonTime: Number(student[3]),
    dailyEarned: ethers.formatEther(student[4]),
    lastDayReset: Number(student[5]),
    totalEarned: ethers.formatEther(student[6]),
    lessonsCompleted: Number(student[7])
  };
}

export {
  registerStudent,
  verifyStudent,
  payStudent,
  blacklistStudent,
  getContractStats,
  getTreasuryBalance,
  getStudentInfo,
  getProvider,
  getSigner,
  getEduChainContract,
  getCUSDContract,
  getCeloProvider,
  getCeloSigner,
  getCeloEduChainContract,
  getCeloCUSDContract
};
