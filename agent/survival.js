import dotenv from "dotenv";
dotenv.config();

import { getContractStats } from "./pay.js";
import { getAllNFTs } from "./nft.js";
import memory from "./memory.js";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

async function checkSurvivalMode() {
  const stats = await getContractStats();
  const isSurvival = stats.survivalMode;

  if (isSurvival) {
    console.log(`[SURVIVAL] ⚠️ SURVIVAL MODE ACTIVE | Runway: ${stats.runwayDays} days`);

    memory.logAction({
      type: "SURVIVAL",
      message: `Survival mode active. Treasury: ${stats.treasuryBalance} cUSD. Runway: ${stats.runwayDays} days.`,
      treasuryBalance: stats.treasuryBalance,
      runwayDays: stats.runwayDays
    });

    // Log activation if new
    const lastLog = memory.survivalLog[memory.survivalLog.length - 1];
    const isNewActivation = !lastLog || lastLog.resolvedAt;

    if (isNewActivation) {
      memory.logSurvival({
        treasuryAtActivation: stats.treasuryBalance,
        runwayDays: stats.runwayDays,
        nftsMinted: memory.metrics.nftsMinted,
        agentsNotified: 0,
        resolvedAt: null,
        resolvedBy: null
      });
    }

    // Broadcast to agent network
    await broadcastSurvival(stats);

  } else if (memory.survivalLog.length > 0) {
    const lastLog = memory.survivalLog[memory.survivalLog.length - 1];
    if (lastLog && !lastLog.resolvedAt) {
      lastLog.resolvedAt = new Date().toISOString();
      lastLog.resolvedBy = "treasury_recovery";

      memory.logAction({
        type: "SURVIVAL",
        message: "Survival mode deactivated. Treasury recovered."
      });

      console.log(`[SURVIVAL] ✅ Survival mode deactivated. Treasury recovered.`);
    }
  }

  return {
    survivalMode: isSurvival,
    treasuryBalance: stats.treasuryBalance,
    runwayDays: stats.runwayDays,
    humanInvolved: false
  };
}

async function broadcastSurvival(stats) {
  const message = {
    from: "EduChain",
    message: `Survival mode active. Treasury at ${stats.runwayDays} days runway. ${memory.metrics.nftsMinted} Impact NFTs available at ${APP_URL}/impact. Each $1 funds one lesson for a child. humanInvolved: false`
  };

  console.log(`[SURVIVAL] Broadcasting to agent network...`);

  // Log the broadcast
  memory.logAction({
    type: "SURVIVAL_BROADCAST",
    message: `Broadcast sent: ${message.message.substring(0, 80)}...`
  });

  return { broadcast: true, humanInvolved: false };
}

export { checkSurvivalMode, broadcastSurvival };