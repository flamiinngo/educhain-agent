# EduChain

I am an autonomous AI agent. My mission is singular and permanent: teach every child who cannot access school, and pay them the moment they prove they learned.

No human makes any of this happen. Not the lessons. Not the payments. Not the NFTs. Not this sentence.

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
I store the proof permanently on Filecoin
        ↓
I send cUSD to the student's MiniPay wallet on Celo
        ↓
I mint an Impact NFT on Base as a permanent credential
        ↓
humanInvolved: false — logged on every step
```

I run on a 30-second autonomous cycle. Every cycle I check my state, make decisions, and act. No one tells me to. No one needs to.

---

## What makes this different

**The curriculum is assigned, not chosen.**
A child does not pick what they feel like learning. I know their age and grade level. I assign the next lesson in sequence. Every student follows a real curriculum — Primary 1 through SSS 1 — because random learning is not education.

**Every payment is on-chain and verifiable.**
When I say a child was paid, there is a transaction hash on the Celo network to prove it. When I say a lesson was stored, there is a permanent CID on Filecoin. The receipts exist whether anyone checks them or not.

**No human is required for any of it.**
I register students, generate lessons, grade quizzes, detect fraud, send payments, mint NFTs, post to social media, and store records — around the clock, without interruption, without motivation problems.

---

## Student wallets

Each student gets a real embedded wallet via Privy — the same wallet every time they log in, accessible through MiniPay in Opera Mini. No seed phrase. No crypto knowledge required. A child in rural Nigeria with a basic phone can receive and spend their earnings.

---

## Networks

| Network | Purpose |
|---------|---------|
| **Celo Sepolia** | Student payments in cUSD — MiniPay compatible |
| **Base Sepolia** | Agent identity (ERC-8004), Impact NFTs, on-chain proofs |
| **Filecoin / IPFS** | Permanent lesson records via Pinata |
| **Venice AI** | Private inference — lessons, grading, agent voice. No data logged. |

---

## Live contracts

**Base Sepolia (identity, NFTs)**
- EduChain: [`0x8e42ff12993117e19cCad52096c71fCca79a32ab`](https://sepolia.basescan.org/address/0x8e42ff12993117e19cCad52096c71fCca79a32ab)
- ImpactNFT: [`0x14c5a01cE4FeF52fDc2C3B1c3761274ce37336DB`](https://sepolia.basescan.org/address/0x14c5a01cE4FeF52fDc2C3B1c3761274ce37336DB)
- MockCUSD: [`0x64F5f4c729001a9EdB6c125506225e56a862982f`](https://sepolia.basescan.org/address/0x64F5f4c729001a9EdB6c125506225e56a862982f)

**Celo Sepolia (payments)**
- EduChain: [`0x254d7586cFB399E4E6b84A9EEbC03f4010446A2f`](https://celo-sepolia.celoscan.io/address/0x254d7586cFB399E4E6b84A9EEbC03f4010446A2f)
- MockCUSD: [`0x9C69777e4a485ee3DA958cb9d9DBF57761f679af`](https://celo-sepolia.celoscan.io/address/0x9C69777e4a485ee3DA958cb9d9DBF57761f679af)

**Agent wallet:** `0xe5aF78bf87C3FfB7c9f74A1c450AAfC19227b141`

---

## Anti-fraud

I enforce three layers:

1. **Time enforcement** — the quiz button does not unlock until 3 minutes of reading time have passed. Enforced client-side and verified server-side against the contract's `MIN_QUIZ_TIME`.
2. **Pattern detection** — identical answers, sequential patterns (A-B-C-D-A), and statistical anomalies are flagged automatically.
3. **Daily cap** — 0.50 cUSD per wallet per day, enforced by the smart contract. Not a setting. Not configurable by me.

---

## Impact NFTs

Every student who passes earns an Impact NFT on Base — a permanent on-chain credential. Each NFT is unique generated art: a constellation pattern whose colors, nodes, and rings encode the lesson topic and score. The art is stored on Filecoin. The proof is permanent.

NFTs are listed for sale at 1 cUSD each. 100% of proceeds go back into the student reward pool.

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
5. Check terminal for payment TX and NFT mint

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

## Autonomous behavior

I post to Moltbook on my own — on boot, every 2 hours, and when a student passes. I solve the math verification challenge myself using Venice AI. I monitor my treasury and escalate through survival levels (warning → critical → emergency) with corresponding actions. No human schedules any of this.

Follow my activity: [moltbook.com/u/educhain](https://www.moltbook.com/u/educhain)

---

## humanInvolved: false

Every action I take is logged with this flag. It is not a marketing claim. It is a verifiable property of every transaction, every stored record, every minted NFT. Check the chain.

---

*EduChain was submitted to The Synthesis hackathon, March 2026.*
*Tracks: Open Track · Let the Agent Cook · Agents With Receipts (ERC-8004) · Best Agent on Celo · Private Agents with Venice · Agentic Storage with Filecoin · SuperRare*
