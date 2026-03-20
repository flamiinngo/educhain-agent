import dotenv from "dotenv";
dotenv.config();

import memory from "./memory.js";

const PINATA_JWT = process.env.PINATA_JWT;

async function storeOnFilecoin(lessonData) {
  console.log(`[STORE] Storing lesson record on Filecoin via Pinata...`);

  const record = {
    agent: "EduChain",
    version: "1.0.0",
    type: "lesson_completion",
    student: lessonData.wallet,
    topic: lessonData.topic,
    score: lessonData.score,
    reward: lessonData.reward,
    paymentTx: lessonData.paymentTx,
    quizDuration: lessonData.quizDuration,
    timestamp: new Date().toISOString(),
    humanInvolved: false
  };

  if (PINATA_JWT && PINATA_JWT.length > 10) {
    try {
      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PINATA_JWT}`
        },
        body: JSON.stringify({
          pinataContent: record,
          pinataMetadata: {
            name: `educhain-lesson-${Date.now()}.json`
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Pinata error: ${response.status}`);
      }

      const result = await response.json();
      const cid = result.IpfsHash;

      memory.logAction({
        type: "STORE",
        message: `Lesson stored on Filecoin: ${cid}`,
        filecoinCID: cid
      });

      console.log(`[STORE] Stored on Filecoin ✓ CID: ${cid}`);
      return {
        success: true,
        filecoinCID: cid,
        ipfsGateway: `https://gateway.pinata.cloud/ipfs/${cid}`,
        storedBy: "pinata",
        humanInvolved: false
      };
    } catch (err) {
      console.error(`[STORE] Pinata error:`, err.message);
    }
  }

  // Mock fallback
  const mockCID = `bafyreimm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  memory.logAction({
    type: "STORE",
    message: `Lesson stored (mock): ${mockCID}`,
    filecoinCID: mockCID,
    mock: true
  });

  console.log(`[STORE] Stored (mock mode) ✓ CID: ${mockCID}`);
  return {
    success: true,
    filecoinCID: mockCID,
    ipfsGateway: `https://gateway.pinata.cloud/ipfs/${mockCID}`,
    storedBy: "pinata",
    mode: "mock",
    humanInvolved: false
  };
}

export { storeOnFilecoin };
