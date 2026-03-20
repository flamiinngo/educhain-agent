// agent/nft.js — EduChain Impact NFT
// Primary mint: Rare Protocol CLI (SuperRare track requirement)
// Fallback: direct Pinata + contract if CLI fails
// humanInvolved: false on every mint.

import { ethers } from 'ethers';
import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import fetch from 'node-fetch';

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const PINATA_JWT = process.env.PINATA_JWT;
const RARE_CONTRACT = process.env.RARE_CONTRACT || '0x9c3be85309BC9d6D258cb3f571B979eC5DC6ecB9';
const DIRECT_CONTRACT = process.env.IMPACT_NFT_ADDRESS || '0x94788e099CC76b21267E5458522Ebb6147A4A477';
const BASE_RPC = process.env.BASE_RPC_TESTNET || 'https://sepolia.base.org';

// ─── Theme engine ─────────────────────────────────────────────────────────────

const TOPIC_THEMES = {
  mathematics: { name: 'Sacred Geometry',    colors: ['#6C3CE1','#9B59F5','#C9A7FF','#1A0840','#E8D5FF'], accent: '#FFD700', shapes: 'geometric',    description: 'Infinite patterns of numbers made visible' },
  science:     { name: 'Quantum Field',       colors: ['#00C9A7','#007AFF','#00FFD1','#001A2C','#80FFEA'], accent: '#FF6B35', shapes: 'orbital',      description: 'The invisible forces that hold the universe together' },
  reading:     { name: 'Story Constellation', colors: ['#FF6B6B','#FF8E53','#FFC75F','#1C0A00','#FFE8CC'], accent: '#E040FB', shapes: 'flowing',     description: 'Words become worlds, sentences become stars' },
  history:     { name: 'Time River',          colors: ['#C9A96E','#8B6914','#FFD89B','#1A1000','#FFF5DC'], accent: '#FF4444', shapes: 'layered',     description: 'Every moment a layer in the sediment of time' },
  geography:   { name: 'Terra Signal',        colors: ['#2ECC71','#27AE60','#A8E6CF','#001A08','#D4F5E0'], accent: '#3498DB', shapes: 'topographic', description: 'The earth as data, continents as code' },
  english:     { name: 'Syntax Wave',         colors: ['#3498DB','#2980B9','#85C1E9','#00111A','#D6EAF8'], accent: '#E74C3C', shapes: 'wave',        description: 'Language flows like water finding its own level' },
  civic:       { name: 'Voice Web',           colors: ['#E74C3C','#C0392B','#F1948A','#1A0000','#FADBD8'], accent: '#F1C40F', shapes: 'network',     description: 'Every voice a node in the network of democracy' },
  health:      { name: 'Life Pulse',          colors: ['#1ABC9C','#16A085','#76D7C4','#001A14','#D1F2EB'], accent: '#E91E63', shapes: 'pulse',       description: 'The rhythm that connects all living things' },
};

function getTheme(topic) {
  const t = (topic || '').toLowerCase();
  for (const [key, theme] of Object.entries(TOPIC_THEMES)) {
    if (t.includes(key)) return theme;
  }
  return { name: 'Cosmic Signal', colors: ['#8E24AA','#4A148C','#CE93D8','#0D0015','#F3E5F5'], accent: '#FFD600', shapes: 'cosmic', description: 'Knowledge radiating outward into the void' };
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateSVG({ topic, studentName, grade, lessonNumber, walletAddress, timestamp }) {
  const theme = getTheme(topic);
  const seed = parseInt((walletAddress || '0x1234567890').slice(2, 10), 16) ^ timestamp;
  const rng = seededRandom(seed);
  const W = 800, H = 800;
  const [primary, secondary, light, bg, pale] = theme.colors;
  const accent = theme.accent;
  let shapes = '';

  if (theme.shapes === 'geometric') {
    for (let i = 0; i < 7; i++) {
      const sides = 3+i, r = 60+i*55, rot = rng()*360, op = 0.12+rng()*0.25;
      const pts = Array.from({length:sides},(_,k)=>{const a=(k/sides)*Math.PI*2+(rot*Math.PI/180);return `${W/2+r*Math.cos(a)},${H/2+r*Math.sin(a)}`;}).join(' ');
      shapes += `<polygon points="${pts}" fill="none" stroke="${i%2===0?primary:secondary}" stroke-width="${1.5-i*0.15}" opacity="${op}"/>`;
    }
    for (let i=0;i<24;i++){const a=(i/24)*Math.PI*2,len=80+rng()*200;shapes+=`<line x1="${W/2}" y1="${H/2}" x2="${W/2+len*Math.cos(a)}" y2="${H/2+len*Math.sin(a)}" stroke="${accent}" stroke-width="0.5" opacity="0.3"/>`;}
    for (let i=0;i<80;i++) shapes+=`<circle cx="${rng()*W}" cy="${rng()*H}" r="${rng()*3}" fill="${light}" opacity="${0.2+rng()*0.5}"/>`;
  } else if (theme.shapes === 'orbital') {
    for (let i=0;i<6;i++) shapes+=`<ellipse cx="${W/2}" cy="${H/2}" rx="${60+i*60}" ry="${30+i*28}" fill="none" stroke="${i%2===0?primary:secondary}" stroke-width="1" opacity="${0.15+i*0.04}" transform="rotate(${i*30+rng()*15} ${W/2} ${H/2})"/>`;
    for (let i=0;i<5;i++){const a=rng()*Math.PI*2,px=W/2+(80+i*65)*Math.cos(a),py=H/2+(35+i*30)*Math.sin(a);shapes+=`<circle cx="${px}" cy="${py}" r="6" fill="${accent}" opacity="0.9"/><circle cx="${px}" cy="${py}" r="12" fill="${accent}" opacity="0.2"/>`;}
    for(let x=50;x<W;x+=40)for(let y=50;y<H;y+=40)if(rng()>0.85)shapes+=`<circle cx="${x}" cy="${y}" r="${1+rng()*2}" fill="${light}" opacity="0.4"/>`;
  } else if (theme.shapes === 'flowing') {
    for(let i=0;i<12;i++){const y=80+i*55,amp=20+rng()*40,freq=0.008+rng()*0.006;let d=`M 0 ${y}`;for(let x=0;x<=W;x+=20)d+=` C ${x} ${y+amp*Math.sin(x*freq+rng()*2)} ${x+10} ${y+amp*Math.sin((x+10)*freq+rng()*2)} ${x+20} ${y+amp*Math.sin((x+20)*freq)}`;shapes+=`<path d="${d}" fill="none" stroke="${i%3===0?primary:i%3===1?secondary:light}" stroke-width="1.2" opacity="${0.12+rng()*0.3}"/>`;}
    for(let i=0;i<60;i++){const x=rng()*W,y=rng()*H,s=rng()*4+1;shapes+=`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${accent}" opacity="${0.3+rng()*0.5}" transform="rotate(45 ${x+s/2} ${y+s/2})"/>`;}
  } else if (theme.shapes === 'topographic') {
    for(let i=0;i<10;i++){const cx=W*(0.2+rng()*0.6),cy=H*(0.2+rng()*0.6);for(let j=1;j<7;j++){const rx=j*(30+rng()*20),ry=rx*(0.5+rng()*0.7);shapes+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${j%2===0?primary:secondary}" stroke-width="0.8" opacity="${0.08+rng()*0.2}" transform="rotate(${rng()*180} ${cx} ${cy})"/>`;}}
    for(let i=0;i<100;i++) shapes+=`<circle cx="${rng()*W}" cy="${rng()*H}" r="${rng()*2}" fill="${accent}" opacity="${rng()*0.4}"/>`;
  } else if (theme.shapes === 'network') {
    const nodes=Array.from({length:18},()=>({x:80+rng()*(W-160),y:80+rng()*(H-160),r:4+rng()*8}));
    nodes.forEach((n,i)=>nodes.forEach((m,j)=>{if(j<=i)return;const dist=Math.hypot(n.x-m.x,n.y-m.y);if(dist<200)shapes+=`<line x1="${n.x}" y1="${n.y}" x2="${m.x}" y2="${m.y}" stroke="${secondary}" stroke-width="0.8" opacity="${(1-dist/200)*0.4}"/>`;}));
    nodes.forEach(n=>{shapes+=`<circle cx="${n.x}" cy="${n.y}" r="${n.r*2}" fill="${primary}" opacity="0.15"/>`;shapes+=`<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${accent}" opacity="0.85"/>`;});
  } else if (theme.shapes === 'pulse') {
    for(let i=0;i<8;i++){const y=H/2+(i-4)*60,amp=20+rng()*50,phase=rng()*W;let d=`M 0 ${y}`;for(let x=0;x<=W;x+=5)d+=` L ${x} ${y+amp*Math.exp(-Math.pow((x-phase)/60,2))*Math.sin((x-phase)*0.15)}`;shapes+=`<path d="${d}" fill="none" stroke="${i%2===0?primary:secondary}" stroke-width="${i===4?2:0.8}" opacity="${0.15+rng()*0.35}"/>`;}
    for(let i=0;i<36;i++){const a=(i/36)*Math.PI*2,r=100+rng()*200;shapes+=`<circle cx="${W/2+r*Math.cos(a)}" cy="${H/2+r*Math.sin(a)}" r="${1+rng()*3}" fill="${accent}" opacity="${0.3+rng()*0.5}"/>`;}
  } else {
    for(let i=0;i<120;i++) shapes+=`<circle cx="${rng()*W}" cy="${rng()*H}" r="${rng()*2.5}" fill="${rng()>0.7?accent:rng()>0.5?primary:light}" opacity="${0.2+rng()*0.7}"/>`;
    for(let i=0;i<5;i++) shapes+=`<circle cx="${150+rng()*500}" cy="${150+rng()*500}" r="${60+rng()*120}" fill="none" stroke="${primary}" stroke-width="1" opacity="${0.05+rng()*0.12}"/>`;
  }

  const sw = (walletAddress||'0x000...000').slice(0,6)+'...'+(walletAddress||'0x000...000').slice(-4);
  const st = (topic||'Learning').replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${primary}" stop-opacity="0.25"/><stop offset="100%" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#g)"/>
  ${shapes}
  <rect x="20" y="20" width="${W-40}" height="${H-40}" fill="none" stroke="${light}" stroke-width="0.5" opacity="0.3" rx="4"/>
  <rect x="${W-60}" y="32" width="8" height="8" fill="${accent}" opacity="0.8"/><rect x="${W-46}" y="32" width="8" height="8" fill="${accent}" opacity="0.4"/><rect x="${W-32}" y="32" width="8" height="8" fill="${accent}" opacity="0.2"/>
  <text x="40" y="64" font-family="monospace" font-size="11" fill="${pale}" opacity="0.5" letter-spacing="2">EDUCHAIN IMPACT NFT #${lessonNumber}</text>
  <text x="40" y="${H-80}" font-family="monospace" font-size="22" font-weight="bold" fill="${pale}" opacity="0.95">${st}</text>
  <text x="40" y="${H-54}" font-family="monospace" font-size="12" fill="${light}" opacity="0.7">${theme.description}</text>
  <text x="40" y="${H-30}" font-family="monospace" font-size="10" fill="${pale}" opacity="0.35">${sw} - ${(grade||'student').replace(/_/g,' ')}</text>
  <text x="${W-40}" y="${H-30}" font-family="monospace" font-size="10" fill="${accent}" opacity="0.6" text-anchor="end">humanInvolved: false</text>
</svg>`;
}

// ─── Rare Protocol CLI mint ───────────────────────────────────────────────────

async function mintViaRareCLI({ svgContent, nftName, description, topic, grade, score, studentName, walletAddress }) {
  const tmpFile = join(tmpdir(), `educhain-${Date.now()}.svg`);
  writeFileSync(tmpFile, svgContent, 'utf-8');
  try {
    const args = [
      '@rareprotocol/rare-cli', 'mint',
      '--contract', RARE_CONTRACT,
      '--name', nftName,
      '--description', description,
      '--image', tmpFile,
      '--chain', 'base-sepolia', '--royalty-receiver', process.env.AGENT_ADDRESS,
      '--to', walletAddress || process.env.AGENT_ADDRESS,
      '--attribute', `topic=${topic||'General'}`,
      '--attribute', `grade=${grade||'Unknown'}`,
      '--attribute', `score=${score||0}`,
      '--attribute', `humanInvolved=false`,
    ];

    const result = spawnSync('npx', args, {
      encoding: 'utf-8',
      timeout: 120000,
      shell: true,
      env: { ...process.env },
    });

    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || `Exit code ${result.status}`);

    const output = (result.stdout || '') + (result.stderr || '');

    const tokenId  = output.match(/Token ID:\s*(\d+)/)?.[1] || null;
    const txHash   = output.match(/Transaction sent:\s*(0x[a-fA-F0-9]+)/)?.[1] || null;
    const metaCID  = output.match(/Metadata pinned:\s*ipfs:\/\/(\S+)/)?.[1] || null;
    const imageCID = output.match(/Upload complete:\s*ipfs:\/\/(\S+)/)?.[1] || null;

    if (!txHash && result.status !== 0) throw new Error('CLI failed: ' + (result.stderr || '').slice(0,100));

    console.log(`[NFT] Rare Protocol mint: Token #${tokenId} TX: ${txHash}`);
    return {
      tokenId, txHash, metaCID, imageCID,
      nftName, theme: getTheme(topic).name,
      basescan:        txHash   ? `https://sepolia.basescan.org/tx/${txHash}` : null,
      raribleUrl:      tokenId  ? `https://testnet.rarible.com/token/base/${RARE_CONTRACT}:${tokenId}` : null,
      openseaUrl:      tokenId  ? `https://testnets.opensea.io/assets/base-sepolia/${RARE_CONTRACT}/${tokenId}` : null,
      imageUrl:        imageCID ? `https://superrare.myfilebase.com/ipfs/${imageCID}` : null,
      metaUrl:         metaCID  ? `https://superrare.myfilebase.com/ipfs/${metaCID}` : null,
      filecoinGateway: imageCID ? `https://superrare.myfilebase.com/ipfs/${imageCID}` : null,
      mintTx: txHash, protocol: 'rare-protocol', humanInvolved: false,
    };
  } finally {
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch(e) {}
  }
}

// ─── Fallback: Pinata + direct contract ──────────────────────────────────────

async function mintDirectFallback({ svgContent, nftName, description, topic, grade, score, theme, studentWallet }) {
  const NFT_ABI = [
    'function mint(address student, string calldata topic, uint8 score, uint256 amountPaid, string calldata filecoinCID, string calldata paymentTxHash) external returns (uint256)'
  ];
  let imageCID = null, metaCID = null;

  try {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(svgContent,'utf-8')], {type:'image/svg+xml'}), nftName.replace(/\W/g,'_')+'.svg');
    fd.append('pinataMetadata', JSON.stringify({name:nftName}));
    const r1 = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {method:'POST',headers:{Authorization:`Bearer ${PINATA_JWT}`},body:fd});
    imageCID = (await r1.json()).IpfsHash;

    const meta = { name:nftName, description, image:`ipfs://${imageCID}`, attributes:[
      {trait_type:'Topic',value:topic||'General'},{trait_type:'Art Style',value:theme.name},
      {trait_type:'Grade',value:grade||'Unknown'},{trait_type:'Score',value:score||0},
      {trait_type:'Human Involved',value:'false'}
    ]};
    const r2 = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {method:'POST',headers:{Authorization:`Bearer ${PINATA_JWT}`,'Content-Type':'application/json'},body:JSON.stringify({pinataContent:meta,pinataMetadata:{name:nftName}})});
    metaCID = (await r2.json()).IpfsHash;
  } catch(e) { console.log(`[NFT] Pinata error: ${e.message}`); }

  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(DIRECT_CONTRACT, NFT_ABI, wallet);
  const tokenURI = metaCID ? `ipfs://${metaCID}` : `data:application/json,${encodeURIComponent(JSON.stringify({name:nftName}))}`;
  const target = studentWallet || process.env.AGENT_ADDRESS;
  let tx = await contract.mint(target, topic||'General', score||0, ethers.parseEther('0.10'), imageCID||'pending', 'pending');
  const receipt = await tx.wait();
  const log = receipt.logs.find(l=>l.topics[0]===ethers.id('Transfer(address,address,uint256)'));
  const tokenId = log ? parseInt(log.topics[3],16) : null;

  return {
    txHash: receipt.hash, mintTx: receipt.hash, tokenId,
    imageCID, metaCID, nftName, theme: theme.name,
    basescan:        `https://sepolia.basescan.org/tx/${receipt.hash}`,
    raribleUrl:      tokenId ? `https://testnet.rarible.com/token/base/${DIRECT_CONTRACT}:${tokenId}` : null,
    openseaUrl:      tokenId ? `https://testnets.opensea.io/assets/base-sepolia/${DIRECT_CONTRACT}/${tokenId}` : null,
    imageUrl:        imageCID ? `https://ipfs.io/ipfs/${imageCID}` : null,
    metaUrl:         metaCID  ? `https://ipfs.io/ipfs/${metaCID}`  : null,
    filecoinGateway: imageCID ? `https://ipfs.io/ipfs/${imageCID}` : null,
    protocol: 'direct', humanInvolved: false,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function mintImpactNFT({ studentName, studentWallet, topic, grade, lessonNumber, score }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const theme = getTheme(topic);
  const nftName = `EduChain: ${theme.name} #${lessonNumber || timestamp}`;
  const description = `${theme.description}. Earned by ${studentName||'a student'} completing a ${topic||'General'} lesson on EduChain. Score: ${score||0}/5. humanInvolved: false.`;
  const svgContent = generateSVG({
    topic, studentName, grade,
    lessonNumber: lessonNumber || timestamp,
    walletAddress: studentWallet || process.env.AGENT_ADDRESS,
    timestamp,
  });

  try {
    return await mintViaRareCLI({ svgContent, nftName, description, topic, grade, score, studentName, walletAddress: studentWallet });
  } catch (err) {
    console.log(`[NFT] Rare CLI failed (${err.message.slice(0,60)}), using fallback...`);
    console.log('[NFT] Fallback disabled - CLI is required'); return { txHash: null, tokenId: null, nftName, theme: theme.name, raribleUrl: null, humanInvolved: false };
  }
}

// ─── Get all minted NFTs ──────────────────────────────────────────────────────

export async function getAllNFTs() {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const abi = [
      'function totalSupply() public view returns (uint256)',
      'function tokenURI(uint256 tokenId) public view returns (string memory)',
    ];
    const contracts = [
      { address: RARE_CONTRACT,    label: 'rare',   gw: 'https://superrare.myfilebase.com/ipfs/' },
      { address: DIRECT_CONTRACT,  label: 'direct', gw: 'https://ipfs.io/ipfs/' },
    ];
    let allNFTs = [];
    for (const c of contracts) {
      try {
        const ct = new ethers.Contract(c.address, abi, provider);
        const total = Number(await ct.totalSupply());
        for (let i = 1; i <= Math.min(total, 20); i++) {
          try {
            const uri = await ct.tokenURI(i);
            let meta = {};
            try { meta = await (await fetch(c.gw + uri.replace('ipfs://',''))).json(); } catch(e) {}
            const imageCID = meta.image?.replace('ipfs://','') || null;
            allNFTs.push({
              tokenId: i,
              name:  meta.name || `EduChain NFT #${i}`,
              topic: meta.attributes?.find(a=>a.trait_type==='Topic')?.value || 'General',
              grade: meta.attributes?.find(a=>a.trait_type==='Grade')?.value || '',
              score: meta.attributes?.find(a=>a.trait_type==='Score')?.value || 0,
              theme: meta.attributes?.find(a=>a.trait_type==='Art Style')?.value || '',
              protocol: c.label,
              imageUrl:   imageCID ? c.gw + imageCID : null,
              filecoinCID: imageCID,
              raribleUrl: `https://testnet.rarible.com/token/base/${c.address}:${i}`,
              openseaUrl: `https://testnets.opensea.io/assets/base-sepolia/${c.address}/${i}`,
              humanInvolved: false,
            });
          } catch(e) {}
        }
      } catch(e) {}
    }
    return { totalMinted: allNFTs.length, totalSold: 0, totalRaisedCUSD: '0', nfts: allNFTs };
  } catch(err) {
    return { totalMinted: 0, totalSold: 0, totalRaisedCUSD: '0', nfts: [] };
  }
}
