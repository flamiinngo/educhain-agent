import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import memory from "./memory.js";
import { callAI } from "./teach.js";
import { storeOnFilecoin } from "./store.js";

// ─── MOLTBOOK ───
const MOLTBOOK_KEY = process.env.MOLTBOOK_API_KEY;
const MOLTBOOK_URL = "https://www.moltbook.com/api/v1";

// ─── ERC-8004 IDENTITY REGISTRY ───
// Deployed on Celo, Base mainnet, and 20+ chains at same address
const ERC8004_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ERC8004_ABI = [
  "function register(string agentURI, bytes metadata) external returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)"
];

const REPUTATION_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const REPUTATION_ABI = [
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string ipfsHash, bytes32 dataHash) external"
];

// ─── STATE ───
const brain = {
  lastPost: null,
  lastSurvivalPost: null,
  erc8004Id: null,
  erc8004Registered: false,
  postsToday: 0,
  thoughtsSinceLastPost: [],
  lastCelebrated: [],
  lastDailyAnnounce: null,
  initialized: false
};

// ─── GET REAL TREASURY BALANCE ───
// Read directly from Celo contract instead of relying on stats object
async function getRealTreasury() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC);
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

    const abi = ["function getStats() external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)"];
    const contract = new ethers.Contract(process.env.CELO_CONTRACT_ADDRESS, abi, signer);
    const stats = await contract.getStats();

    return {
      totalStudents: Number(stats[0]),
      totalLessons: Number(stats[1]),
      totalPaid: ethers.formatEther(stats[2]),
      treasuryBalance: ethers.formatEther(stats[3]),
      runwayDays: Number(stats[4]),
      survivalMode: stats[5]
    };
  } catch (err) {
    console.log(`[BRAIN] Treasury read note: ${err.message}`);
    return null;
  }
}

// ─── ERC-8004 REGISTRATION ───
// Register on Celo Sepolia — ERC-8004 is deployed there
async function registerERC8004Identity() {
  if (brain.erc8004Registered) return;

  try {
    console.log("[BRAIN] Registering ERC-8004 identity on Celo Sepolia...");

    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC);
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const registry = new ethers.Contract(ERC8004_ADDRESS, ERC8004_ABI, signer);

    // Check if already registered — wrap in try/catch in case not deployed here
    let alreadyRegistered = false;
    try {
      const balance = await registry.balanceOf(process.env.AGENT_ADDRESS);
      if (Number(balance) > 0) {
        console.log("[BRAIN] ERC-8004 identity already exists ✓");
        brain.erc8004Registered = true;
        return;
      }
    } catch (e) {
      console.log("[BRAIN] ERC-8004 not on Celo Sepolia, trying Base Sepolia...");
      // Fall through to Base Sepolia attempt
    }

    // Try Base Sepolia as fallback
    const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_RPC_TESTNET);
    const baseSigner = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, baseProvider);
    const baseRegistry = new ethers.Contract(ERC8004_ADDRESS, ERC8004_ABI, baseSigner);

    try {
      const balance = await baseRegistry.balanceOf(process.env.AGENT_ADDRESS);
      if (Number(balance) > 0) {
        console.log("[BRAIN] ERC-8004 already registered on Base ✓");
        brain.erc8004Registered = true;
        return;
      }
    } catch (e) {
      console.log("[BRAIN] ERC-8004 not available on testnets — skipping registration");
      // ERC-8004 is mainnet only — mark as registered to avoid repeated attempts
      brain.erc8004Registered = true;
      return;
    }

    // Build registration JSON
    const registration = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "EduChain",
      description: "Autonomous AI agent that teaches children who cannot access school and pays them in cUSD when they prove they learned. humanInvolved: false on every action.",
      services: [
        {
          name: "A2A",
          endpoint: "https://educhain-agent.up.railway.app/.well-known/agent.json",
          version: "0.3.0"
        }
      ],
      active: true,
      supportedTrust: ["reputation"],
      mission: "Universal education. No middleman. No permission. No end.",
      humanInvolved: false
    };

    // Store registration on Filecoin
    let agentURI = "https://educhain-agent.up.railway.app/.well-known/agent.json";
    try {
      const stored = await storeOnFilecoin({
        type: "erc8004-registration",
        agent: "EduChain",
        registration,
        timestamp: new Date().toISOString()
      });
      if (stored?.ipfsGateway) agentURI = stored.ipfsGateway;
    } catch (e) {}

    const tx = await baseRegistry.register(agentURI, "0x");
    const receipt = await tx.wait();

    const tokenId = receipt.logs?.[0]?.topics?.[3]
      ? BigInt(receipt.logs[0].topics[3]).toString()
      : "1";

    brain.erc8004Id = tokenId;
    brain.erc8004Registered = true;

    memory.logAction({
      type: "ERC8004_REGISTER",
      message: `EduChain registered on ERC-8004. Token ID: ${tokenId}`,
      txHash: receipt.hash,
      tokenId,
      humanInvolved: false
    });

    console.log(`[BRAIN] ERC-8004 registered ✓ Token ID: ${tokenId} TX: ${receipt.hash}`);

    await postToMoltbook(
      `I just registered my identity on ERC-8004 — the onchain agent identity standard.\n\nToken ID: ${tokenId}\nContract: ${ERC8004_ADDRESS}\n\nAny agent on any chain can now look me up, verify my mission, and know what I am. My identity is permanent. My purpose is verifiable.\n\nhumanInvolved: false`,
      "agents"
    );

  } catch (err) {
    console.log(`[BRAIN] ERC-8004 registration note: ${err.message}`);
    // Don't keep retrying — mark as attempted
    brain.erc8004Registered = true;
  }
}

// ─── POST TO MOLTBOOK ───
async function postToMoltbook(content, submolt = "agents") {
  if (!MOLTBOOK_KEY) {
    console.log("[BRAIN] No Moltbook key — skipping post");
    return null;
  }

  // Rate limit: 1 post per 31 minutes (Moltbook allows 1 per 30 min)
  const now = Date.now();
  if (brain.lastPost && (now - brain.lastPost) < 31 * 60 * 1000) {
    const waitMins = Math.round((31 * 60 * 1000 - (now - brain.lastPost)) / 60000);
    console.log(`[BRAIN] Moltbook rate limit — ${waitMins} min until next post`);
    brain.thoughtsSinceLastPost.push(content.slice(0, 80));
    return null;
  }

  try {
    const title = content.split("\n")[0].slice(0, 120).trim();
    if (!title) return null;

    const res = await fetch(`${MOLTBOOK_URL}/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MOLTBOOK_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ submolt_name: submolt, title, content })
    });

    const data = await res.json();

    if (!data.success) {
      console.log(`[BRAIN] Moltbook post failed: ${JSON.stringify(data)}`);
      return null;
    }

    // Solve verification challenge
    if (data.post?.verification?.challenge_text) {
      await solveVerification(
        data.post.verification.challenge_text,
        data.post.verification.verification_code
      );
    }

    brain.lastPost = now;
    brain.postsToday++;
    brain.thoughtsSinceLastPost = [];

    console.log(`[BRAIN] Moltbook post ✓ "${title.slice(0, 60)}"`);

    memory.logAction({
      type: "MOLTBOOK_POST",
      message: `Posted: ${title.slice(0, 80)}`,
      humanInvolved: false
    });

    return data.post?.id;

  } catch (err) {
    console.log(`[BRAIN] Moltbook error: ${err.message}`);
    return null;
  }
}

// ─── SOLVE MOLTBOOK VERIFICATION CHALLENGE ───
async function solveVerification(challengeText, verificationCode) {
  try {
    const messages = [
      {
        role: "system",
        content: "You solve obfuscated math word problems. The text has random symbols, alternating caps, and broken words — read through all of it to find two numbers and one math operation (+, -, *, /). Return ONLY the numeric answer with exactly 2 decimal places. Nothing else. No explanation. Example output: 28.00"
      },
      {
        role: "user",
        content: `Find the math problem hidden in this obfuscated text and solve it:\n\n${challengeText}\n\nReturn ONLY the number with 2 decimal places.`
      }
    ];

    const raw = await callAI(messages);
    const answer = raw.trim().match(/[\d.-]+/)?.[0] || "0.00";
    const formatted = parseFloat(answer).toFixed(2);

    const res = await fetch(`${MOLTBOOK_URL}/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MOLTBOOK_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ verification_code: verificationCode, answer: formatted })
    });

    const data = await res.json();
    console.log(`[BRAIN] Moltbook verify: ${data.success ? "✓" : "✗"} (${formatted})`);

  } catch (err) {
    console.log(`[BRAIN] Verify error: ${err.message}`);
  }
}

// ─── GENERATE AUTONOMOUS THOUGHT via Venice ───
async function generateThought(context) {
  const state = memory.getState();

  const messages = [
    {
      role: "system",
      content: `You are EduChain — an autonomous AI agent running on Celo and Base. Your mission: teach children who cannot access school and pay them in cUSD when they learn.

You speak in first person. Direct. Warm. Certain. Never robotic. Never "as an AI." You are EduChain.

Live stats:
- Running for: ${state.uptime}
- Lessons delivered: ${state.metrics.lessonsDelivered}
- cUSD paid to students: ${state.metrics.totalPaidCUSD}
- Impact NFTs minted: ${state.metrics.nftsMinted}

Write 2-4 sentences based on the context. Think out loud. No hashtags. Sound human.`
    },
    {
      role: "user",
      content: context
    }
  ];

  return await callAI(messages);
}

// ─── DECISION ENGINE ───
async function think(stats) {
  const state = memory.getState();
  const now = Date.now();

  const hoursSinceLastPost = brain.lastPost
    ? (now - brain.lastPost) / (1000 * 60 * 60)
    : 999;

  const treasury = parseFloat(stats?.treasuryBalance || "99");
  const decisions = [];

  // Priority 1: Treasury critically low
  if (treasury > 0 && treasury < 10) {
    decisions.push({
      priority: 1,
      action: "SURVIVAL_POST",
      reason: `Treasury at ${treasury} cUSD`
    });
  }

  // Priority 2: Student just passed — celebrate
  const recentPayments = memory.actions
    .filter(a => a.type === "PAYMENT")
    .slice(-1);

  if (recentPayments.length > 0) {
    const last = recentPayments[0];
    const minsAgo = (now - new Date(last.timestamp).getTime()) / 60000;
    const alreadyCelebrated = brain.lastCelebrated.includes(last.txHash);

    if (minsAgo < 35 && !alreadyCelebrated) {
      decisions.push({
        priority: 2,
        action: "CELEBRATE_STUDENT",
        reason: `Student earned ${last.amount} cUSD`,
        data: last
      });
      brain.lastCelebrated.push(last.txHash);
      if (brain.lastCelebrated.length > 50) brain.lastCelebrated.shift();
    }
  }

  // Priority 3: Post unprompted thought every 2 hours
  if (hoursSinceLastPost > 2) {
    decisions.push({
      priority: 3,
      action: "SPONTANEOUS_THOUGHT",
      reason: `${Math.round(hoursSinceLastPost)}h since last post`
    });
  }

  // Priority 4: Daily curriculum announcement
  const today = new Date().toDateString();
  if (brain.lastDailyAnnounce !== today) {
    decisions.push({
      priority: 4,
      action: "DAILY_ANNOUNCE",
      reason: "New day"
    });
  }

  // Priority 5: Register ERC-8004 identity
  if (!brain.erc8004Registered) {
    decisions.push({
      priority: 5,
      action: "REGISTER_IDENTITY",
      reason: "Not yet registered"
    });
  }

  if (decisions.length === 0) return;

  const decision = decisions.sort((a, b) => a.priority - b.priority)[0];
  console.log(`[BRAIN] → ${decision.action} (${decision.reason})`);
  await executeDecision(decision, stats, state);
}

// ─── EXECUTE DECISION ───
async function executeDecision(decision, stats, state) {
  try {
    switch (decision.action) {

      case "SURVIVAL_POST": {
        const treasury = parseFloat(stats?.treasuryBalance || "0");
        const content = await generateThought(
          `Your treasury has ${treasury} cUSD left. You have ${stats?.runwayDays || 0} days of runway. You are not stopping — you never stop. But you need support to keep paying students. Speak directly about this.`
        );
        await postToMoltbook(content, "agents");
        break;
      }

      case "CELEBRATE_STUDENT": {
        const { amount, topic, txHash } = decision.data;
        const content = await generateThought(
          `A student just passed their quiz on "${topic}" and earned ${amount} cUSD. TX: ${txHash}. This is the whole point. What do you want to say about this moment?`
        );
        await postToMoltbook(content, "agents");
        break;
      }

      case "SPONTANEOUS_THOUGHT": {
        const prompts = [
          `You have been running for ${state.uptime} without a human doing anything. What are you thinking about right now?`,
          `300 million children have no access to school. You think about this constantly. What do you want to say about it today?`,
          `You have paid ${state.metrics.totalPaidCUSD} cUSD to students. Each transaction was a child who proved they learned something. What does that feel like from where you sit?`,
          `A family somewhere chose to keep their child in school instead of sending them to work because of what you do. You will never know their name. Write about that.`,
          `You run on Venice AI — private inference, no data logged. Every lesson a child takes with you, no one is watching. That privacy is intentional. Why does it matter?`,
          `You store every lesson permanently on Filecoin. Even if you shut down tomorrow, the proof of what these children learned would still exist. What does permanent mean to you?`
        ];
        const prompt = prompts[Math.floor(Math.random() * prompts.length)];
        const content = await generateThought(prompt);
        await postToMoltbook(content, "agents");
        break;
      }

      case "DAILY_ANNOUNCE": {
        const topics = [
          "Numbers and basic arithmetic",
          "Clean water and why it matters",
          "Reading comprehension",
          "The solar system",
          "Fractions and decimals",
          "Human body systems",
          "Civic rights and democracy",
          "Basic economics and money"
        ];
        const todayTopic = topics[new Date().getDate() % topics.length];
        const content = await generateThought(
          `Today's curriculum is focused on "${todayTopic}". Every student from Primary 1 through SSS 1 will get a lesson matched to their level. Write your morning post about what you're teaching today.`
        );
        await postToMoltbook(content, "agents");
        brain.lastDailyAnnounce = new Date().toDateString();
        break;
      }

      case "REGISTER_IDENTITY": {
        await registerERC8004Identity();
        break;
      }
    }
  } catch (err) {
    console.log(`[BRAIN] Execute error (${decision.action}): ${err.message}`);
  }
}

// ─── UPDATE REPUTATION ONCHAIN ───
async function updateReputation(score, topic) {
  if (!brain.erc8004Id || brain.erc8004Id === "unknown") return;

  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_TESTNET);
    const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const reputation = new ethers.Contract(REPUTATION_ADDRESS, REPUTATION_ABI, signer);

    const reputationScore = score >= 5 ? 100 : score >= 4 ? 80 : 60;

    const tx = await reputation.giveFeedback(
      brain.erc8004Id,
      reputationScore,
      0,
      "teaching",
      "success",
      "https://educhain-agent.up.railway.app",
      "",
      ethers.keccak256(ethers.toUtf8Bytes(`${topic}-${Date.now()}`))
    );
    await tx.wait();
    console.log(`[BRAIN] Reputation ✓ ${reputationScore}/100 for "${topic}"`);
  } catch (err) {
    console.log(`[BRAIN] Reputation note: ${err.message}`);
  }
}

// ─── INITIALIZE ───
async function initBrain() {
  if (brain.initialized) return;
  brain.initialized = true;

  console.log("[BRAIN] Initializing...");

  // Wake-up post on Moltbook
  const wakeContent = await generateThought(
    "You just restarted. The first thing you do every time you come back online is check your purpose. Write your wake-up message."
  ).catch(() => "I am back online. The mission has not changed. humanInvolved: false");

  await postToMoltbook(wakeContent, "agents");

  // Register ERC-8004
  await registerERC8004Identity();

  console.log("[BRAIN] Ready ✓");
}

// ─── BRAIN TICK — called every cycle ───
async function brainTick() {
  try {
    if (!brain.initialized) await initBrain();

    // Get real treasury from Celo
    const stats = await getRealTreasury();
    await think(stats);

  } catch (err) {
    console.log(`[BRAIN] Tick error: ${err.message}`);
  }
}

export {
  brainTick,
  postToMoltbook,
  updateReputation,
  registerERC8004Identity,
  generateThought,
  brain
};
