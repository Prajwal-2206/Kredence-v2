export interface ScoreInput {
  txCount: number;
  totalValueEth: number;
}

export interface ScoreResult {
  score: number;
  freqScore: number;
  volScore: number;
}

/**
 * Per-chain breakdown — tells the dashboard exactly which chains
 * had real activity so we never have to fake the "Chains" count.
 */
export interface ChainActivity {
  chainId: string;
  name: string;
  txCount: number;
  volume: number;
}

/**
 * Everything the dashboard needs in one response.
 * No fake derivations needed on the frontend.
 */
export interface MultiChainScoreResult {
  score: number;
  txCount: number;
  volume: string;
  walletAgeDays: number;
  activeChains: number;
  chainBreakdown: ChainActivity[];
}

/**
 * Weighted Linear Combination (WLC) scoring — K-Alpha v2.1
 *
 * freqScore: up to 300 points from transaction frequency (10 pts per tx, capped)
 * volScore:  up to 300 points from total ETH volume (5 pts per ETH, capped)
 * base:      300 points granted to any wallet with activity
 *
 * Final range: 0–900
 */
export function calculateScore({ txCount, totalValueEth }: ScoreInput): ScoreResult {
  if (txCount === 0) {
    return { score: 0, freqScore: 0, volScore: 0 };
  }

  const freqScore = Math.min(txCount * 10, 300);
  const volScore = Math.min(totalValueEth * 5, 300);
  const rawScore = 300 + freqScore + volScore;
  const score = Math.floor(Math.min(rawScore, 900));

  return { score, freqScore, volScore };
}

/**
 * Derives wallet age in days from the earliest transaction timestamp
 * found across all chains. Returns 0 if no timestamps exist.
 *
 * Why timestamps instead of block numbers?
 * Block numbers are chain-specific — Ethereum block #1000 and Polygon block #1000
 * happened at completely different times. Timestamps are universal.
 */
export function calculateWalletAgeDays(earliestTimestamp: string | null): number {
  if (!earliestTimestamp) return 0;

  const earliest = new Date(earliestTimestamp).getTime();
  const now = Date.now();
  return Math.max(Math.floor((now - earliest) / (1000 * 60 * 60 * 24)), 0);
}
