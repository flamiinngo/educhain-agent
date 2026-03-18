import { callAI } from "./teach.js";
import { storeOnFilecoin } from "./store.js";

// ─── GENERATE UNIQUE NFT ART FOR EACH LESSON ───
// Each Impact NFT gets a unique SVG generated from the lesson topic
// This is what makes them art, not just receipts

const SUBJECT_PALETTES = {
  "math":      { bg: "#0a0f1e", primary: "#4db8ff", secondary: "#7ee8fa", accent: "#1a3a5c" },
  "science":   { bg: "#0a1a0a", primary: "#22c97a", secondary: "#7effa0", accent: "#0d3320" },
  "health":    { bg: "#1a0a0a", primary: "#ff6b6b", secondary: "#ffa07a", accent: "#3a1010" },
  "water":     { bg: "#0a0f2e", primary: "#4fc3f7", secondary: "#b3e5fc", accent: "#0d2040" },
  "history":   { bg: "#1a1200", primary: "#c9a84c", secondary: "#ffe082", accent: "#3a2a00" },
  "english":   { bg: "#1a0a1a", primary: "#ce93d8", secondary: "#f3e5f5", accent: "#2d0030" },
  "economics": { bg: "#0f1a0f", primary: "#81c784", secondary: "#c8e6c9", accent: "#1b3a1b" },
  "default":   { bg: "#0d1117", primary: "#1db954", secondary: "#69db8e", accent: "#0a2010" }
};

function getPalette(topic) {
  const t = topic.toLowerCase();
  if (t.includes("math") || t.includes("fraction") || t.includes("algebra") || t.includes("number")) return SUBJECT_PALETTES.math;
  if (t.includes("science") || t.includes("physics") || t.includes("chemistry") || t.includes("biology")) return SUBJECT_PALETTES.science;
  if (t.includes("health") || t.includes("body") || t.includes("hygiene")) return SUBJECT_PALETTES.health;
  if (t.includes("water") || t.includes("ecosystem") || t.includes("climate") || t.includes("solar")) return SUBJECT_PALETTES.water;
  if (t.includes("history") || t.includes("civic") || t.includes("government")) return SUBJECT_PALETTES.history;
  if (t.includes("english") || t.includes("reading") || t.includes("writing") || t.includes("literature")) return SUBJECT_PALETTES.english;
  if (t.includes("economics") || t.includes("finance") || t.includes("business")) return SUBJECT_PALETTES.economics;
  return SUBJECT_PALETTES.default;
}

// Generate a unique SVG artwork for a lesson
async function generateNFTArt(topic, score, studentAddress, lessonNumber) {
  const palette = getPalette(topic);
  const seed = lessonNumber || Date.now();

  // Get a poetic description from Venice AI
  let artDescription = "";
  try {
    const messages = [
      {
        role: "system",
        content: "You write brief, poetic descriptions for abstract digital art. One sentence, evocative, not literal. No hashtags."
      },
      {
        role: "user",
        content: `Write a one-sentence poetic description for a piece of digital art that represents a child learning about "${topic}" and earning their first money. The art is abstract, geometric, and uses light on dark backgrounds.`
      }
    ];
    artDescription = await callAI(messages);
  } catch (e) {
    artDescription = `A child proved they understood "${topic}" and the chain recorded it forever.`;
  }

  // Generate deterministic but unique visual elements based on seed
  const r = (n) => ((seed * 9301 + 49297 * n) % 233280) / 233280;

  const nodes = Array.from({ length: 12 }, (_, i) => ({
    x: 60 + r(i * 3) * 280,
    y: 60 + r(i * 3 + 1) * 280,
    r: 2 + r(i * 3 + 2) * 6,
    opacity: 0.3 + r(i) * 0.7
  }));

  const connections = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.sqrt(
        Math.pow(nodes[i].x - nodes[j].x, 2) +
        Math.pow(nodes[i].y - nodes[j].y, 2)
      );
      if (dist < 120) {
        connections.push({ i, j, opacity: (1 - dist / 120) * 0.4 });
      }
    }
  }

  const scoreRings = score >= 5 ? 3 : score >= 4 ? 2 : 1;

  const svg = `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.primary}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${palette.bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="400" fill="${palette.bg}"/>
  <rect width="400" height="400" fill="url(#glow)"/>

  <!-- Grid lines -->
  ${Array.from({ length: 8 }, (_, i) => `
  <line x1="${i * 57}" y1="0" x2="${i * 57}" y2="400" stroke="${palette.primary}" stroke-opacity="0.04" stroke-width="0.5"/>
  <line x1="0" y1="${i * 57}" x2="400" y2="${i * 57}" stroke="${palette.primary}" stroke-opacity="0.04" stroke-width="0.5"/>
  `).join("")}

  <!-- Constellation connections -->
  ${connections.map(c => `
  <line x1="${nodes[c.i].x}" y1="${nodes[c.i].y}" x2="${nodes[c.j].x}" y2="${nodes[c.j].y}"
    stroke="${palette.primary}" stroke-opacity="${c.opacity}" stroke-width="0.8"/>
  `).join("")}

  <!-- Nodes -->
  ${nodes.map((n, i) => `
  <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${palette.primary}" opacity="${n.opacity}"/>
  `).join("")}

  <!-- Central achievement rings -->
  ${Array.from({ length: scoreRings }, (_, i) => `
  <circle cx="200" cy="200" r="${40 + i * 22}" fill="none"
    stroke="${palette.primary}" stroke-opacity="${0.6 - i * 0.15}" stroke-width="${1.5 - i * 0.3}"/>
  `).join("")}

  <!-- Score dots -->
  ${Array.from({ length: score }, (_, i) => {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = 200 + Math.cos(angle) * 36;
    const y = 200 + Math.sin(angle) * 36;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${palette.primary}"/>`;
  }).join("")}

  <!-- Central mark -->
  <circle cx="200" cy="200" r="8" fill="${palette.primary}" opacity="0.9"/>
  <circle cx="200" cy="200" r="14" fill="none" stroke="${palette.primary}" stroke-width="1" opacity="0.5"/>

  <!-- Topic label -->
  <text x="200" y="360" text-anchor="middle"
    font-family="monospace" font-size="10" fill="${palette.primary}" opacity="0.6">
    ${topic.toUpperCase().slice(0, 24)}
  </text>

  <!-- Score -->
  <text x="200" y="378" text-anchor="middle"
    font-family="monospace" font-size="9" fill="${palette.primary}" opacity="0.4">
    ${score}/5 · humanInvolved: false
  </text>

  <!-- Corner marks -->
  <text x="16" y="24" font-family="monospace" font-size="8" fill="${palette.primary}" opacity="0.3">EDUCHAIN</text>
  <text x="384" y="24" text-anchor="end" font-family="monospace" font-size="8" fill="${palette.primary}" opacity="0.3">#${lessonNumber || "?"}</text>
</svg>`;

  return { svg, artDescription, palette };
}

// Generate NFT metadata with art
async function generateNFTMetadata(topic, score, studentAddress, lessonNumber, paymentTx, filecoinCID) {
  const { svg, artDescription, palette } = await generateNFTArt(topic, score, studentAddress, lessonNumber);

  // Store SVG on Filecoin
  let imageURI = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  try {
    const svgStored = await storeOnFilecoin({
      type: "nft-art",
      svg,
      topic,
      score,
      lessonNumber
    });
    if (svgStored?.ipfsGateway) imageURI = svgStored.ipfsGateway;
  } catch (e) {}

  const metadata = {
    name: `EduChain Impact NFT #${lessonNumber}`,
    description: artDescription,
    image: imageURI,
    attributes: [
      { trait_type: "Topic", value: topic },
      { trait_type: "Score", value: `${score}/5` },
      { trait_type: "Network", value: "Celo Sepolia" },
      { trait_type: "Payment TX", value: paymentTx || "pending" },
      { trait_type: "Filecoin CID", value: filecoinCID || "pending" },
      { trait_type: "Human Involved", value: "false" },
      { trait_type: "Agent", value: "EduChain" }
    ],
    external_url: "https://educhain-agent.up.railway.app",
    background_color: palette.bg.replace("#", "")
  };

  return metadata;
}

export { generateNFTArt, generateNFTMetadata };
