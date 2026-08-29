# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kredence v2** — A multi-chain Web3 reputation and credit scoring dashboard. Analyzes wallet transaction history across EVM chains (Ethereum, Polygon, Base, Arbitrum, Shardeum) to produce a unified "Degen Score" (0-900). Also tracks governance participation via Snapshot and on-chain voting power.

## Commands

- `npm run dev` — Start development server (Next.js Turbopack)
- `npm run build` — Production build
- `npm run lint` — Run ESLint (flat config, `eslint.config.mjs`)
- `npm start` — Serve production build

## Tech Stack

- **Framework:** Next.js 16 with App Router, React 19, TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 with `@tailwindcss/postcss`, glassmorphic dark theme
- **UI Components:** shadcn/ui (in `components/ui/`), Framer Motion for animations
- **Web3:** RainbowKit + Wagmi for wallet connection; viem for contract reads
- **Data:** Alchemy SDK + raw RPC for transaction history; Snapshot GraphQL for governance votes
- **State:** React Query (`@tanstack/react-query`) for server state

## Architecture

### Layout & Providers
`app/layout.tsx` is a `'use client'` root that wraps the entire app in WagmiProvider → QueryClientProvider → RainbowKitProvider. Custom chain definitions for Shardeum Mezame/Sphinx are defined inline here.

### Pages (App Router)
- `/` (`app/page.tsx`) — Landing page with wallet address input → navigates to `/dashboard?address=...`
- `/dashboard` — Main score dashboard; uses `?address=` query param or connected wallet
- `/dashboard/reputation` — Protocol interaction breakdown (Uniswap, Aave, Lido volumes)
- `/dashboard/governance` — DAO voting history and governance power
- `/docs` — Documentation page

### API Routes (all GET, query param `?address=`)
- `/api/score` — Fetches tx history via Alchemy `alchemy_getAssetTransfers` (raw axios), delegates scoring to `lib/scoring.ts`. Supports `?network=` param (chain ID). Returns honest zeros for wallets with no transactions.
- `/api/reputation` — Uses Alchemy SDK to fetch transfers, delegates analysis to `lib/reputation.ts` for protocol-specific volumes (Uniswap, Aave, Lido) and wallet age.
- `/api/governance` — Aggregates on-chain governance power (UNI/ARB token voting via viem contract reads) with off-chain Snapshot votes/proposals.

### Key Libraries (`lib/`)
- `scoring.ts` — Pure function: `calculateScore({txCount, totalValueEth})` → `{score, freqScore, volScore}`. Implements the WLC (Weighted Linear Combination) K-Alpha v2.1 formula. No side effects.
- `reputation.ts` — Pure function: `analyzeTransfers(items, latestBlock)` → `{walletAgeDays, protocols}`. Tallies protocol volumes and derives wallet age. No side effects.
- `governanceReads.ts` — viem public clients for Ethereum + Arbitrum; reads `getVotes()` from UNI and ARB token contracts
- `snapshotClient.ts` — GraphQL queries to Snapshot Hub API for user votes and authored proposals

### Shared Components
- `TopNavBar` — Global top navigation (rendered in root layout)
- `SideNavBar` — Dashboard sidebar navigation (rendered in dashboard layout)
- `WalletConnect` — Wallet connection component

## Environment Variables

- `ALCHEMY_API_KEY` — Alchemy API key for RPC and asset transfer queries
- `NEXT_PUBLIC_WC_PROJECT_ID` — WalletConnect project ID for RainbowKit

## Path Aliases

`@/*` maps to the project root (configured in `tsconfig.json`).
