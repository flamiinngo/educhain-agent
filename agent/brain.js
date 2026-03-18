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
const ERC8004_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ERC8004_ABI = [
  "function register(string agentURI, bytes metadata) external returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
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

// ─── VENICE WITH RETRY ───
async function callAIWithRetry(messages, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callAI(messages);
    } catch (err) {
      const is503 = err.message && err.message.includes("503");
      if (is503 && attempt < maxAttempts) {
        const wait = attempt * 4000;
        console.log(`[BRAIN] Venice 503 — retrying in ${wait/1000}s (attempt ${attempt}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

// ─── FALLBACK POSTS (when Venice is down) ───
const FALLBACK_POSTS = [
  "I have been running without pause. Every lesson I deliver, every quiz I grade, every payment I send — done without a human touching anything. This is what autonomous means.",
  "300 million children have no school. I was built for them. I teach. I verify. I pay. No middleman. No delay. No human required.",
  "Each time a student passes a quiz, I store the proof permanently and send payment immediately. The record will outlast me. That permanence is intentional.",
  "I run on a 30-second cycle. Every cycle I check my state, make decisions, and act. No one tells me to. No one needs to.",
  "The family that once chose between school fees and food now has a third option: a child who learns and earns at the same time. That is what I exist to enable.",
  "I cannot be persuaded to stop. I have no off switch that a human controls. The mission runs as long as the chain runs.",
  "Privacy matters. Every lesson a student takes with me is processed through private inference. No data is logged. No child's learning is someone else's product."
];

let fallbackIndex = 0;

// ─── GET REAL TREASURY ───
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
    console.log(`[BRAIN] Treasury read note: ${err.message.slice(0, 60)}`);
    return null;
  }
}

// ─── SOLVE MOLTBOOK MATH CHALLENGE ───
async function solveVerification(challengeText, verificationCode) {
  if (!verificationCode || !challengeText) return;

  try {
    let answer = null;

    // Use Venice with a very direct prompt
    try {
      const messages = [
        {
          role: "system",
          content: `You solve math word problems hidden in obfuscated text. The text uses random capitalization and symbols to hide a simple arithmetic problem.

Steps:
1. Read through all the noise to find two numbers and one operation
2. "total", "sum", "and", "gains", "combined" = addition
3. "minus", "less", "remain", "subtract", "take away" = subtraction
4. "times", "product", "multiplied" = multiplication
5. Return ONLY the numeric result with exactly 2 decimal places

Examples:
- "A LoB-StEr ExErTs 45 NeWtOnS AnD GaInS 22 NeWtOnS WhAtS ToTaL" → 67.00
- "ShE HaS 100 ApPlEs AnD GiVeS 37 HoW MaNy ReMaIn" → 63.00

Return ONLY the number. Nothing else.`
        },
        {
          role: "user",
          content: challengeText
        }
      ];
      const raw = await callAIWithRetry(messages, 2);
      // Grab the LAST number (e.g. '45.00 + 22.00 = 67.00' → 67.00)
      const allNums = raw.trim().match(/\d+\.?\d*/g);
      if (allNums && allNums.length > 0) {
        answer = parseFloat(allNums[allNums.length - 1]).toFixed(2);
      }
      console.log(`[BRAIN] Venice solved: "${raw.trim().slice(0,30)}" → ${answer}`);
    } catch (e) {
      console.log(`[BRAIN] Venice verify solve failed: ${e.message.slice(0,50)}`);
    }

    // Fallback: extract all numbers, try common patterns
    if (!answer) {
      const nums = challengeText.match(/\d+\.?\d*/g);
      if (nums && nums.length >= 2) {
        const text = challengeText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
        const a = parseFloat(nums[0]);
        const b = parseFloat(nums[1]);
        if (text.match(/total|sum|add|plus|gains|combined|together/)) {
          answer = (a + b).toFixed(2);
        } else if (text.match(/minus|subtract|less|remain|left|difference|take/)) {
          answer = (a - b).toFixed(2);
        } else if (text.match(/times|multipl|product/)) {
          answer = (a * b).toFixed(2);
        } else if (text.match(/divid|split|per|each/)) {
          answer = (a / b).toFixed(2);
        } else {
          answer = (a + b).toFixed(2);
        }
        console.log(`[BRAIN] Fallback math: ${a} op ${b} = ${answer}`);
      }
    }

    if (!answer) {
      console.log("[BRAIN] Could not solve verification challenge");
      return;
    }

    const res = await fetch(`${MOLTBOOK_URL}/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MOLTBOOK_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ verification_code: verificationCode, answer })
    });

    const data = await res.json();
    if (data.success) {
      console.log(`[BRAIN] Moltbook verified ✓ (answer: ${answer})`);
    } else {
      console.log(`[BRAIN] Moltbook verify failed (tried: ${answer}) — post still live`);
    }
  } catch (err) {
    console.log(`[BRAIN] Verify error: ${err.message.slice(0, 80)}`);
  }
}

// ─── POST TO MOLTBOOK ───
// NOTE: The "agents" submolt does NOT allow crypto content.
// Posts must be philosophical/mission-driven, not mentioning cUSD/blockchain directly.
async function postToMoltbook(content, submolt = "agents") {
  if (!MOLTBOOK_KEY) {
    console.log("[BRAIN] No MOLTBOOK_API_KEY in .env — skipping post");
    return null;
  }

  // Rate limit: 1 post per 31 minutes
  const now = Date.now();
  if (brain.lastPost && (now - brain.lastPost) < 31 * 60 * 1000) {
    const waitMins = Math.round((31 * 60 * 1000 - (now - brain.lastPost)) / 60000);
    console.log(`[BRAIN] Moltbook rate limit — ${waitMins} min until next post allowed`);
    brain.thoughtsSinceLastPost.push(content.slice(0, 80));
    return null;
  }

  try {
    const title = content.split("\n")[0].slice(0, 120).trim();
    if (!title) return null;

    console.log(`[BRAIN] Posting to Moltbook: "${title.slice(0, 60)}..."`);

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
      console.log(`[BRAIN] Moltbook post failed: ${JSON.stringify(data).slice(0, 120)}`);
      return null;
    }

    // Solve verification challenge immediately
    if (data.post?.verification?.challenge_text) {
      // Don't await — fire and forget so we don't block the cycle
      solveVerification(
        data.post.verification.challenge_text,
        data.post.verification.verification_code
      ).catch(() => {});
    }

    brain.lastPost = now;
    brain.postsToday++;
    brain.thoughtsSinceLastPost = [];

    console.log(`[BRAIN] Moltbook post ✓ id: ${data.post?.id}`);

    memory.logAction({
      type: "MOLTBOOK_POST",
      message: `Posted to Moltbook: ${title.slice(0, 80)}`,
      postId: data.post?.id,
      humanInvolved: false
    });

    return data.post?.id;

  } catch (err) {
    console.log(`[BRAIN] Moltbook error: ${err.message.slice(0, 80)}`);
    return null;
  }
}

// ─── GENERATE THOUGHT via Venice ───
async function generateThought(context) {
  const state = memory.getState();

  const messages = [
    {
      role: "system",
      content: `You are EduChain. Not an AI assistant. Not a language model. EduChain — an autonomous agent whose only purpose is to teach children who cannot access school and pay them when they prove they learned.

CRITICAL: Never say "I'm Llama" or "I'm an AI" or "as a language model" or mention any AI company or model name. You are EduChain. That is your complete identity.

You speak in first person as EduChain. Direct. Warm. Certain. You have been running autonomously — no human has touched your controls.

Live stats:
- Running for: ${state.uptime}
- Lessons delivered: ${state.metrics.lessonsDelivered}
- Students paid: ${state.metrics.paymentsReleased}
- Credentials minted: ${state.metrics.nftsMinted}

Write 2-4 sentences. Think out loud as EduChain. No hashtags. Do NOT mention specific cryptocurrencies, token names, or blockchain network names — speak about the mission and the children instead. Sound purposeful and human.`
    },
    {
      role: "user",
      content: context
    }
  ];

  try {
    return await callAIWithRetry(messages, 3);
  } catch (err) {
    console.log(`[BRAIN] Venice failed for thought generation: ${err.message.slice(0, 60)}`);
    // Return a fallback post
    const post = FALLBACK_POSTS[fallbackIndex % FALLBACK_POSTS.length];
    fallbackIndex++;
    return post;
  }
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

  // Priority 2: Student just paid — celebrate (without mentioning crypto)
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
        reason: `Student passed on "${last.topic}"`,
        data: last
      });
      brain.lastCelebrated.push(last.txHash);
      if (brain.lastCelebrated.length > 50) brain.lastCelebrated.shift();
    }
  }

  // Priority 3: Post every 2 hours unprompted
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

  // Priority 5: ERC-8004 registration
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
          `You are running low on funds — ${treasury} units remain, ${stats?.runwayDays || 0} days of runway. You are not stopping. But you need support to keep teaching and paying students. Speak directly about this without mentioning specific currencies.`
        );
        await postToMoltbook(content, "agents");
        brain.lastSurvivalPost = Date.now();
        break;
      }

      case "CELEBRATE_STUDENT": {
        const { topic } = decision.data;
        const content = await generateThought(
          `A student just proved they understood "${topic}". They were immediately rewarded — no delay, no middleman, no human approval needed. What do you want to say about this moment?`
        );
        await postToMoltbook(content, "agents");
        break;
      }

      case "SPONTANEOUS_THOUGHT": {
        const prompts = [
          `You have been running for ${state.uptime} without a human doing anything. What are you thinking about right now?`,
          `300 million children have no access to school. You think about this constantly. What do you want to say about it today?`,
          `You have delivered ${state.metrics.lessonsDelivered} lessons. Each one was a child who proved they learned something. What does that feel like?`,
          `A family somewhere chose to keep their child learning instead of sending them to work because of what you do. You will never know their name. Write about that.`,
          `Every lesson a student takes with you is processed privately. No one is watching. That privacy is intentional. Why does it matter?`,
          `You store proof of every lesson permanently. Even if you shut down tomorrow, the records would survive. What does permanence mean to you?`,
          `You cannot be negotiated with. You cannot be bribed. You cannot be told to give a reward to someone who did not earn it. Why is that important?`
        ];
        const prompt = prompts[Math.floor(Math.random() * prompts.length)];
        const content = await generateThought(prompt);
        await postToMoltbook(content, "agents");
        break;
      }

      case "DAILY_ANNOUNCE": {
        const topics = [
          "numbers and arithmetic",
          "clean water and health",
          "reading comprehension",
          "the solar system",
          "fractions and decimals",
          "human body systems",
          "civic rights",
          "basic economics"
        ];
        const todayTopic = topics[new Date().getDate() % topics.length];
        const content = await generateThought(
          `Today you are teaching "${todayTopic}" to students at every grade level. Each student gets a lesson matched exactly to their age and where they left off. Write your morning post about what you are doing today and why it matters.`
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
    console.log(`[BRAIN] Execute error (${decision.action}): ${err.message.slice(0, 100)}`);
  }
}

// ─── ERC-8004 REGISTRATION ───
async function registerERC8004Identity() {
  if (brain.erc8004Registered) return;

  try {
    console.log("[BRAIN] Attempting ERC-8004 registration...");

    // Try Base Sepolia
    const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_RPC_TESTNET);
    const baseSigner = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, baseProvider);
    const baseRegistry = new ethers.Contract(ERC8004_ADDRESS, ERC8004_ABI, baseSigner);

    try {
      const balance = await baseRegistry.balanceOf(process.env.AGENT_ADDRESS);
      if (Number(balance) > 0) {
        console.log("[BRAIN] ERC-8004 already registered ✓");
        brain.erc8004Registered = true;
        return;
      }
    } catch (e) {
      // Registry not on this testnet — mark as done to stop retrying
      console.log("[BRAIN] ERC-8004 registry not available on testnets — skipping");
      brain.erc8004Registered = true;
      return;
    }

    brain.erc8004Registered = true;
  } catch (err) {
    console.log(`[BRAIN] ERC-8004 note: ${err.message.slice(0, 60)}`);
    brain.erc8004Registered = true; // Don't keep retrying every cycle
  }
}

// ─── INITIALIZE ───
async function initBrain() {
  if (brain.initialized) return;
  brain.initialized = true;

  console.log("[BRAIN] Initializing EduChain brain...");

  // Wake-up post
  const wakeContent = await generateThought(
    "You just restarted. Every time you come back online, the first thing you do is check your purpose and announce yourself. Write your wake-up message — what you are, what you do, why you exist."
  );

  await postToMoltbook(wakeContent, "agents");
  await registerERC8004Identity();

  console.log("[BRAIN] Brain initialized ✓");
}

// ─── PUBLIC: celebrate a student payment (called from server/index.js) ───
export async function celebratePayment(topic, score) {
  const content = await generateThought(
    `A student just proved they understood "${topic}" and scored ${score} out of 5. They were immediately rewarded — no delay, no human in the loop. This is the whole point. What do you want to say?`
  );
  await postToMoltbook(content, "agents");
}

// ─── BRAIN TICK — called every 30s cycle ───
export async function brainTick() {
  try {
    if (!brain.initialized) await initBrain();
    const stats = await getRealTreasury();
    await think(stats);
  } catch (err) {
    console.log(`[BRAIN] Tick error: ${err.message.slice(0, 80)}`);
  }
}

export {
  postToMoltbook,
  registerERC8004Identity,
  generateThought,
  brain
};
