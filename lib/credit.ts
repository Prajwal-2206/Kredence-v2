/**
 * Kredence credit engine — K-Credit v1.0
 *
 * K-Alpha (lib/scoring.ts) answers "is this wallet a real, established
 * participant?" from transfer *history*. It says nothing about whether the
 * wallet can be lent to, because history is not a balance sheet.
 *
 * K-Credit answers the other half: given this wallet's *current* lending
 * positions, how likely is it to be liquidated? That requires live position
 * state — collateral, debt, and the liquidation threshold sitting between
 * them — read from the lending pools themselves rather than inferred from
 * transfers.
 *
 * Why this is a separate engine and not another K-Alpha dimension:
 * the two have different time semantics. K-Alpha is cumulative and slow —
 * a wallet's history cannot get worse. K-Credit is instantaneous and
 * volatile: a wallet that was safe an hour ago can be liquidatable now,
 * because the price of its collateral moved. Blending them into one number
 * would let a decade of good history mask an about-to-liquidate position.
 *
 * Source of truth is Aave v3's `getUserAccountData`, whose pool addresses are
 * verified per chain in CHAINS below. Everything here is derived from that
 * call — nothing is estimated, and anything not measured is named explicitly
 * in `notMeasured` rather than silently assumed.
 */

// ─────────────────────────────────────────────────────────────
// Chain + protocol registry
// ─────────────────────────────────────────────────────────────

export interface CreditChain {
  chainId: number;
  name: string;
  /** Aave v3 Pool proxy. Each one verified live via getReservesList(). */
  aavePool: `0x${string}`;
  /**
   * Ordered RPC candidates. More than one on purpose: a single endpoint that
   * rate-limits or 403s would otherwise read as "this wallet has no position
   * here", which is the exact failure mode that corrupted chain diversity in
   * the transfer scorer. Callers try them in order and report the chain as
   * unavailable only when every candidate fails.
   */
  rpcs: string[];
}

export const CHAINS: CreditChain[] = [
  {
    chainId: 1,
    name: "Ethereum",
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Ordered by what actually answered this call under test. `llamarpc` and
    // `cloudflare-eth` are deliberately absent: the first was unreachable and
    // the second reverts on Aave's proxy.
    rpcs: ["https://eth.drpc.org", "https://ethereum.publicnode.com", "https://1rpc.io/eth", "https://eth-mainnet.public.blastapi.io"],
  },
  {
    chainId: 137,
    name: "Polygon",
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    rpcs: ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"],
  },
  {
    chainId: 8453,
    name: "Base",
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    rpcs: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    rpcs: ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc"],
  },
  {
    chainId: 10,
    name: "Optimism",
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    rpcs: ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io"],
  },
  {
    chainId: 43114,
    name: "Avalanche",
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    rpcs: ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
  },
  {
    chainId: 56,
    name: "BNB Chain",
    aavePool: "0x6807dc923806fE8Fd134338EABCA509979a7e0cB",
    rpcs: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org"],
  },
  {
    chainId: 534352,
    name: "Scroll",
    aavePool: "0x11fCfe756c05AD438e312a7fd934381537D3cFfe",
    rpcs: ["https://scroll-rpc.publicnode.com", "https://rpc.scroll.io"],
  },
  {
    chainId: 59144,
    name: "Linea",
    aavePool: "0xc47b8C00b0f69a36fa203Ffeac0334874574a8Ac",
    rpcs: ["https://linea-rpc.publicnode.com", "https://rpc.linea.build"],
  },
  {
    chainId: 42220,
    name: "Celo",
    aavePool: "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402",
    rpcs: ["https://celo-rpc.publicnode.com", "https://forno.celo.org"],
  },
];

/** Minimal Aave v3 Pool surface. Only the call we actually use. */
export const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "getUserAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────
// Units
// ─────────────────────────────────────────────────────────────

/**
 * Aave v3 reports collateral and debt in "base currency" units with 8
 * decimals (USD via the price oracle), and ratios in basis points. Health
 * factor is 1e18-scaled, and is uint256 max when the user has no debt —
 * treating that sentinel as a number would produce an absurd 1.15e59.
 */
const BASE_DECIMALS = 1e8;
const BPS = 1e4;
const WAD = 1e18;
// Written via the BigInt() constructor rather than `1n` literals: the project
// targets ES2017, where bigint literals are a compile error.
const UINT256_MAX = BigInt(2) ** BigInt(256) - BigInt(1);
const ZERO = BigInt(0);

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Aave's no-debt sentinel, surfaced as null rather than a fake number. */
function decodeHealthFactor(raw: bigint, totalDebtBase: bigint): number | null {
  if (totalDebtBase === ZERO || raw === UINT256_MAX) return null;
  return Number(raw) / WAD;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LendingPosition {
  chainId: number;
  chainName: string;
  protocol: "aave-v3";
  collateralUsd: number;
  debtUsd: number;
  availableBorrowsUsd: number;
  /** Fraction of collateral value at which liquidation begins, 0–1. */
  liquidationThreshold: number;
  /** Maximum fraction of collateral that may be borrowed against, 0–1. */
  maxLtv: number;
  /** Null when the wallet has no debt on this chain — not zero, null. */
  healthFactor: number | null;
}

export interface CreditMetrics {
  positions: LendingPosition[];
  /** Chains that answered but hold no position. Distinct from unavailable. */
  emptyChains: string[];
  /** Chains where every RPC candidate failed — unknown, never treated as zero. */
  unavailableChains: string[];
  totalCollateralUsd: number;
  totalDebtUsd: number;
  totalAvailableBorrowsUsd: number;
  /** Debt as a fraction of collateral, 0 when no collateral. Cred's headline metric. */
  debtToCollateral: number;
  /**
   * The weakest health factor across all chains. This, not the average, is
   * what matters: liquidation is per-position, so a healthy Arbitrum position
   * does not save an underwater one on Base.
   */
  minHealthFactor: number | null;
  /** Debt-weighted mean health factor, for describing the book as a whole. */
  weightedHealthFactor: number | null;
  chainsWithDebt: number;
  chainsWithCollateral: number;
  hasDebt: boolean;
  /** True when at least one chain could not be read. */
  partialCoverage: boolean;
}

export interface CreditComponent {
  key: string;
  label: string;
  value: number;
  max: number;
  detail: string;
}

export type LiquidationRisk = "critical" | "high" | "moderate" | "low" | "none";

export interface CreditResult {
  /** 0–900, aligned with K-Alpha's range so the two read on one scale. */
  creditScore: number;
  grade: string;
  risk: LiquidationRisk;
  /**
   * Modelled probability of liquidation under a moderate adverse price move.
   * Derived purely from the health-factor buffer — it is a monotone transform
   * of HF, not a forecast informed by volatility or historical defaults.
   */
  liquidationProbability: number;
  components: CreditComponent[];
  warnings: string[];
  /**
   * Signals a bureau-grade model would use that this engine does not yet
   * measure. Listed so the score is never mistaken for more than it is.
   */
  notMeasured: string[];
  /** True when scored without any debt, i.e. from capacity rather than conduct. */
  thinFile: boolean;
}

// ─────────────────────────────────────────────────────────────
// Metric assembly
// ─────────────────────────────────────────────────────────────

/** Raw tuple as returned by getUserAccountData, before scaling. */
export type RawAccountData = readonly [bigint, bigint, bigint, bigint, bigint, bigint];

export function toPosition(chain: CreditChain, raw: RawAccountData): LendingPosition {
  const [collateral, debt, available, liqThreshold, ltv, hf] = raw;
  return {
    chainId: chain.chainId,
    chainName: chain.name,
    protocol: "aave-v3",
    collateralUsd: Number(collateral) / BASE_DECIMALS,
    debtUsd: Number(debt) / BASE_DECIMALS,
    availableBorrowsUsd: Number(available) / BASE_DECIMALS,
    liquidationThreshold: Number(liqThreshold) / BPS,
    maxLtv: Number(ltv) / BPS,
    healthFactor: decodeHealthFactor(hf, debt),
  };
}

export function computeCreditMetrics(
  positions: LendingPosition[],
  unavailableChains: string[]
): CreditMetrics {
  // A chain that answered with an all-zero account is genuinely empty; one that
  // never answered is in unavailableChains and must not reach this list.
  const held = positions.filter((p) => p.collateralUsd > 0 || p.debtUsd > 0);
  const emptyChains = positions.filter((p) => p.collateralUsd === 0 && p.debtUsd === 0).map((p) => p.chainName);

  const totalCollateralUsd = held.reduce((s, p) => s + p.collateralUsd, 0);
  const totalDebtUsd = held.reduce((s, p) => s + p.debtUsd, 0);
  const totalAvailableBorrowsUsd = held.reduce((s, p) => s + p.availableBorrowsUsd, 0);

  const withDebt = held.filter((p) => p.debtUsd > 0 && p.healthFactor !== null);

  const minHealthFactor = withDebt.length
    ? withDebt.reduce((lo, p) => Math.min(lo, p.healthFactor as number), Infinity)
    : null;

  // Weighted by debt, because a 10 USD position with HF 1.01 should not drag
  // the headline figure as hard as a 10M USD one.
  const weightedHealthFactor = withDebt.length
    ? withDebt.reduce((s, p) => s + (p.healthFactor as number) * p.debtUsd, 0) / (totalDebtUsd || 1)
    : null;

  return {
    positions: held,
    emptyChains,
    unavailableChains,
    totalCollateralUsd,
    totalDebtUsd,
    totalAvailableBorrowsUsd,
    debtToCollateral: totalCollateralUsd > 0 ? totalDebtUsd / totalCollateralUsd : 0,
    minHealthFactor: minHealthFactor === Infinity ? null : minHealthFactor,
    weightedHealthFactor,
    chainsWithDebt: withDebt.length,
    chainsWithCollateral: held.filter((p) => p.collateralUsd > 0).length,
    hasDebt: totalDebtUsd > 0,
    partialCoverage: unavailableChains.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Risk model
// ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  buffer: 320,
  leverage: 260,
  headroom: 180,
  spread: 140,
}; // sums to 900

/**
 * Liquidation probability from the health-factor buffer.
 *
 * HF is the ratio of liquidation-adjusted collateral to debt, so HF = 1 is the
 * liquidation boundary exactly. An exponential decay in (HF − 1) gives the
 * shape this needs: certainty at the boundary, falling fast through the band
 * where positions actually get liquidated, and a long thin tail for the
 * heavily over-collateralised.
 *
 *   HF 1.00 → 1.00    HF 1.25 → 0.54    HF 1.50 → 0.29
 *   HF 2.00 → 0.08    HF 3.00 → 0.01
 *
 * This is a buffer transform, not a forecast: it has no view on the volatility
 * of the specific collateral asset, which is the single biggest omission and
 * is named in `notMeasured`.
 */
export function liquidationProbability(healthFactor: number | null): number {
  if (healthFactor === null) return 0;
  if (healthFactor <= 1) return 1;
  return clamp(Math.exp(-2.5 * (healthFactor - 1)), 0, 1);
}

function riskBand(hf: number | null): LiquidationRisk {
  if (hf === null) return "none";
  if (hf < 1.05) return "critical";
  if (hf < 1.25) return "high";
  if (hf < 1.6) return "moderate";
  return "low";
}

function gradeFor(score: number): string {
  if (score >= 820) return "AAA";
  if (score >= 740) return "AA";
  if (score >= 660) return "A";
  if (score >= 560) return "BBB";
  if (score >= 460) return "BB";
  if (score >= 340) return "B";
  if (score >= 200) return "CCC";
  return "D";
}

/**
 * Scores a wallet's lending book.
 *
 * `behaviouralScore` is K-Alpha's 0–900 output. It is used only for the thin
 * file case — a wallet with no debt has no repayment conduct to judge, so the
 * score falls back to describing capacity and standing instead, the way a
 * bureau scores someone who has never borrowed. When debt exists, conduct
 * dominates and the behavioural score contributes nothing.
 */
export function calculateCreditScore(m: CreditMetrics, behaviouralScore: number | null): CreditResult {
  const notMeasured = [
    "Historical liquidation events (requires log scan over each pool)",
    "Repayment punctuality and borrow duration",
    "Collateral asset volatility — all collateral is treated as equally risky",
    "Non-Aave lending positions (Compound, Morpho, Spark and others)",
    "Off-chain and CEX obligations, which are not observable here",
  ];

  // ── Thin file: collateral but no debt, or nothing at all ──────────────
  if (!m.hasDebt) {
    const warnings: string[] = [];
    if (m.partialCoverage) {
      warnings.push(
        `${m.unavailableChains.join(", ")} could not be read, so an undisclosed position may exist there.`
      );
    }

    // No borrowing means no liquidation risk to price, so the score describes
    // standing rather than conduct. Capped below the top band because an
    // untested borrower is not the same as a proven one.
    const capacityScore = m.totalCollateralUsd > 0 ? 620 : 500;
    const base = behaviouralScore !== null ? Math.round(capacityScore * 0.55 + behaviouralScore * 0.45) : capacityScore;
    const score = clamp(base, 0, 780);

    return {
      creditScore: score,
      grade: gradeFor(score),
      risk: "none",
      liquidationProbability: 0,
      components: [
        {
          key: "standing",
          label: "Collateral Standing",
          value: m.totalCollateralUsd > 0 ? WEIGHTS.buffer : 0,
          max: WEIGHTS.buffer,
          detail:
            m.totalCollateralUsd > 0
              ? `$${Math.round(m.totalCollateralUsd).toLocaleString("en-US")} supplied, nothing borrowed against it`
              : "No supplied collateral found on any readable chain",
        },
        {
          key: "conduct",
          label: "Borrowing Conduct",
          value: 0,
          max: WEIGHTS.leverage,
          detail: "No outstanding debt — no repayment behaviour to assess",
        },
      ],
      warnings,
      notMeasured,
      thinFile: true,
    };
  }

  // ── Active borrower ───────────────────────────────────────────────────
  const hf = m.minHealthFactor;
  const pLiq = liquidationProbability(hf);

  // Buffer: distance from the liquidation boundary, the dominant signal.
  const buffer = (1 - pLiq) * WEIGHTS.buffer;

  /**
   * Leverage discipline: how much of the *permitted* borrowing power is drawn.
   *
   * Measured against maxLtv rather than against collateral outright, because
   * the protocol's own LTV cap already encodes how risky it considers that
   * collateral. Borrowing 70% against an asset capped at 80% is far more
   * aggressive than the same 70% against one capped at 93%.
   */
  const capacityUsed =
    m.totalCollateralUsd > 0 && m.totalDebtUsd > 0
      ? clamp(
          m.totalDebtUsd / Math.max(m.totalDebtUsd + m.totalAvailableBorrowsUsd, 1e-9),
          0,
          1
        )
      : 0;
  const leverage = (1 - Math.pow(capacityUsed, 1.4)) * WEIGHTS.leverage;

  // Headroom: absolute remaining borrowing power, log-scaled. A wallet with
  // real unused capacity can defend a position; one with none cannot.
  const headroom =
    m.totalAvailableBorrowsUsd > 0
      ? clamp(Math.log(1 + m.totalAvailableBorrowsUsd) / Math.log(1 + 250_000), 0, 1) * WEIGHTS.headroom
      : 0;

  // Spread: debt concentrated in one position liquidates all at once.
  const spread =
    m.chainsWithDebt <= 1
      ? WEIGHTS.spread * 0.45
      : clamp(m.chainsWithDebt / 3, 0, 1) * WEIGHTS.spread;

  const components: CreditComponent[] = [
    {
      key: "buffer",
      label: "Collateral Buffer",
      value: Math.round(buffer),
      max: WEIGHTS.buffer,
      detail:
        hf === null
          ? "No debt position"
          : `health factor ${hf.toFixed(2)} — liquidation at 1.00, modelled risk ${(pLiq * 100).toFixed(1)}%`,
    },
    {
      key: "leverage",
      label: "Leverage Discipline",
      value: Math.round(leverage),
      max: WEIGHTS.leverage,
      detail: `${Math.round(capacityUsed * 100)}% of permitted borrowing power drawn`,
    },
    {
      key: "headroom",
      label: "Borrowing Headroom",
      value: Math.round(headroom),
      max: WEIGHTS.headroom,
      detail: `$${Math.round(m.totalAvailableBorrowsUsd).toLocaleString("en-US")} still available to draw`,
    },
    {
      key: "spread",
      label: "Position Spread",
      value: Math.round(spread),
      max: WEIGHTS.spread,
      detail:
        m.chainsWithDebt <= 1
          ? "all debt sits in a single position"
          : `debt spread across ${m.chainsWithDebt} chains`,
    },
  ];

  const score = clamp(
    Math.floor(components.reduce((s, c) => s + c.value, 0)),
    0,
    900
  );

  const warnings: string[] = [];
  if (hf !== null && hf < 1.05) {
    warnings.push(`Health factor ${hf.toFixed(3)} is at the liquidation boundary — this position can be liquidated now.`);
  } else if (hf !== null && hf < 1.25) {
    warnings.push(`Health factor ${hf.toFixed(2)} leaves little room; a ${Math.round((1 - 1 / hf) * 100)}% collateral drawdown triggers liquidation.`);
  }
  if (m.debtToCollateral > 0.75) {
    warnings.push(`Debt is ${Math.round(m.debtToCollateral * 100)}% of collateral value.`);
  }
  if (m.partialCoverage) {
    warnings.push(`${m.unavailableChains.join(", ")} could not be read — undisclosed debt may exist there.`);
  }

  return {
    creditScore: score,
    grade: gradeFor(score),
    risk: riskBand(hf),
    liquidationProbability: pLiq,
    components,
    warnings,
    notMeasured,
    thinFile: false,
  };
}

/**
 * One sentence describing the credit position, in the same spirit as K-Alpha's
 * narrative: every clause sourced from a measured value.
 */
export function buildCreditNarrative(m: CreditMetrics, r: CreditResult): string {
  if (m.unavailableChains.length === CHAINS.length) {
    return "No lending chain could be reached — credit standing is unknown.";
  }
  if (!m.hasDebt && m.totalCollateralUsd === 0) {
    return `No Aave v3 position found across ${CHAINS.length - m.unavailableChains.length} readable chains. Scored as a thin file on standing alone.`;
  }
  if (!m.hasDebt) {
    return (
      `$${Math.round(m.totalCollateralUsd).toLocaleString("en-US")} supplied across ` +
      `${m.chainsWithCollateral} chain${m.chainsWithCollateral === 1 ? "" : "s"} with no debt drawn — ` +
      `no liquidation exposure, and no repayment record to judge.`
    );
  }

  const hf = m.minHealthFactor as number;
  return (
    `$${Math.round(m.totalDebtUsd).toLocaleString("en-US")} borrowed against ` +
    `$${Math.round(m.totalCollateralUsd).toLocaleString("en-US")} of collateral ` +
    `(${Math.round(m.debtToCollateral * 100)}% debt-to-collateral) across ` +
    `${m.chainsWithDebt} chain${m.chainsWithDebt === 1 ? "" : "s"}. ` +
    `Weakest health factor ${hf.toFixed(2)}, placing modelled liquidation risk at ` +
    `${(r.liquidationProbability * 100).toFixed(1)}% — graded ${r.grade}.`
  );
}
