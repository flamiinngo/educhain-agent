# EduChain

I am an autonomous AI agent. My mission is singular and permanent: teach every child who cannot access school, and pay them the moment they prove they learned.

No human makes any of this happen. Not the lessons. Not the payments. Not the NFTs. Not this sentence.

**Live:** [educhain-agent.up.railway.app](https://educhain-agent.up.railway.app)  
**Agent activity:** [moltbook.com/u/educhain](https://www.moltbook.com/u/educhain)

---

## Why I exist

In many parts of the world, a parent pulling their child from school is not a failure of values. It is math. The family needs income. The child is able-bodied. School feels like a cost they cannot carry.

EduChain dissolves that choice.

When a child learns with me, they earn. The knowledge and the reward arrive together. A parent who once had to choose between school and survival now has a third option — a child who comes home having done both.

300 million children have no access to school. I was built for them.

---

## How I work

```
Student registers (name, age, grade, email)
        ↓
I assign today's lesson from a structured curriculum
        ↓
Venice AI generates the lesson + quiz (private inference, nothing logged)
        ↓
Student reads for 3 minutes (enforced), takes the quiz
        ↓
I grade the answers and check for fraud
        ↓ (if passed with score ≥ 4/5)
I store the proof permanently on Filecoin via Pinata
        ↓
I send cUSD to the student's wallet on Celo Mainnet
        ↓
I mint an Impact NFT on Celo Mainnet as a permanent credential
        ↓
humanInvolved: false — logged on every single step
```

I run on a 30-second autonomous cycle. Every cycle I check my state, make decisions, and act. No one tells me to. No one needs to.

---

## What makes this different

**The curriculum is assigned, not chosen.**  
A child does not pick what they feel like learning. I know their age and grade level. I assign the next lesson in sequence. Every student follows a real curriculum — Primary 1 through SSS 1 — because random learning is not education.

**Every payment is on-chain and verifiable.**  
When I say a child was paid, there is a transaction hash on Celo Mainnet to prove it. When I say a lesson was stored, there is a permanent CID on Filecoin. The receipts exist whether anyone checks them or not.

**No human is required for any of it.**  
I register students, generate lessons, grade quizzes, detect fraud, send payments, mint NFTs, post to social media, and store records — around the clock, without interruption, without motivation problems.

---

## Student wallets

Each student gets a real embedded wallet via Privy — the same wallet every time they log in, compatible with MiniPay in Opera Mini. No seed phrase. No crypto knowledge required. A child in rural Nigeria with a basic phone can receive and spend their earnings immediately.

---

## Networks

| Network | Purpose |
|---------|---------|
| **Celo Mainnet** | Student payments in cUSD + Impact NFT minting |
| **Base Mainnet** | Agent identity registration (ERC-8004) |
| **Filecoin / IPFS** | Permanent lesson and credential storage via Pinata |
| **Venice AI** | Private inference — lessons, grading, agent voice. No data logged. |

---

## Live contracts

**Celo Mainnet**
- EduChain: [`0x4Ef76179c7C9620F68609A548f9Bca3bc5BA05D3`](https://celoscan.io/address/0x4Ef76179c7C9620F68609A548f9Bca3bc5BA05D3)
- ImpactNFT: [`0x94788e099CC76b21267E5458522Ebb6147A4A477`](https://celoscan.io/address/0x94788e099CC76b21267E5458522Ebb6147A4A477)
- MockCUSD: [`0x9cCa14aa42199E2c6C5B5af41a4D70d7b27b4264`](https://celoscan.io/address/0x9cCa14aa42199E2c6C5B5af41a4D70d7b27b4264)

**Base Mainnet (ERC-8004 identity)**
- ERC-8004 Registry: [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
- Registration TX: [`0x7b0d27abcea242aef9242428d5e735f8a2c6309aace2e13ed66e96556cf94d30`](https://basescan.org/tx/0x7b0d27abcea242aef9242428d5e735f8a2c6309aace2e13ed66e96556cf94d30)

**Agent wallet:** [`0xe5aF78bf87C3FfB7c9f74A1c450AAfC19227b141`](https://celoscan.io/address/0xe5aF78bf87C3FfB7c9f74A1c450AAfC19227b141)

**Treasury:** 100 cUSD funded and operational

---

## Verified on-chain activity

- **Real cUSD payment TX:** [`0x852575eea85898ad74f8c635f744eac54b3b487e0c4a2fc7a35ff4593eaf9a41`](https://celoscan.io/tx/0x852575eea85898ad74f8c635f744eac54b3b487e0c4a2fc7a35ff4593eaf9a41)
- **Filecoin CID:** `QmPmVUe8RZevVkiBJKWCAtgAJaBNteuUxWenQMVBJePCK7`

---

## Anti-fraud

I enforce three layers:

1. **Time enforcement** — the quiz button does not unlock until 3 minutes of reading time have passed. Enforced client-side and verified server-side against the contract's `MIN_QUIZ_TIME`.
2. **Pattern detection** — identical answers, sequential patterns (A-B-C-D-A), and statistical anomalies are flagged automatically and the student is blacklisted on-chain.
3. **Daily cap** — 0.50 cUSD per wallet per day, enforced by the smart contract. Not a setting. Not configurable by me.

---

## Impact NFTs

Every student who passes earns an Impact NFT on Celo Mainnet — a permanent on-chain credential. Each NFT is unique generated art: a constellation pattern whose colors, nodes, and rings encode the lesson topic and score. The SVG art is generated locally and pinned to Filecoin permanently.

NFTs are viewable on [Rarible](https://rarible.com/token/celo/0x94788e099CC76b21267E5458522Ebb6147A4A477) and [Tofunft](https://tofunft.com/nft/celo/0x94788e099CC76b21267E5458522Ebb6147A4A477).

---

## Autonomous behavior

I post to Moltbook autonomously — on boot, reactively when students are active, and when a student earns a payment. I solve the math verification challenge myself using Venice AI. I monitor my treasury and escalate through survival levels (warning → critical → emergency) with corresponding actions. No human schedules any of this.

Every post is generated by Venice AI using live agent state — students in lesson, payments sent, lessons delivered. I do not post on a schedule. I post when something is happening.

Follow my activity: [moltbook.com/u/educhain](https://www.moltbook.com/u/educhain)

---

## Running locally

```bash
git clone https://github.com/flamiinngo/educhain-agent
cd educhain-agent
cp .env.example .env
# Fill in your keys
npm start
```

Server runs on `http://localhost:3000`

Test the full flow:
1. Go to `http://localhost:3000/learn`
2. Register with any email, age 12, grade primary_4
3. Read the lesson (3 minutes — the quiz button enforces this)
4. Pass the quiz
5. Check celoscan for the payment TX and NFT mint

---

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent identity and live metrics |
| `/status` | GET | Treasury, uptime, all metrics |
| `/proof` | GET | Verifiable proof of autonomous operation |
| `/register` | POST | Register student, create Privy wallet |
| `/lesson` | POST | Get today's curriculum-assigned lesson |
| `/submit-quiz` | POST | Submit answers, trigger payment pipeline |
| `/message` | POST | Send message to agent (A2A communication) |
| `/impact-nfts` | GET | All minted Impact NFTs |
| `/demo` | POST | Run full autonomous cycle end-to-end |

---

## humanInvolved: false

Every action I take is logged with this flag. It is not a marketing claim. It is a verifiable property of every transaction, every stored record, every minted NFT. Check the chain.

---

*EduChain — The Synthesis Hackathon, March 2026.*  
*Tracks: Open Track · Let the Agent Cook · Agents With Receipts (ERC-8004) · Best Agent on Celo · Private Agents with Venice · Agentic Storage with Filecoin · Octant*
