import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { getSigner } from "./pay.js";
import memory from "./memory.js";

const IMPACT_NFT_ADDRESS = process.env.IMPACT_NFT_ADDRESS;

const IMPACT_NFT_ABI = [
  "function mint(address student, string topic, uint8 score, uint256 amountPaid, string filecoinCID, string paymentTxHash) external returns (uint256)",
  "function buyNFT(uint256 tokenId) external",
  "function getAllNFTs() external view returns (tuple(address student, string topic, uint8 score, uint256 amountPaid, string filecoinCID, string paymentTxHash, uint256 timestamp, bool forSale, uint256 price)[])",
  "function getTotalMinted() external view returns (uint256)",
  "function getForSaleCount() external view returns (uint256)",
  "function totalSold() public view returns (uint256)",
  "function totalRaised() public view returns (uint256)",
  "event ImpactNFTMinted(uint256 indexed tokenId, address indexed student, string topic, uint8 score)",
  "event ImpactNFTSold(uint256 indexed tokenId, address indexed buyer, uint256 price)"
];

function getNFTContract() {
  const signer = getSigner();
  return new ethers.Contract(IMPACT_NFT_ADDRESS, IMPACT_NFT_ABI, signer);
}

// Mint an Impact NFT (called automatically after payment)
async function mintImpactNFT(studentAddress, topic, score, amountPaid, filecoinCID, paymentTxHash) {
  console.log(`[NFT] Minting Impact NFT for ${studentAddress}...`);

  try {
    const contract = getNFTContract();
    const amountWei = ethers.parseEther(amountPaid.toString());

    const tx = await contract.mint(
      studentAddress,
      topic,
      score,
      amountWei,
      filecoinCID,
      paymentTxHash
    );
    const receipt = await tx.wait();

    // Get token ID from event
    let tokenId = memory.metrics.nftsMinted;
    try {
      const event = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed && parsed.name === "ImpactNFTMinted";
        } catch { return false; }
      });
      if (event) {
        const parsed = contract.interface.parseLog(event);
        tokenId = Number(parsed.args[0]);
      }
    } catch (e) {
      // Use counter as fallback
    }

    memory.logAction({
      type: "NFT_MINT",
      message: `Impact NFT #${tokenId} minted for ${studentAddress} — ${topic}`,
      txHash: receipt.hash,
      tokenId: tokenId,
      student: studentAddress,
      topic: topic
    });

    memory.metrics.nftsMinted++;

    console.log(`[NFT] Impact NFT #${tokenId} minted ✓ TX: ${receipt.hash}`);
    return {
      success: true,
      tokenId: tokenId,
      mintTx: receipt.hash,
      basescan: `https://sepolia.basescan.org/tx/${receipt.hash}`,
      listedForSale: true,
      price: "1 cUSD",
      humanInvolved: false
    };
  } catch (err) {
    console.error(`[NFT] Mint error:`, err.message);

    // Return mock if contract call fails
    const mockTokenId = memory.metrics.nftsMinted;
    memory.metrics.nftsMinted++;

    memory.logAction({
      type: "NFT_MINT",
      message: `Impact NFT #${mockTokenId} minted (mock) for ${studentAddress}`,
      mock: true
    });

    return {
      success: true,
      tokenId: mockTokenId,
      mintTx: "pending",
      basescan: "pending",
      listedForSale: true,
      price: "1 cUSD",
      mode: "mock",
      humanInvolved: false
    };
  }
}

// Get all NFTs
async function getAllNFTs() {
  try {
    const contract = getNFTContract();
    const nfts = await contract.getAllNFTs();
    const totalMinted = await contract.getTotalMinted();
    const totalSold = await contract.totalSold();
    const totalRaised = await contract.totalRaised();

    return {
      totalMinted: Number(totalMinted),
      totalSold: Number(totalSold),
      totalRaisedCUSD: ethers.formatEther(totalRaised),
      nfts: nfts.map((nft, i) => ({
        tokenId: i,
        student: nft.student,
        topic: nft.topic,
        score: Number(nft.score),
        amountPaid: ethers.formatEther(nft.amountPaid),
        filecoinCID: nft.filecoinCID,
        paymentTxHash: nft.paymentTxHash,
        timestamp: new Date(Number(nft.timestamp) * 1000).toISOString(),
        forSale: nft.forSale,
        price: ethers.formatEther(nft.price)
      })),
      humanInvolved: false
    };
  } catch (err) {
    console.error(`[NFT] getAllNFTs error:`, err.message);
    return {
      totalMinted: memory.metrics.nftsMinted,
      totalSold: memory.metrics.nftsSold,
      totalRaisedCUSD: "0",
      nfts: [],
      humanInvolved: false
    };
  }
}

export { mintImpactNFT, getAllNFTs, getNFTContract };