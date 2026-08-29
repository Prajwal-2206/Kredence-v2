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
