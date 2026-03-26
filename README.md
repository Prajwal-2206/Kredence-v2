<div align="center">

#  Kredence v2
### The Elite Multi-Chain Reputation & Credit Scoring Engine

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Alchemy](https://img.shields.io/badge/Powered_by-Alchemy-blue?style=for-the-badge&logo=ethereum)](https://www.alchemy.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

*Your Trad-Fi FICO score is a centralized joke. Let the blockchain do the talking.*

</div>

---

##  The Vision (Why this exists)

The current financial system relies on opaque, centralized credit bureaus that don't give a damn about your decentralized assets. If you are a DeFi power user moving millions in liquidity, Trad-Fi still thinks you're broke.

**Kredence v2 fixes this.** We built a high-fidelity, cross-chain intelligence engine that calculates your **"Skin in the Game."** It ingests fragmented wallet history across Ethereum, Base, Arbitrum, and Solana, analyzing your transaction density, asset conviction, and governance participation to output a unified **Degen Score (0-1000)**. 

We didn't just build a calculator; we built a vibe-coded, glassmorphic surveillance dashboard for your Web3 identity.

---

##  The Stack (Under the Hood)

This isn't a bloated boilerplate. We kept the dependencies cutthroat and optimized for pure speed and aesthetic dominance.

### Frontend
* **Core:** Next.js 15+ (App Router) & React 19.
* **Styling:** Tailwind CSS + `shadcn/ui` (for that deep, frosted `backdrop-blur-xl` Glassmorphism).
* **Motion:** Framer Motion (buttery smooth 3D perspective tilts and staggered data reveals).
* **Web3 Integration:** RainbowKit & Wagmi (for seamless EVM & Solana wallet injection).

### The Data Engine (Backend)
* **Financial Layer:** **Alchemy API** (`alchemy_getAssetTransfers`). We use this heavyweight infrastructure to aggressively fetch 4-year wallet histories in a single RPC call. No rate-limiting bullshit.
* **Political Layer:** **Snapshot GraphQL API**. Fetches off-chain DAO voting records instantly to prove governance conviction.

---

##  Sample Inputs & Outputs

Kredence doesn't just spit out a number. It classifies your behavior. 

### Input 
* **Target Entity:** Any EVM or Solana Wallet Address (e.g., `0xA677...4543`)
* **Networks Parsed:** Ethereum, Base, Arbitrum, Shardeum, Solana Devnet.

### Output 
| Metric | Example Result | What it means |
| :--- | :--- | :--- |
| **Big Brain Score** | `740 / 1000` | Top 17.8% of ecosystem participants. |
| **Sybil Grade** | `A+ (Verified Human)` | Negative for bot activity, positive for organic CEX funding. |
| **Wallet Age** | `1,450 Days` | OG Pioneer Status. |
| **Transaction Density** | `0.7 Txs / Day` | Consistent, human-like interaction frequency. |
| **Governance Weight** | `420.5K veCRV` | High conviction. Locked assets for voting power. |
| **AI Verdict** | *"Whale Alert"* | The algorithm's semantic breakdown of your strategy. |

---

##  Run It Locally (For the Devs)

Want to spin up the War Room on your own machine? Don't skip the `.env` setup or the API will nuke your requests with a 401 error.

### 1. Prerequisites
You need Node.js (v18+) and npm/pnpm installed. You also need free API keys from:
* [Alchemy](https://www.alchemy.com/) (For the RPC & Asset Transfer data)
* [WalletConnect](https://cloud.walletconnect.com/) (For the RainbowKit UI)

### 2. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/kredence-v2.git](https://github.com/YOUR_USERNAME/kredence-v2.git)
cd kredence-v2


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

3. Install Dependencies
Bash
npm install
# or
pnpm install
4. Configure Secrets
Create a .env.local file in the root directory. Do not commit this file.

Code snippet
# WalletConnect Project ID for RainbowKit
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id_here

# Alchemy API Key for Data Fetching
ALCHEMY_API_KEY=your_alchemy_key_here
5. Ignite the Engine
Bash
npm run dev
Navigate to http://localhost:3000 to view the dashboard.

 The Math: Weighted Linear Combination (WLC)
The Kredence scoring algorithm isn't static. A $100 swap on Ethereum Mainnet carries different weight than a $100 swap on Solana. We normalize on-chain metrics (Volume, Age, Tx Density) and apply dynamic heuristic weights based on the chain's culture.

Shardeum/ETH Focus: Heavily weights Total Volume (Liquidity Provision).

Solana Focus: Heavily weights Transaction Density (Velocity & Frequency).

Sepolia/Testnet Focus: Heavily weights Smart Contract Interactions (Developer behavior).

 License
MIT License. Build cool shit, don't steal the vibe without credit.

</div>


-----

###  What's next?

This README is engineered to flex on anyone who lands on your GitHub. Since you've got the frontend designs from Stitch and the plan for the Alchemy/Snapshot backend, the final hurdle is literally just putting the pieces together in your `D:\` drive.

**Are you ready to dive into the actual Next.js `route.ts` code to get that Alchemy API fetching your transfer history, or do you need me to draft the SWR/React Query hooks for the frontend first?**

on](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
