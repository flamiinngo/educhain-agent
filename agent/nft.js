// agent/nft.js — EduChain Impact NFT
// Every NFT is unique generative art anchored to the student's lesson topic.
// Art is stored on Filecoin (Pinata), then minted on-chain.
// Compatible with Rarible/SuperRare display via standard ERC-721 metadata.

import { ethers } from 'ethers';
import fetch from 'node-fetch';

const PINATA_JWT = process.env.PINATA_JWT;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const BASE_RPC = process.env.BASE_RPC_TESTNET || 'https://sepolia.base.org';
const NFT_CONTRACT = process.env.IMPACT_NFT_ADDRESS || '0x14c5a01cE4FeF52fDc2C3B1c3761274ce37336DB';

const NFT_ABI = [
  'function mint(address to, string memory tokenURI) public returns (uint256)',
  'function tokenURI(uint256 tokenId) public view returns (string memory)',
  'function totalSupply() public view returns (uint256)',
];

// ─── Generative art engine ────────────────────────────────────────────────────
// Each topic maps to a palette + shape system. The result is always unique
// because we seed with timestamp + student wallet address.

const TOPIC_THEMES = {
  mathematics: {
    name: 'Sacred Geometry',
    colors: ['#6C3CE1', '#9B59F5', '#C9A7FF', '#1A0840', '#E8D5FF'],
    accent: '#FFD700',
    shapes: 'geometric',
    description: 'Infinite patterns of numbers made visible',
  },
  science: {
    name: 'Quantum Field',
    colors: ['#00C9A7', '#007AFF', '#00FFD1', '#001A2C', '#80FFEA'],
    accent: '#FF6B35',
    shapes: 'orbital',
    description: 'The invisible forces that hold the universe together',
  },
  reading: {
    name: 'Story Constellation',
    colors: ['#FF6B6B', '#FF8E53', '#FFC75F', '#1C0A00', '#FFE8CC'],
    accent: '#E040FB',
    shapes: 'flowing',
    description: 'Words become worlds, sentences become stars',
  },
  history: {
    name: 'Time River',
    colors: ['#C9A96E', '#8B6914', '#FFD89B', '#1A1000', '#FFF5DC'],
    accent: '#FF4444',
    shapes: 'layered',
    description: 'Every moment a layer in the sediment of time',
  },
  geography: {
    name: 'Terra Signal',
    colors: ['#2ECC71', '#27AE60', '#A8E6CF', '#001A08', '#D4F5E0'],
    accent: '#3498DB',
    shapes: 'topographic',
    description: 'The earth as data, continents as code',
  },
  english: {
    name: 'Syntax Wave',
    colors: ['#3498DB', '#2980B9', '#85C1E9', '#00111A', '#D6EAF8'],
    accent: '#E74C3C',
    shapes: 'wave',
    description: 'Language flows like water finding its own level',
  },
  civic: {
    name: 'Voice Web',
    colors: ['#E74C3C', '#C0392B', '#F1948A', '#1A0000', '#FADBD8'],
    accent: '#F1C40F',
    shapes: 'network',
    description: 'Every voice a node in the network of democracy',
  },
  health: {
    name: 'Life Pulse',
    colors: ['#1ABC9C', '#16A085', '#76D7C4', '#001A14', '#D1F2EB'],
    accent: '#E91E63',
    shapes: 'pulse',
    description: 'The rhythm that connects all living things',
  },
};

function getTheme(topic) {
  const t = (topic || '').toLowerCase();
  for (const [key, theme] of Object.entries(TOPIC_THEMES)) {
    if (t.includes(key)) return theme;
  }
  // Default: cosmic
  return {
    name: 'Cosmic Signal',
    colors: ['#8E24AA', '#4A148C', '#CE93D8', '#0D0015', '#F3E5F5'],
    accent: '#FFD600',
    shapes: 'cosmic',
    description: 'Knowledge radiating outward into the void',
  };
}

function seededRandom(seed) {
  // Simple deterministic PRNG so same seed = same art
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateSVG({ topic, studentName, grade, lessonNumber, walletAddress, timestamp }) {
  const theme = getTheme(topic);
  const seed = parseInt(walletAddress.slice(2, 10), 16) ^ timestamp;
  const rng = seededRandom(seed);

  const W = 800;
  const H = 800;

  const c = theme.colors;
  const bg = c[3];       // darkest = background
  const primary = c[0];
  const secondary = c[1];
  const light = c[2];
  const pale = c[4];
  const accent = theme.accent;

  let shapes = '';

  if (theme.shapes === 'geometric') {
    // Rotating nested polygons — mathematics
    for (let i = 0; i < 7; i++) {
      const sides = 3 + i;
      const r = 60 + i * 55;
      const rot = rng() * 360;
      const opacity = 0.12 + rng() * 0.25;
      const pts = Array.from({ length: sides }, (_, k) => {
        const angle = (k / sides) * Math.PI * 2 + (rot * Math.PI) / 180;
        return `${W / 2 + r * Math.cos(angle)},${H / 2 + r * Math.sin(angle)}`;
      }).join(' ');
      const col = i % 2 === 0 ? primary : secondary;
      shapes += `<polygon points="${pts}" fill="none" stroke="${col}" stroke-width="${1.5 - i * 0.15}" opacity="${opacity}"/>`;
    }
    // Central radiant lines
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const len = 80 + rng() * 200;
      const x2 = W / 2 + len * Math.cos(angle);
      const y2 = H / 2 + len * Math.sin(angle);
      shapes += `<line x1="${W / 2}" y1="${H / 2}" x2="${x2}" y2="${y2}" stroke="${accent}" stroke-width="0.5" opacity="0.3"/>`;
    }
    // Scattered dots
    for (let i = 0; i < 80; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const r = rng() * 3;
      shapes += `<circle cx="${x}" cy="${y}" r="${r}" fill="${light}" opacity="${0.2 + rng() * 0.5}"/>`;
    }
  } else if (theme.shapes === 'orbital') {
    // Orbital rings — science
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 6; i++) {
      const rx = 60 + i * 60;
      const ry = 30 + i * 28;
      const rot = i * 30 + rng() * 15;
      shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${i % 2 === 0 ? primary : secondary}" stroke-width="1" opacity="${0.15 + i * 0.04}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    }
    // Particles on orbits
    for (let i = 0; i < 5; i++) {
      const rx = 80 + i * 65;
      const ry = 35 + i * 30;
      const rot = i * 30;
      const angle = rng() * Math.PI * 2;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      shapes += `<circle cx="${px}" cy="${py}" r="6" fill="${accent}" opacity="0.9"/>`;
      shapes += `<circle cx="${px}" cy="${py}" r="12" fill="${accent}" opacity="0.2"/>`;
    }
    // Grid of dots
    for (let x = 50; x < W; x += 40) {
      for (let y = 50; y < H; y += 40) {
        const s = rng();
        if (s > 0.85) {
          shapes += `<circle cx="${x}" cy="${y}" r="${1 + rng() * 2}" fill="${light}" opacity="0.4"/>`;
        }
      }
    }
  } else if (theme.shapes === 'flowing') {
    // Bezier wave fields — reading/language
    for (let i = 0; i < 12; i++) {
      const y = 80 + i * 55;
      const amp = 20 + rng() * 40;
      const freq = 0.008 + rng() * 0.006;
      let d = `M 0 ${y}`;
      for (let x = 0; x <= W; x += 20) {
        const cy1 = y + amp * Math.sin(x * freq + rng() * 2);
        const cy2 = y + amp * Math.sin((x + 10) * freq + rng() * 2);
        d += ` C ${x} ${cy1} ${x + 10} ${cy2} ${x + 20} ${y + amp * Math.sin((x + 20) * freq)}`;
      }
      const col = i % 3 === 0 ? primary : i % 3 === 1 ? secondary : light;
      shapes += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.2" opacity="${0.12 + rng() * 0.3}"/>`;
    }
    // Scattered sparks
    for (let i = 0; i < 60; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const s = rng() * 4 + 1;
      shapes += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${accent}" opacity="${0.3 + rng() * 0.5}" transform="rotate(45 ${x + s / 2} ${y + s / 2})"/>`;
    }
  } else if (theme.shapes === 'topographic') {
    // Contour lines — geography
    for (let i = 0; i < 10; i++) {
      const cx = W * (0.2 + rng() * 0.6);
      const cy = H * (0.2 + rng() * 0.6);
      for (let j = 1; j < 7; j++) {
        const rx = j * (30 + rng() * 20);
        const ry = rx * (0.5 + rng() * 0.7);
        const rot = rng() * 180;
        const col = j % 2 === 0 ? primary : secondary;
        shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${col}" stroke-width="0.8" opacity="${0.08 + rng() * 0.2}" transform="rotate(${rot} ${cx} ${cy})"/>`;
      }
    }
    // Dot field
    for (let i = 0; i < 100; i++) {
      const x = rng() * W;
      const y = rng() * H;
      shapes += `<circle cx="${x}" cy="${y}" r="${rng() * 2}" fill="${accent}" opacity="${rng() * 0.4}"/>`;
    }
  } else if (theme.shapes === 'network') {
    // Node network — civic/social
    const nodes = Array.from({ length: 18 }, () => ({
      x: 80 + rng() * (W - 160),
      y: 80 + rng() * (H - 160),
      r: 4 + rng() * 8,
    }));
    // Edges
    nodes.forEach((n, i) => {
      nodes.forEach((m, j) => {
        if (j <= i) return;
        const dist = Math.hypot(n.x - m.x, n.y - m.y);
        if (dist < 200) {
          const op = (1 - dist / 200) * 0.4;
          shapes += `<line x1="${n.x}" y1="${n.y}" x2="${m.x}" y2="${m.y}" stroke="${secondary}" stroke-width="0.8" opacity="${op}"/>`;
        }
      });
    });
    // Nodes
    nodes.forEach((n) => {
      shapes += `<circle cx="${n.x}" cy="${n.y}" r="${n.r * 2}" fill="${primary}" opacity="0.15"/>`;
      shapes += `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${accent}" opacity="0.85"/>`;
    });
  } else if (theme.shapes === 'pulse') {
    // Pulse / heartbeat — health
    for (let i = 0; i < 8; i++) {
      const y = H / 2 + (i - 4) * 60;
      const amp = 20 + rng() * 50;
      const phase = rng() * W;
      let d = `M 0 ${y}`;
      for (let x = 0; x <= W; x += 5) {
        const pulse = amp * Math.exp(-Math.pow((x - phase) / 60, 2)) * Math.sin((x - phase) * 0.15);
        d += ` L ${x} ${y + pulse}`;
      }
      const col = i % 2 === 0 ? primary : secondary;
      shapes += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${i === 4 ? 2 : 0.8}" opacity="${0.15 + rng() * 0.35}"/>`;
    }
    // Central dot burst
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const r = 100 + rng() * 200;
      const x = W / 2 + r * Math.cos(angle);
      const y = H / 2 + r * Math.sin(angle);
      shapes += `<circle cx="${x}" cy="${y}" r="${1 + rng() * 3}" fill="${accent}" opacity="${0.3 + rng() * 0.5}"/>`;
    }
  } else {
    // cosmic — default
    for (let i = 0; i < 120; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const r = rng() * 2.5;
      const op = 0.2 + rng() * 0.7;
      const col = rng() > 0.7 ? accent : rng() > 0.5 ? primary : light;
      shapes += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${op}"/>`;
    }
    // Nebula ring
    for (let i = 0; i < 5; i++) {
      const cx = 150 + rng() * 500;
      const cy = 150 + rng() * 500;
      const r = 60 + rng() * 120;
      shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${primary}" stroke-width="1" opacity="${0.05 + rng() * 0.12}"/>`;
    }
  }

  // ── Border frame ──
  const frame = `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${light}" stroke-width="0.5" opacity="0.3" rx="4"/>`;

  // ── Central glow ──
  const glow = `
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
    </radialGradient>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>`;

  // ── Text labels ──
  const shortWallet = walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4);
  const shortTopic = (topic || 'Learning').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const labels = `
    <text x="40" y="64" font-family="monospace" font-size="11" fill="${pale}" opacity="0.5" letter-spacing="2">EDUCHAIN IMPACT NFT #${lessonNumber}</text>
    <text x="40" y="${H - 80}" font-family="monospace" font-size="22" font-weight="bold" fill="${pale}" opacity="0.95">${shortTopic}</text>
    <text x="40" y="${H - 54}" font-family="monospace" font-size="12" fill="${light}" opacity="0.7">${theme.description}</text>
    <text x="40" y="${H - 30}" font-family="monospace" font-size="10" fill="${pale}" opacity="0.35">${shortWallet} · ${grade?.replace(/_/g, ' ') || 'student'}</text>
    <text x="${W - 40}" y="${H - 30}" font-family="monospace" font-size="10" fill="${accent}" opacity="0.6" text-anchor="end">humanInvolved: false</text>`;

  // ── Accent corner mark ──
  const corner = `<rect x="${W - 60}" y="32" width="8" height="8" fill="${accent}" opacity="0.8"/>
    <rect x="${W - 46}" y="32" width="8" height="8" fill="${accent}" opacity="0.4"/>
    <rect x="${W - 32}" y="32" width="8" height="8" fill="${accent}" opacity="0.2"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${glow.split('</radialGradient>')[0]}</radialGradient></defs>
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${glow.split('</radialGradient>')[1]}
  ${shapes}
  ${frame}
  ${corner}
  ${labels}
</svg>`;
}

// ─── Upload SVG to Filecoin via Pinata ───────────────────────────────────────

async function uploadToFilecoin(svgContent, name) {
  const blob = Buffer.from(svgContent, 'utf-8');
  const formData = new FormData();
  formData.append('file', new Blob([blob], { type: 'image/svg+xml' }), `${name}.svg`);
  formData.append('pinataMetadata', JSON.stringify({ name }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });
  const data = await res.json();
  if (!data.IpfsHash) throw new Error('Pinata upload failed: ' + JSON.stringify(data));
  return data.IpfsHash;
}

async function uploadMetadata(metadata) {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: metadata.name },
    }),
  });
  const data = await res.json();
  if (!data.IpfsHash) throw new Error('Pinata metadata upload failed: ' + JSON.stringify(data));
  return data.IpfsHash;
}

// ─── Mint NFT on-chain ────────────────────────────────────────────────────────

async function mintNFT(toAddress, tokenURI) {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(NFT_CONTRACT, NFT_ABI, wallet);

  const tx = await contract.mint(toAddress, tokenURI);
  const receipt = await tx.wait();

  // Get token ID from Transfer event
  const transferEvent = receipt.logs.find(
    (log) => log.topics[0] === ethers.id('Transfer(address,address,uint256)')
  );
  const tokenId = transferEvent ? parseInt(transferEvent.topics[3], 16) : null;

  return {
    txHash: receipt.hash,
    tokenId,
    basescan: `https://sepolia.basescan.org/tx/${receipt.hash}`,
    raribleUrl: tokenId
      ? `https://testnet.rarible.com/token/base/${NFT_CONTRACT}:${tokenId}`
      : null,
    openseaUrl: tokenId
      ? `https://testnets.opensea.io/assets/base-sepolia/${NFT_CONTRACT}/${tokenId}`
      : null,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function mintImpactNFT({ studentName, studentWallet, topic, grade, lessonNumber, score }) {
  const timestamp = Math.floor(Date.now() / 1000);

  // 1. Generate unique art
  const svgContent = generateSVG({
    topic,
    studentName,
    grade,
    lessonNumber: lessonNumber || timestamp,
    walletAddress: studentWallet || '0x0000000000000000000000000000000000000000',
    timestamp,
  });

  const theme = getTheme(topic);
  const nftName = `EduChain: ${theme.name} #${lessonNumber || timestamp}`;
  const safeFilename = nftName.replace(/[^a-zA-Z0-9-_]/g, '_');

  // 2. Upload art to Filecoin
  const imageCID = await uploadToFilecoin(svgContent, safeFilename);
  const imageUri = `ipfs://${imageCID}`;

  // 3. Build metadata (OpenSea / Rarible standard)
  const metadata = {
    name: nftName,
    description: `${theme.description}. Earned by completing a ${topic} lesson on EduChain. humanInvolved: false.`,
    image: imageUri,
    external_url: 'https://educhain-agent.up.railway.app',
    attributes: [
      { trait_type: 'Topic', value: topic || 'General' },
      { trait_type: 'Grade', value: grade || 'Unknown' },
      { trait_type: 'Score', value: score || 0 },
      { trait_type: 'Student', value: studentName || 'Anonymous' },
      { trait_type: 'Art Style', value: theme.name },
      { trait_type: 'Human Involved', value: 'false' },
      { trait_type: 'Lesson Number', value: lessonNumber || 0 },
    ],
  };

  // 4. Upload metadata to Filecoin
  const metaCID = await uploadMetadata(metadata);
  const tokenURI = `ipfs://${metaCID}`;

  // 5. Mint on-chain
  const mintTarget = studentWallet || '0xe5aF78bf87C3FfB7c9f74A1c450AAfC19227b141';
  const mintResult = await mintNFT(mintTarget, tokenURI);

  return {
    ...mintResult,
    imageCID,
    metaCID,
    tokenURI,
    imageUrl: `https://ipfs.io/ipfs/${imageCID}`,
    metaUrl: `https://ipfs.io/ipfs/${metaCID}`,
    filecoinGateway: `https://ipfs.io/ipfs/${imageCID}`,
    nftName,
    theme: theme.name,
    humanInvolved: false,
  };
}
