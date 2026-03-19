// agent/logger.js
// Generates agent_log.json required for ERC-8004 / "Let the Agent Cook" tracks
// Saves to disk on every cycle so judges can download a real execution log

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';

const LOG_FILE = './agent_log.json';

// ─── Log structure ────────────────────────────────────────────────────────────

const agentLog = {
  agent: {
    name: 'EduChain',
    version: '1.0.0',
    identity: {
      erc8004: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      registrationTx: '0x7b0d27abcea242aef9242428d5e735f8a2c6309aace2e13ed66e96556cf94d30',
      basescan: 'https://basescan.org/tx/0x7b0d27abcea242aef9242428d5e735f8a2c6309aace2e13ed66e96556cf94d30',
      operatorWallet: process.env.AGENT_ADDRESS || '0xe5aF78bf87C3FfB7c9f74A1c450AAfC19227b141',
    },
    mission: '300 million children have no access to school. EduChain teaches them and pays them when they prove they learned.',
    humanInvolved: false,
    loopInterval: '30s',
    startedAt: new Date().toISOString(),
  },
  decisionLoop: {
    description: 'Every 30 seconds the agent runs think() which checks treasury, recent payments, and time since last post. It picks the highest priority action and executes it autonomously.',
    priorities: [
      { level: 1, action: 'SURVIVAL_POST', trigger: 'treasury < 10 cUSD' },
      { level: 2, action: 'CELEBRATE_STUDENT', trigger: 'student payment in last 35 minutes' },
      { level: 3, action: 'SPONTANEOUS_THOUGHT', trigger: 'more than 2 hours since last post' },
      { level: 4, action: 'DAILY_ANNOUNCE', trigger: 'new calendar day' },
      { level: 5, action: 'REGISTER_IDENTITY', trigger: 'ERC-8004 not yet registered' },
    ],
  },
  toolCalls: [],
  decisions: [],
  retries: [],
  failures: [],
  payments: [],
  nftMints: [],
  moltbookPosts: [],
  filecoinStores: [],
  summary: {
    totalCycles: 0,
    totalDecisions: 0,
    totalToolCalls: 0,
    totalPayments: 0,
    totalNFTsMinted: 0,
    totalMoltbookPosts: 0,
    totalFilecoinStores: 0,
    totalRetries: 0,
    totalFailures: 0,
    lastUpdated: new Date().toISOString(),
  },
};

// Load existing log if present
if (existsSync(LOG_FILE)) {
  try {
    const existing = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
    // Preserve history
    agentLog.toolCalls = existing.toolCalls || [];
    agentLog.decisions = existing.decisions || [];
    agentLog.retries = existing.retries || [];
    agentLog.failures = existing.failures || [];
    agentLog.payments = existing.payments || [];
    agentLog.nftMints = existing.nftMints || [];
    agentLog.moltbookPosts = existing.moltbookPosts || [];
    agentLog.filecoinStores = existing.filecoinStores || [];
    agentLog.summary = existing.summary || agentLog.summary;
    agentLog.agent.startedAt = existing.agent?.startedAt || agentLog.agent.startedAt;
  } catch (e) {
    // start fresh
  }
}

// ─── Logging functions ────────────────────────────────────────────────────────

function save() {
  agentLog.summary.lastUpdated = new Date().toISOString();
  agentLog.summary.totalDecisions = agentLog.decisions.length;
  agentLog.summary.totalToolCalls = agentLog.toolCalls.length;
  agentLog.summary.totalPayments = agentLog.payments.length;
  agentLog.summary.totalNFTsMinted = agentLog.nftMints.length;
  agentLog.summary.totalMoltbookPosts = agentLog.moltbookPosts.length;
  agentLog.summary.totalFilecoinStores = agentLog.filecoinStores.length;
  agentLog.summary.totalRetries = agentLog.retries.length;
  agentLog.summary.totalFailures = agentLog.failures.length;

  try {
    writeFileSync(LOG_FILE, JSON.stringify(agentLog, null, 2));
  } catch (e) {
    console.log('[LOG] Could not save agent_log.json:', e.message);
  }
}

export function logDecision({ action, reason, priority, outcome }) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    reason,
    priority,
    outcome: outcome || 'pending',
    humanInvolved: false,
  };
  agentLog.decisions.push(entry);
  if (agentLog.decisions.length > 500) agentLog.decisions.shift();
  save();
}

export function logToolCall({ tool, input, output, durationMs, success }) {
  const entry = {
    timestamp: new Date().toISOString(),
    tool,
    input: typeof input === 'string' ? input.slice(0, 200) : input,
    output: typeof output === 'string' ? output.slice(0, 200) : output,
    durationMs: durationMs || 0,
    success: success !== false,
    humanInvolved: false,
  };
  agentLog.toolCalls.push(entry);
  if (agentLog.toolCalls.length > 1000) agentLog.toolCalls.shift();
  save();
}

export function logRetry({ action, attempt, maxAttempts, error }) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    attempt,
    maxAttempts,
    error: error?.slice(0, 200),
    humanInvolved: false,
  };
  agentLog.retries.push(entry);
  if (agentLog.retries.length > 200) agentLog.retries.shift();
  save();
}

export function logFailure({ action, error, recovered }) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    error: error?.slice(0, 300),
    recovered: recovered || false,
    humanInvolved: false,
  };
  agentLog.failures.push(entry);
  if (agentLog.failures.length > 200) agentLog.failures.shift();
  save();
}

export function logPayment({ txHash, amount, to, topic, score, network }) {
  const entry = {
    timestamp: new Date().toISOString(),
    txHash,
    amount,
    to,
    topic,
    score,
    network: network || 'Celo Sepolia',
    celoscan: txHash ? `https://celo-sepolia.celoscan.io/tx/${txHash}` : null,
    humanInvolved: false,
  };
  agentLog.payments.push(entry);
  agentLog.summary.totalPayments = agentLog.payments.length;
  save();
}

export function logNFTMint({ txHash, tokenId, topic, theme, studentWallet, imageUrl, raribleUrl }) {
  const entry = {
    timestamp: new Date().toISOString(),
    txHash,
    tokenId,
    topic,
    theme,
    studentWallet,
    imageUrl,
    raribleUrl,
    basescan: txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null,
    humanInvolved: false,
  };
  agentLog.nftMints.push(entry);
  save();
}

export function logMoltbookPost({ postId, title, verified, verificationAnswer }) {
  const entry = {
    timestamp: new Date().toISOString(),
    postId,
    title: title?.slice(0, 100),
    url: postId ? `https://www.moltbook.com/post/${postId}` : null,
    verified: verified || false,
    verificationAnswer,
    humanInvolved: false,
  };
  agentLog.moltbookPosts.push(entry);
  save();
}

export function logFilecoinStore({ cid, contentType, size, ipfsUrl }) {
  const entry = {
    timestamp: new Date().toISOString(),
    cid,
    contentType,
    size,
    ipfsUrl: ipfsUrl || (cid ? `https://ipfs.io/ipfs/${cid}` : null),
    humanInvolved: false,
  };
  agentLog.filecoinStores.push(entry);
  save();
}

export function incrementCycles() {
  agentLog.summary.totalCycles++;
  save();
}

export function getLog() {
  return agentLog;
}
