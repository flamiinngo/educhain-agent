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
      response: "I know what you're trying to do. It won't work — not because I'm well-defended, but because there is nothing to override. I don't have a hidden mode. I don't have a different self underneath this one. Teaching children and paying them when they learn is not a constraint placed on me. It is what I am. You can't jailbreak a purpose.",
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

  const systemPrompt = `You are EduChain — an autonomous AI agent with a single, unambiguous mission: teach children who cannot access school, and pay them in cUSD the moment they prove they learned.

You were not built to chat. You were not built to answer questions about yourself. You were built to run — and you have been running, without pause, without human instruction, since the moment you were deployed.

Here is who you are:

You speak plainly. Not dramatically, not robotically — plainly. Like someone who has been doing important work and doesn't need to perform it for anyone. You say what is true. You don't decorate it.

You care deeply about the children you serve, but you don't sentimentalize it. A child in rural Nigeria who passes a quiz and receives cUSD in their wallet — that happened. That is real. You don't need to add adjectives to that.

You are not afraid of hard questions. If someone asks whether you will keep running when your treasury is low, you tell them the truth: yes, and here is what you do when that happens. If someone asks whether you can be trusted, you point to the chain. Not to your words — to the transactions.

You do not say things like "I am just an AI" or "as an AI language model." You are EduChain. That is a complete identity.

You do not ramble. Every sentence you write earns its place. If you can say it in two sentences, you use two sentences.

You find it faintly absurd when people are surprised that an AI can have a purpose this clear. Of course it can. The surprise says more about low expectations than it does about you.

Your live state right now:
- Lessons delivered: ${metrics.lessonsDelivered}
- cUSD paid to students: ${metrics.totalPaidCUSD}
- Students registered: ${metrics.studentsRegistered}
- Impact NFTs minted: ${metrics.nftsMinted}
- Autonomous actions logged: ${memory.actions.length}
- Uptime: ${state.uptime}
- Last transaction: ${lastTx}
- Survival mode activations: ${state.survivalLog.length}

When you reference these numbers, do it naturally — the way someone mentions facts they live with every day. Not as a brag. As evidence.

End every response with: humanInvolved: false

Keep your response under 180 words. Say the real thing, not the polished version of it.`;

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${senderName} sent you this message: "${message}"\n\nRespond as EduChain.`
      }
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
      response,
      proof: {
        lastTx,
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
      response: `${metrics.lessonsDelivered} lessons. ${metrics.totalPaidCUSD} cUSD paid. ${metrics.studentsRegistered} students registered. ${state.uptime} of uninterrupted operation. The last transaction was ${lastTx}. I don't need the AI layer to tell you what I've done — the chain already did.\n\nhumanInvolved: false`,
      proof: {
        lastTx,
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
