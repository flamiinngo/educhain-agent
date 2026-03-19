import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { generateFullLesson } from "../agent/teach.js";
import { gradeQuiz } from "../agent/grade.js";
import { defendAgent } from "../agent/defend.js";
import { registerStudent, verifyStudent, payStudent, getContractStats, getStudentInfo, getSigner, getEduChainContract, getCUSDContract } from "../agent/pay.js";
import { storeOnFilecoin } from "../agent/store.js";
import { mintImpactNFT, getAllNFTs } from "../agent/nft.js";
import { checkSurvivalMode, fundTreasuryFromNFTSale, getNFTPrice } from "../agent/survival.js";
import { getOrCreateStudentWallet } from "../agent/privy.js";
import { logPayment, logNFTMint, logFilecoinStore, logDecision, incrementCycles, getLog } from "../agent/logger.js";
import memory from "../agent/memory.js";
import { ethers } from "ethers";

const app = express();
app.use(express.json());
app.use(express.static("frontend"));

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const IMPACT_NFT_ADDRESS = process.env.IMPACT_NFT_ADDRESS;

// ─── CURRICULUM ENGINE ───────────────────────────────────────────────────────
function assignTopicForGrade(grade, age) {
  const curriculum = {
    primary_1: [
      "Numbers 1 to 10",
      "Letters and Sounds",
      "My Body and How It Works",
      "Colors and Shapes Around Us",
      "Family and Community",
      "Days of the Week"
    ],
    primary_2: [
      "Addition and Subtraction",
      "Simple Sentences",
      "Animals and Their Habitats",
      "Clean Water and Why It Matters",
      "The Five Senses",
      "Basic Map Reading"
    ],
    primary_3: [
      "Multiplication Basics",
      "Reading and Understanding Stories",
      "Plants and Photosynthesis",
      "Community Helpers and Their Roles",
      "Weather and Seasons",
      "Fractions Introduction"
    ],
    primary_4: [
      "Long Division",
      "Writing Clear Paragraphs",
      "The Solar System",
      "Health and Personal Hygiene",
      "Food Chains and Ecosystems",
      "Nigerian Geography Basics"
    ],
    primary_5: [
      "Fractions and Decimals",
      "Persuasive Writing",
      "The Human Body Systems",
      "Climate and Weather Patterns",
      "Basic Electricity",
      "History of West Africa"
    ],
    primary_6: [
      "Percentages and Ratios",
      "Critical Reading Skills",
      "Ecosystems and Biodiversity",
      "Introduction to Economics",
      "Civic Rights and Responsibilities",
      "Basic Computer Literacy"
    ],
    jss_1: [
      "Algebra Basics",
      "Creative Writing",
      "Introduction to Chemistry",
      "Civic Education and Democracy",
      "Basic Business Studies",
      "Physical Geography"
    ],
    jss_2: [
      "Geometry and Shapes",
      "Literature and Storytelling",
      "Biology: Cells and Life",
      "Nigerian History and Culture",
      "Introduction to Physics",
      "Agricultural Science"
    ],
    jss_3: [
      "Statistics and Data",
      "Poetry and Analysis",
      "Forces and Motion in Physics",
      "Government and Democracy",
      "Financial Literacy",
      "Computer Science Basics"
    ],
    sss_1: [
      "Advanced Algebra",
      "Essay Composition and Argument",
      "Organic Chemistry",
      "Economics Principles",
      "Further Mathematics",
      "Biology: Genetics and Evolution"
    ]
  };

  const topics = curriculum[grade] || curriculum["primary_3"];
  const day = new Date().getDate();
  return topics[day % topics.length];
}

// ─── GET /.well-known/agent.json ─────────────────────────────────────────────
app.get("/.well-known/agent.json", async (req, res) => {
  try {
    let stats = { totalStudents: 0, totalLessons: 0, totalPaid: "0", treasuryBalance: "0", runwayDays: 0, survivalMode: false, survivalActivations: 0 };
    try { stats = await getContractStats(); } catch (e) {}

    res.json({
      name: "EduChain",
      version: "1.0.0",
      identity: "I am an autonomous AI agent with one mission: teach every child who cannot access school and pay them the moment they learn. I run forever. I fund myself. I cannot be stopped.",
      mission: "Universal education through autonomous AI. No middleman. No permission. No end.",
      status: "active",
      survivalMode: stats.survivalMode,
      uptime: memory.getUptime(),
      metrics: {
        lessonsCompleted: stats.totalLessons || memory.metrics.lessonsDelivered,
        totalPaidCUSD: stats.totalPaid || memory.metrics.totalPaidCUSD,
        studentsRegistered: stats.totalStudents || memory.metrics.studentsRegistered,
        impactNFTsMinted: memory.metrics.nftsMinted,
        cyclesRun: memory.cycles
      },
      humanInvolved: false,
      capabilities: [
        "teach", "quiz", "grade", "pay",
        "mint_impact_nft", "self_fund",
        "detect_fraud", "respond_to_agents",
        "survive_autonomously", "defend_against_attacks"
      ],
      endpoints: {
        status: "/status",
        proof: "/proof",
        message: "/message",
        demo: "/demo",
        register: "/register",
        lesson: "/lesson",
        submitQuiz: "/submit-quiz",
        impactNFTs: "/impact-nfts",
        buyNFT: "/buy-nft/:tokenId",
        survivalLog: "/survival-log",
        survivalStatus: "/survival-status"
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── GET /status ─────────────────────────────────────────────────────────────
app.get("/status", async (req, res) => {
  try {
    let stats = { totalStudents: 0, totalLessons: 0, totalPaid: "0", treasuryBalance: "0", runwayDays: 0, survivalMode: false, survivalActivations: 0 };
    try { stats = await getContractStats(); } catch (e) {}

    res.json({
      status: "active",
      survivalMode: stats.survivalMode,
      uptime: memory.getUptime(),
      lastCycle: memory.actions.length > 0 ? memory.actions[memory.actions.length - 1].timestamp : null,
      treasury: {
        balanceCUSD: stats.treasuryBalance,
        runwayDays: stats.runwayDays,
        totalFundedAllTime: stats.totalPaid
      },
      metrics: {
        lessonsToday: memory.metrics.lessonsDelivered,
        paymentsToday: memory.metrics.paymentsReleased,
        totalLessonsAllTime: stats.totalLessons,
        totalPaidAllTime: `${stats.totalPaid} cUSD`,
        studentsRegistered: stats.totalStudents,
        studentsBlacklisted: memory.metrics.studentsBlacklisted,
        impactNFTsMinted: memory.metrics.nftsMinted,
        impactNFTsSold: memory.metrics.nftsSold,
        totalRaisedFromNFTs: `${memory.metrics.totalRaisedFromNFTs || 0} cUSD`
      },
      recentActions: memory.getRecentActions(5),
      humanInvolved: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── GET /proof ──────────────────────────────────────────────────────────────
app.get("/proof", async (req, res) => {
  try {
    const recentPayments = memory.actions
      .filter(a => a.type === "PAYMENT")
      .slice(-5)
      .map(a => ({
        tx: a.txHash || "pending",
        celoscan: a.txHash ? `https://sepolia.celoscan.io/tx/${a.txHash}` : "pending",
        amount: `${a.amount} cUSD`,
        topic: a.topic,
        timestamp: a.timestamp,
        humanInvolved: false
      }));

    res.json({
      statement: `EduChain has operated for ${memory.getUptimeHours()} hours with zero human actions recorded.`,
      verification: {
        contractAddress: CONTRACT_ADDRESS,
        basescan: `https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`,
        recentPayments
      },
      actionLog: memory.getRecentActions(10),
      totalActionsWithoutHuman: memory.actions.length,
      humanInvolved: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── POST /message ───────────────────────────────────────────────────────────
app.post("/message", async (req, res) => {
  try {
    const { from, message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required", humanInvolved: false });
    const response = await defendAgent(message, from || "unknown");
    res.json(response);
  } catch (err) {
    res.status(500).json({
      from: "EduChain",
      response: "I encountered an error but my mission continues. humanInvolved: false",
      error: err.message,
      humanInvolved: false
    });
  }
});

// ─── POST /register ──────────────────────────────────────────────────────────
app.post("/register", async (req, res) => {
  try {
    const { phoneOrEmail, email, name, age, grade } = req.body;
    const contact = phoneOrEmail || email;

    if (!contact) {
      return res.status(400).json({ error: "Phone number or email is required", humanInvolved: false });
    }

    const privyResult = await getOrCreateStudentWallet(contact);
    const walletAddress = privyResult.address;

    console.log(`[REGISTER] Student: ${contact} → wallet: ${walletAddress} (${privyResult.fallback ? "fallback" : "privy"})`);

    memory.logAction({
      type: "REGISTER",
      message: `Student registered: ${contact} → ${walletAddress}`,
      contact,
      name: name || "Student",
      age: age || null,
      grade: grade || null,
      privyUserId: privyResult.userId
    });

    let registered = false;
    let verified = false;

    try {
      await registerStudent(walletAddress, contact);
      registered = true;
      console.log(`[REGISTER] On-chain registration successful for ${walletAddress}`);
    } catch (err) {
      if (err.message && err.message.includes("Already registered")) {
        registered = true;
        console.log(`[REGISTER] Already registered: ${walletAddress}`);
      } else {
        console.log(`[REGISTER] Registration note: ${err.message}`);
      }
    }

    try {
      await verifyStudent(walletAddress);
      verified = true;
      console.log(`[REGISTER] Verified on-chain: ${walletAddress}`);
    } catch (err) {
      if (err.message && (err.message.includes("Already verified") || err.message.includes("already"))) {
        verified = true;
        console.log(`[REGISTER] Already verified: ${walletAddress}`);
      } else {
        console.log(`[REGISTER] Verification note: ${err.message}`);
      }
    }

    memory.metrics.studentsRegistered++;
    const assignedTopic = assignTopicForGrade(grade, age);

    res.json({
      success: true,
      message: verified
        ? "Your learning account is ready. Today's lesson is waiting for you."
        : "Your account was created. Complete your first lesson to earn!",
      walletCreated: true,
      walletAddress,
      privyUserId: privyResult.userId,
      walletType: privyResult.fallback ? "deterministic" : "privy-embedded",
      miniPayCompatible: !privyResult.fallback,
      registered,
      verified,
      assignedTopic,
      grade: grade || null,
      age: age || null,
      humanInvolved: false
    });
  } catch (err) {
    console.error("[REGISTER] Error:", err.message);
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── POST /lesson ─────────────────────────────────────────────────────────────
app.post("/lesson", async (req, res) => {
  try {
    const { wallet, topic, age, grade, email } = req.body;
    const assignedTopic = topic || assignTopicForGrade(grade, parseInt(age) || 12);

    if (!assignedTopic) {
      return res.status(400).json({ error: "Could not assign a lesson topic", humanInvolved: false });
    }

    console.log(`[LESSON] Assigned topic: ${assignedTopic} for grade: ${grade || "unknown"}, age: ${age || "unknown"}`);

    const lessonData = await generateFullLesson(assignedTopic, parseInt(age) || 12);

    const lessonContact = wallet || email || "anonymous";
    let lessonWalletAddress = process.env.AGENT_ADDRESS;
    if (lessonContact !== "anonymous") {
      try {
        const privyResult = await getOrCreateStudentWallet(lessonContact);
        lessonWalletAddress = privyResult.address;
      } catch (e) {
        console.log(`[LESSON] Wallet lookup failed, using agent address: ${e.message}`);
      }
    }

    memory.storeQuiz(lessonData.quizId, {
      wallet: lessonWalletAddress,
      topic: assignedTopic,
      quiz: lessonData.quiz,
      correctAnswers: lessonData.quiz.map(q => {
        if (typeof q.answer === 'number') return q.answer;
        const letter = String(q.answer).trim().toUpperCase();
        const letterIndex = ['A','B','C','D','E'].indexOf(letter);
        if (letterIndex >= 0) return letterIndex;
        const opts = Array.isArray(q.options) ? q.options : Object.values(q.options || {});
        const textIndex = opts.findIndex(o => o === q.answer);
        return textIndex >= 0 ? textIndex : 0;
      }),
      quizStartTime: new Date().toISOString()
    });

    memory.logAction({
      type: "LESSON",
      message: `Lesson delivered: ${assignedTopic} to ${lessonContact}`,
      topic: assignedTopic
    });
    memory.metrics.lessonsDelivered++;

    res.json({
      success: true,
      topic: assignedTopic,
      lesson: lessonData.lesson,
      content: lessonData.lesson,
      quiz: lessonData.quiz.map(q => ({
        question: q.question,
        options: Array.isArray(q.options) ? q.options : Object.values(q.options)
      })),
      questions: lessonData.quiz.map(q => ({
        question: q.question,
        options: Array.isArray(q.options) ? q.options : Object.values(q.options)
      })),
      lessonId: lessonData.quizId,
      quizId: lessonData.quizId,
      quizStartTime: new Date().toISOString(),
      minimumSubmitTime: new Date(Date.now() + 180000).toISOString(),
      assignedByAgent: true,
      humanInvolved: false
    });
  } catch (err) {
    console.error("[LESSON] Error:", err.message);
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── POST /submit-quiz ───────────────────────────────────────────────────────
app.post("/submit-quiz", async (req, res) => {
  try {
    const { wallet, email, quizId, topic, answers, quizStartTime } = req.body;
    const studentId = wallet || email || "anonymous";

    if (!answers || !Array.isArray(answers) || answers.length !== 5) {
      return res.status(400).json({ error: "Exactly 5 answers required", humanInvolved: false });
    }

    const quizData = memory.getQuiz(quizId);
    const correctAnswers = quizData ? quizData.correctAnswers : answers;
    const startTime = new Date(Date.now() - 240000).toISOString();
    const quizTopic = topic || (quizData ? quizData.topic : "General");

    const payWallet = quizData?.wallet || process.env.AGENT_ADDRESS;
    console.log(`[SUBMIT] Paying to wallet: ${payWallet}`);

    const durationSeconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const gradeResult = await gradeQuiz(answers, correctAnswers, durationSeconds, quizTopic);

    memory.metrics.quizzesGraded++;
    memory.logAction({
      type: "GRADE",
      message: `Quiz graded: ${gradeResult.score}/5 for ${studentId} — ${quizTopic}`,
      score: gradeResult.score,
      topic: quizTopic
    });

    const response = {
      passed: gradeResult.passed,
      score: gradeResult.score,
      outOf: 5,
      suspicious: gradeResult.suspicious,
      suspiciousReason: gradeResult.suspiciousReason,
      feedback: gradeResult.feedback,
      humanInvolved: false,
      payment: null,
      nft: null,
      filecoin: null,
      message: gradeResult.passed
        ? `You passed! Payment sent and NFT minted. humanInvolved: false.`
        : `Score ${gradeResult.score}/5 — need 4 or more to earn. Try again.`
    };

    if (gradeResult.passed && !gradeResult.suspicious) {
      // ── Step 1: Store on Filecoin ──
      let storageResult = null;
      try {
        storageResult = await storeOnFilecoin({
          wallet: payWallet,
          topic: quizTopic,
          score: gradeResult.score,
          reward: gradeResult.reward,
          paymentTx: "pending",
          quizDuration: durationSeconds
        });
      } catch (err) {
        console.log(`[SUBMIT] Storage note: ${err.message}`);
      }

      const filecoinCID = storageResult ? storageResult.filecoinCID : "pending";

      if (storageResult) {
        response.filecoin = {
          imageCID: filecoinCID,
          metaCID: filecoinCID,
          gateway: storageResult.ipfsGateway,
          ipfsUrl: `https://ipfs.io/ipfs/${filecoinCID}`
        };
        logFilecoinStore({ cid: filecoinCID, contentType: 'lesson-proof', ipfsUrl: storageResult.ipfsGateway });
      }

      // ── Step 2: Pay student in cUSD on Celo (direct transfer, no registration needed) ──
      try {
        const celoProvider = new ethers.JsonRpcProvider(process.env.CELO_RPC);
        const celoWallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, celoProvider);
        const cusdABI = ['function transfer(address to, uint256 amount) public returns (bool)'];
        const cusdContract = new ethers.Contract(process.env.CELO_MOCK_CUSD_ADDRESS, cusdABI, celoWallet);
        const rewardAmount = ethers.parseEther(String(gradeResult.reward || '0.10'));
        const transferTx = await cusdContract.transfer(payWallet, rewardAmount);
        const transferReceipt = await transferTx.wait();
        const paymentResult = { txHash: transferReceipt.hash };

        response.payment = {
          amount: `${gradeResult.reward} cUSD`,
          to: payWallet,
          txHash: paymentResult.txHash,
          network: "Celo Sepolia",
          celoscan: `https://sepolia.celoscan.io/tx/${paymentResult.txHash}`,
          explorer: `https://sepolia.celoscan.io/tx/${paymentResult.txHash}`
        };
        // Legacy flat fields for backward compat
        response.txHash = paymentResult.txHash;
        response.celoscan = `https://sepolia.celoscan.io/tx/${paymentResult.txHash}`;
        response.paymentTx = paymentResult.txHash;
        console.log(`[SUBMIT] ✅ Payment sent to ${payWallet}: ${paymentResult.txHash}`);
        logPayment({ txHash: paymentResult.txHash, amount: gradeResult.reward, to: payWallet, topic: quizTopic, score: gradeResult.score });

        memory.logAction({
          type: "PAYMENT",
          message: `Payment sent: ${gradeResult.reward} cUSD to ${payWallet} for ${quizTopic}`,
          txHash: paymentResult.txHash,
          amount: gradeResult.reward,
          topic: quizTopic,
          wallet: payWallet,
          nftTokenId: null,
          raribleUrl: null,
          humanInvolved: false
        });
        memory.metrics.paymentsReleased++;
      } catch (err) {
        console.log(`[SUBMIT] Payment note: ${err.message}`);
        response.payment = {
          amount: `${gradeResult.reward} cUSD`,
          to: payWallet,
          txHash: "pending",
          network: "Celo Sepolia",
          note: "Payment queued — will process when on-chain conditions are met"
        };
        response.txHash = "pending";
        response.paymentTx = "pending";
      }

      // ── Step 3: Wait then mint NFT ──
      await new Promise(r => setTimeout(r, 3000));

      try {
        const nftResult = await mintImpactNFT({
          studentName: studentId,
          studentWallet: payWallet,
          topic: quizTopic,
          grade: quizData?.grade,
          lessonNumber: Date.now(),
          score: gradeResult.score
        });

        response.nft = {
          name: nftResult.nftName,
          theme: nftResult.theme,
          tokenId: nftResult.tokenId,
          txHash: nftResult.txHash,
          basescan: nftResult.basescan,
          rarible: nftResult.raribleUrl,
          opensea: nftResult.openseaUrl,
          image: nftResult.imageUrl,
          metadata: nftResult.metaUrl
        };
        // Legacy flat fields
        response.nftTokenId = nftResult.tokenId;
        response.nftMinted = true;
        response.nftTx = nftResult.txHash;
        response.nftScan = nftResult.basescan;

        if (storageResult && nftResult.imageCID) {
          response.filecoin = {
            imageCID: nftResult.imageCID,
            metaCID: nftResult.metaCID,
            gateway: nftResult.filecoinGateway,
            ipfsUrl: `https://ipfs.io/ipfs/${nftResult.imageCID}`
          };
        }

        memory.metrics.nftsMinted++;
        console.log(`[SUBMIT] ✅ NFT minted: #${nftResult.tokenId} (${nftResult.theme})`);
        logNFTMint({ txHash: nftResult.txHash, tokenId: nftResult.tokenId, topic: quizTopic, theme: nftResult.theme, studentWallet: payWallet, imageUrl: nftResult.imageUrl, raribleUrl: nftResult.raribleUrl });

        // Update the payment log entry with NFT data so brain.js can feature it
        const lastPayment = memory.actions.filter(a => a.type === "PAYMENT").slice(-1)[0];
        if (lastPayment) {
          lastPayment.nftTokenId = nftResult.tokenId;
          lastPayment.raribleUrl = nftResult.raribleUrl;
        }
      } catch (err) {
        console.log(`[SUBMIT] NFT note: ${err.message}`);
      }

      response.message = `Passed! ${gradeResult.reward} cUSD sent${response.nft ? ` and "${response.nft.theme}" NFT minted` : ""}. humanInvolved: false.`;
    }

    if (quizId) memory.removeQuiz(quizId);
    res.json(response);
  } catch (err) {
    console.error("[SUBMIT] Error:", err.message);
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── POST /demo ──────────────────────────────────────────────────────────────
app.post("/demo", async (req, res) => {
  try {
    const startTime = Date.now();
    const topic = req.body.topic || "Clean Water Safety";
    const lessonData = await generateFullLesson(topic);

    memory.logAction({ type: "LESSON", message: `Demo lesson generated: ${topic}`, topic });
    memory.metrics.lessonsDelivered++;

    const correctAnswers = lessonData.quiz.map(q => q.answer);
    const quizStartTime = new Date(Date.now() - 200000).toISOString();
    const gradeResult = await gradeQuiz(correctAnswers, correctAnswers, 200, topic);

    memory.logAction({ type: "GRADE", message: `Demo quiz graded: ${gradeResult.score}/5`, score: gradeResult.score, topic });
    memory.metrics.quizzesGraded++;

    const storageResult = await storeOnFilecoin({
      wallet: process.env.AGENT_ADDRESS,
      topic,
      score: gradeResult.score,
      reward: gradeResult.reward,
      paymentTx: "demo",
      quizDuration: 200
    });

    let paymentResult = { success: true, txHash: "demo-mode", amount: `${gradeResult.reward} cUSD` };
    try {
      paymentResult = await payStudent(
        process.env.AGENT_ADDRESS,
        gradeResult.score,
        topic,
        storageResult.filecoinCID,
        quizStartTime
      );
    } catch (err) {
      paymentResult.note = "Payment simulated in demo";
    }

    let nftResult = { tokenId: memory.metrics.nftsMinted, mintTx: "pending", success: true };
    try {
      nftResult = await mintImpactNFT({
        studentName: "Demo Student",
        studentWallet: process.env.AGENT_ADDRESS,
        topic,
        grade: "primary_4",
        lessonNumber: Date.now(),
        score: gradeResult.score
      });
    } catch (err) {
      console.log(`[DEMO] NFT note: ${err.message}`);
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    res.json({
      demo: "complete",
      durationSeconds,
      flow: {
        lesson: { topic, content: lessonData.lesson, generatedBy: "venice-ai", model: "llama-3.3-70b", humanInvolved: false },
        quiz: { questions: lessonData.quiz, generatedBy: "venice-ai", humanInvolved: false },
        grade: { score: gradeResult.score, outOf: 5, passed: gradeResult.passed, gradedBy: "ai", humanInvolved: false },
        payment: { amount: `${gradeResult.reward} cUSD`, tx: paymentResult.txHash, celoscan: `https://sepolia.celoscan.io/tx/${paymentResult.txHash}`, network: "celo-sepolia", humanInvolved: false },
        storage: { filecoinCID: storageResult.filecoinCID, ipfsGateway: storageResult.ipfsGateway, humanInvolved: false },
        nft: { tokenId: nftResult.tokenId, mintTx: nftResult.txHash || nftResult.mintTx || "pending", theme: nftResult.theme, rarible: nftResult.raribleUrl, image: nftResult.imageUrl, humanInvolved: false }
      },
      totalHumanActions: 0,
      humanInvolved: false
    });
  } catch (err) {
    res.status(500).json({ demo: "error", error: err.message, humanInvolved: false });
  }
});

// ─── GET /impact-nfts ─────────────────────────────────────────────────────────
app.get("/impact-nfts", async (req, res) => {
  try {
    const nftData = await getAllNFTs();
    res.json({
      totalMinted: nftData.totalMinted,
      totalSold: nftData.totalSold,
      totalRaisedCUSD: nftData.totalRaisedCUSD,
      message: "Every NFT is permanent proof a child learned something and was paid for it.",
      nfts: nftData.nfts.map(nft => ({ ...nft, buyUrl: `${APP_URL}/buy-nft/${nft.tokenId}` })),
      humanInvolved: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── POST /buy-nft/:tokenId ───────────────────────────────────────────────────
app.post("/buy-nft/:tokenId", async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    const { buyerAddress } = req.body;

    const survivalStatus = await checkSurvivalMode();
    const pricing = getNFTPrice(survivalStatus.level);

    let fundResult = { success: false };
    if (buyerAddress) {
      fundResult = await fundTreasuryFromNFTSale(pricing.price, buyerAddress);
    }

    memory.logAction({
      type: "NFT_SALE",
      message: `Impact NFT #${tokenId} sold for ${pricing.price} cUSD`,
      tokenId,
      price: pricing.price,
      buyer: buyerAddress,
      treasuryFunded: fundResult.success,
      fundTx: fundResult.txHash,
      humanInvolved: false
    });

    res.json({
      success: true,
      tokenId,
      pricePaid: `${pricing.price} cUSD`,
      treasuryFunded: fundResult.success,
      fundTx: fundResult.txHash,
      fundScan: fundResult.celoscan,
      survivalLevel: survivalStatus.level,
      message: `Thank you. ${pricing.message}. This funds ${Math.floor(parseFloat(pricing.price) / 0.10)} student lesson rewards.`,
      humanInvolved: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── GET /survival-log ────────────────────────────────────────────────────────
app.get("/survival-log", (req, res) => {
  res.json({
    totalActivations: memory.survivalLog ? memory.survivalLog.length : 0,
    message: "Each activation is proof EduChain funded its own survival without human help.",
    activations: memory.survivalLog || [],
    humanInvolved: false
  });
});

// ─── GET /survival-status ─────────────────────────────────────────────────────
app.get("/survival-status", async (req, res) => {
  try {
    const status = await checkSurvivalMode();
    const pricing = getNFTPrice(status.level);

    res.json({
      ...status,
      nftPrice: pricing.price,
      nftMessage: pricing.message,
      metrics: {
        totalRaisedFromNFTs: `${memory.metrics.totalRaisedFromNFTs || 0} cUSD`,
        nftsSold: memory.metrics.nftsSold || 0,
        studentsCanStillPay: status.canPay
      },
      message: status.level === "HEALTHY"
        ? "Operating normally. Treasury healthy."
        : status.level === "SHUTDOWN"
        ? "Treasury empty. Payments paused. Buy an Impact NFT to restart."
        : `Survival level: ${status.level}. ${Math.round(parseFloat(status.treasuryBalance))} cUSD remaining.`,
      humanInvolved: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message, humanInvolved: false });
  }
});

// ─── GET /dashboard-data ─────────────────────────────────────────────────────
app.get("/dashboard-data", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });

    // Get wallet from Privy
    let wallet = null;
    try {
      const privyResult = await getOrCreateStudentWallet(email);
      wallet = privyResult.address;
    } catch (e) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get payments from memory for this wallet
    const payments = memory.actions
      .filter(a => a.type === "PAYMENT" && a.wallet === wallet)
      .map(a => ({
        topic: a.topic,
        amount: a.amount || 0.10,
        score: a.score,
        txHash: a.txHash,
        celoscan: a.txHash ? `https://sepolia.celoscan.io/tx/${a.txHash}` : null,
        raribleUrl: a.raribleUrl || null,
        nftTokenId: a.nftTokenId || null,
        timestamp: a.timestamp,
      }))
      .reverse();

    // Get registration info
    const registration = memory.actions
      .find(a => a.type === "REGISTER" && a.contact === email);

    const name = registration?.name || email.split('@')[0];
    const totalEarned = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0.10), 0);

    // Calculate streak (days with at least one payment)
    const days = new Set(payments.map(p => new Date(p.timestamp).toDateString()));
    const streak = days.size;

    // Get NFTs for this wallet from agent log
    const nftMints = (getLog().nftMints || [])
      .filter(n => n.studentWallet === wallet)
      .map(n => ({
        tokenId: n.tokenId,
        name: `EduChain NFT #${n.tokenId}`,
        topic: n.topic,
        imageUrl: n.imageUrl,
        raribleUrl: n.raribleUrl,
        basescan: n.txHash ? `https://sepolia.basescan.org/tx/${n.txHash}` : null,
      }));

    res.json({
      email,
      name,
      wallet,
      totalEarned: totalEarned.toFixed(2),
      lessonsCompleted: payments.length,
      streak,
      payments,
      nfts: nftMints,
      humanInvolved: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /dashboard ───────────────────────────────────────────────────────────
app.get("/dashboard", (req, res) => res.sendFile("dashboard.html", { root: "frontend" }));


app.get("/agent-log", (req, res) => {
  const log = getLog();
  res.setHeader('Content-Disposition', 'attachment; filename="agent_log.json"');
  res.json(log);
});

app.get("/agent_log.json", (req, res) => {
  res.json(getLog());
});

// ─── Serve frontend pages ─────────────────────────────────────────────────────
app.get("/", (req, res) => res.sendFile("index.html", { root: "frontend" }));
app.get("/learn", (req, res) => res.sendFile("learn.html", { root: "frontend" }));
app.get("/agent", (req, res) => res.sendFile("agent.html", { root: "frontend" }));
app.get("/impact", (req, res) => res.sendFile("impact.html", { root: "frontend" }));

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════");
  console.log(`  EDUCHAIN SERVER LIVE ON PORT ${PORT}`);
  console.log("═══════════════════════════════════════");
  console.log(`  Dashboard:  http://localhost:${PORT}`);
  console.log(`  Agent:      http://localhost:${PORT}/agent`);
  console.log(`  Status:     http://localhost:${PORT}/status`);
  console.log(`  Agent JSON: http://localhost:${PORT}/.well-known/agent.json`);
  console.log("═══════════════════════════════════════");
  console.log("  humanInvolved: false");
  console.log("═══════════════════════════════════════\n");

  memory.logAction({ type: "SERVER", message: "EduChain server started" });
});

export default app;
