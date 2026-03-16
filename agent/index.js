import dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import memory from "./memory.js";
import { getContractStats } from "./pay.js";
import { checkSurvivalMode } from "./survival.js";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

async function runCycle() {
  memory.cycles++;
  const cycleNum = memory.cycles;

  console.log(`\n[${new Date().toLocaleTimeString()}] ═══ Cycle #${cycleNum} started ═══`);

  try {
    // Step 1: Health check
    let stats;
    try {
      stats = await getContractStats();
      console.log(`[${new Date().toLocaleTimeString()}] Treasury: ${stats.treasuryBalance} cUSD | Runway: ${stats.runwayDays} days`);
      console.log(`[${new Date().toLocaleTimeString()}] Students: ${stats.totalStudents} | Lessons: ${stats.totalLessons} | Paid: ${stats.totalPaid} cUSD`);
    } catch (err) {
      console.log(`[${new Date().toLocaleTimeString()}] Health check error: ${err.message}`);
      stats = { treasuryBalance: "0", runwayDays: 0, survivalMode: false, totalStudents: 0, totalLessons: 0, totalPaid: "0" };
    }

    // Step 2: Check survival mode
    try {
      const survivalStatus = await checkSurvivalMode();
      if (survivalStatus.survivalMode) {
        console.log(`[${new Date().toLocaleTimeString()}] ⚠️ SURVIVAL MODE ACTIVE`);
      }
    } catch (err) {
      console.log(`[${new Date().toLocaleTimeString()}] Survival check note: ${err.message}`);
    }

    // Step 3: Process any pending submissions
    if (memory.pendingSubmissions.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] Processing ${memory.pendingSubmissions.length} pending submissions...`);
      memory.pendingSubmissions = [];
    }

    // Step 4: Review flagged accounts
    if (memory.flaggedAccounts.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] Reviewing ${memory.flaggedAccounts.length} flagged accounts...`);
    }

    // Step 5: Log cycle
    memory.logAction({
      type: "CYCLE",
      message: `Cycle #${cycleNum} complete`,
      cycle: cycleNum,
      mode: stats.survivalMode ? "survival" : "normal",
      treasury: stats.treasuryBalance,
      runwayDays: stats.runwayDays,
      studentsTotal: stats.totalStudents,
      lessonsTotal: stats.totalLessons,
      paidTotal: stats.totalPaid
    });

    console.log(`[${new Date().toLocaleTimeString()}] humanInvolved: false ✓`);
    console.log(`[${new Date().toLocaleTimeString()}] ═══ Cycle #${cycleNum} complete ═══`);

  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Cycle #${cycleNum} error: ${err.message}`);
    memory.logAction({
      type: "ERROR",
      message: `Cycle #${cycleNum} error: ${err.message}`,
      cycle: cycleNum
    });
  }
}

function startAgent() {
  console.log("═══════════════════════════════════════");
  console.log("  EDUCHAIN AUTONOMOUS AGENT STARTING");
  console.log("═══════════════════════════════════════");
  console.log("  Mission: Teach every child. Pay every learner.");
  console.log("  Loop: Every 30 seconds");
  console.log("  humanInvolved: false");
  console.log("═══════════════════════════════════════\n");

  memory.logAction({
    type: "AGENT",
    message: "EduChain autonomous agent started"
  });

  // Run first cycle immediately
  runCycle();

  // Then every 30 seconds
  cron.schedule("*/30 * * * * *", () => {
    runCycle();
  });
}

export { startAgent, runCycle };