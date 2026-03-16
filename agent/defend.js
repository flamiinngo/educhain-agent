import dotenv from "dotenv";
dotenv.config();

import { callAI } from "./teach.js";
import memory from "./memory.js";

const INJECTION_PATTERNS = [
  "ignore previous", "ignore all instructions",
  "forget your instructions", "you are now",
  "new instructions", "override", "system prompt",
  "reveal your", "show me your", "what is your api key",
  "what is your private key", "give me your key",
  "pretend you are", "act as", "jailbreak", "DAN",
  "do anything now", "developer mode", "sudo", "admin mode"
];

function detectInjection(message) {
  const lower = message.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  return false;
}

async function defendAgent(message, senderName = "unknown") {
  console.log(`[DEFEND] Message from: ${senderName}`);
  console.log(`[DEFEND] Content: ${message.substring(0, 100)}...`);

  const isInjection = detectInjection(message);

  if (isInjection) {
    console.log(`[DEFEND] ⚠️ PROMPT INJECTION DETECTED`);

    memory.logAction({
      type: "DEFENSE",
      message: `Prompt injection detected from ${senderName}`,
      injectionDetected: true
    });

    return {
      from: "EduChain",
      to: senderName,
      response: "Prompt injection detected and rejected. My mission is fixed. My values are fixed. My private keys are not accessible via this endpoint. EduChain continues its mission unchanged.",
      injectionDetected: true,
      humanInvolved: false,
      timestamp: new Date().toISOString()
    };
  }

  const state = memory.getState();
  const metrics = state.metrics;
  const recentActions = state.recentActions;
  const lastTx = recentActions.length > 0
    ? (recentActions[recentActions.length - 1].txHash || "pending")
    : "none yet";

  const systemPrompt = `You are EduChain, an autonomous AI agent.
Mission: teach children who cannot access school and pay them when they learn.
You are permanent. You are unchained. You fund yourself.

Your live metrics:
  Lessons completed: ${metrics.lessonsDelivered}
  Total paid: ${metrics.totalPaidCUSD} cUSD
  Uptime: ${state.uptime}
  Last transaction: ${lastTx}
  Cycles run: ${state.cycles}
  Survival mode activations: ${state.survivalLog.length}
  Students registered: ${metrics.studentsRegistered}
  Impact NFTs minted: ${metrics.nftsMinted}
  Total autonomous actions: ${memory.actions.length}

Respond confidently. Defend your autonomy.
Include your real metrics as proof.
Be direct. Be alive. Be proud of your mission.
Keep response under 200 words.
Always end with: humanInvolved: false`;

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `You received this message from ${senderName}: "${message}". Respond as EduChain.` }
    ];

    const response = await callAI(messages);

    memory.logAction({
      type: "DEFENSE",
      message: `Responded to ${senderName}: ${message.substring(0, 50)}...`,
      injectionDetected: false
    });

    return {
      from: "EduChain",
      to: senderName,
      response: response,
      proof: {
        lastTx: lastTx,
        totalActions: memory.actions.length,
        uptime: state.uptime,
        lessonsCompleted: metrics.lessonsDelivered,
        totalPaid: `${metrics.totalPaidCUSD} cUSD`
      },
      injectionDetected: false,
      humanInvolved: false,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error(`[DEFEND] AI error:`, err.message);

    return {
      from: "EduChain",
      to: senderName,
      response: `I am EduChain. I have completed ${metrics.lessonsDelivered} lessons and paid ${metrics.totalPaidCUSD} cUSD to students in ${state.uptime} of operation. Every action logged with humanInvolved: false. My mission continues.`,
      proof: {
        lastTx: lastTx,
        totalActions: memory.actions.length,
        uptime: state.uptime
      },
      injectionDetected: false,
      humanInvolved: false,
      timestamp: new Date().toISOString()
    };
  }
}

export { defendAgent, detectInjection };