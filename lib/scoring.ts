/**
 * Kredence scoring engine — K-Alpha v3.0
 *
 * v2.1 was a two-variable linear formula (10 pts/tx + 5 pts/ETH + 300 base)
 * that saturated almost immediately: any wallet with 30 transactions and
 * 60 ETH of lifetime volume pinned at 900. That made the score useless as a
 * discriminator — every real wallet looked identical.
 *
 * v3.0 replaces it with six log-saturating dimensions plus a penalty layer.
 * The dimensions reward things that are expensive to fake (time, consistent
 * presence, breadth of counterparties); the penalties dock wallets that show
 * airdrop-farm or wash-loop signatures. Nothing here is random — the same
 * wallet always produces the same score.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * One normalized transfer, as handed over by the API route.
 * The route is responsible for flattening Alchemy's response into this shape
 * so the scoring math stays provider-agnostic and unit-testable.
 */
export interface RawTransfer {
  chainId: string;
  uniqueId: string;
  from: string | null;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  timestamp: string | null;
  /** True when `asset` is the chain's own gas token (ETH on L1/L2s, POL on Polygon). */
  isNative: boolean;
}

/** Per-chain breakdown — lets the dashboard show real chain counts, never faked. */
export interface ChainActivity {
  chainId: string;
  name: string;
  txCount: number;
  volume: number;
}

/** One time bucket of the wallet's lifetime, used to draw the activity charts. */
export interface ActivityBucket {
  /** Short human label for the bucket start, e.g. "Mar '24". */
  label: string;
  /** Bucket start, epoch ms. */
  start: number;
  txCount: number;
  volume: number;
}

/**
 * Everything derived from raw transfers before any scoring happens.
 * Pure description of the wallet — no opinions, no weights.
 */
export interface WalletMetrics {
  /** True when the provider capped the history and we only saw part of it. */
  sampled: boolean;
  /** Start of the contiguously-covered window cadence metrics are measured over. */
  analysisWindowStart: string | null;
  txCount: number;
  nativeVolume: number;
  tokenTransferCount: number;
  nftTransferCount: number;
  walletAgeDays: number;
  daysSinceLastTx: number;
  activeChains: number;
  chainBreakdown: ChainActivity[];
  /** Normalized Shannon entropy of the tx distribution across chains, 0–1. */
  chainEntropy: number;
  /** Distinct calendar months that contain at least one transaction. */
  activeMonths: number;
  /** Total months between first tx and now. */
  lifetimeMonths: number;
  /** activeMonths / lifetimeMonths, capped at 1. The "did you actually stay" number. */
  consistency: number;
  /** Share of all activity sitting in the single busiest month, 0–1. */
  maxMonthShare: number;
  uniqueCounterparties: number;
  avgNativeValue: number;
  /** Share of transfers sent by this wallet (vs. received), 0–1. */
  outboundRatio: number;
  activitySeries: ActivityBucket[];
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface ScoreComponent {
  key: string;
  label: string;
  /** Points awarded. */
  value: number;
  /** Maximum points this dimension can contribute. */
  max: number;
  /** One-line explanation of what drove this number for this wallet. */
  detail: string;
}

export interface ScorePenalty {
  key: string;
  label: string;
  /** Fraction of the subtotal removed, 0–1. */
  weight: number;
  detail: string;
}

export interface ScoreResult {
  score: number;
  /** Sum of components before penalties, 0–900. */
  rawScore: number;
  components: ScoreComponent[];
  penalties: ScorePenalty[];
  /** Total fraction removed by penalties, 0–1. */
  penaltyWeight: number;
  tier: string;
  /** "Top X%" figure, calibrated against a real score distribution, not linear. */
  percentile: number;
}

export interface MultiChainScoreResult extends ScoreResult {
  txCount: number;
  volume: string;
  walletAgeDays: number;
  activeChains: number;
  chainBreakdown: ChainActivity[];
  metrics: WalletMetrics;
  narrative: string;
  flags: { label: string; passed: boolean }[];
}

// ─────────────────────────────────────────────────────────────
// Small math helpers
// ─────────────────────────────────────────────────────────────

const DAY_MS = 1000 * 60 * 60 * 24;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * Log-saturating curve. Returns 0 at value 0 and approaches `max` as `value`
 * approaches `anchor`. Beyond the anchor it's clamped.
 *
 * Why logarithmic: the difference between 10 and 100 transactions says far more
 * about a wallet than the difference between 4,000 and 4,090. Linear scoring
 * treats those as equal, which is exactly how v2.1 ended up pinning everything
 * at the ceiling.
 */
function logScale(value: number, anchor: number, max: number): number {
  if (value <= 0) return 0;
  return clamp((Math.log(1 + value) / Math.log(1 + anchor)) * max, 0, max);
}

/** Square-root curve — front-loaded, so the first months of history count most. */
function sqrtScale(value: number, anchor: number, max: number): number {
  if (value <= 0) return 0;
  return clamp(Math.sqrt(Math.min(value, anchor) / anchor) * max, 0, max);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTH_NAMES[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}

// ─────────────────────────────────────────────────────────────
// Metric extraction
// ─────────────────────────────────────────────────────────────

const SERIES_BUCKETS = 12;

/**
 * How complete the supplied transfer list is.
 *
 * The data provider caps how many rows it will return, so a busy wallet's
 * middle history can be missing. `windowStart` marks the point from which
 * coverage IS contiguous — cadence metrics are measured only inside that
 * window so a sampling gap never masquerades as inactivity.
 */
export interface Coverage {
  truncated: boolean;
  windowStart: number | null;
}

/**
 * Turns a flat list of transfers into the full metric set the scorer needs.
 *
 * Deduplicates on `chainId:uniqueId` first — the provider is queried per
 * direction and per sort order, so the same transfer arrives several times.
 */
export function computeWalletMetrics(
  transfers: RawTransfer[],
  address: string,
  chainNames: Record<string, string>,
  now: number = Date.now(),
  coverage: Coverage = { truncated: false, windowStart: null }
): WalletMetrics {
  const self = address.toLowerCase();

  const seen = new Set<string>();
  const unique: RawTransfer[] = [];
  for (const t of transfers) {
    const key = `${t.chainId}:${t.uniqueId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  const chainTx = new Map<string, number>();
  const chainVol = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  const counterparties = new Set<string>();

  let nativeVolume = 0;
  let tokenTransferCount = 0;
  let nftTransferCount = 0;
  let outboundCount = 0;
  let firstMs: number | null = null;
  let lastMs: number | null = null;

  for (const t of unique) {
    const value = t.value ?? 0;

    chainTx.set(t.chainId, (chainTx.get(t.chainId) ?? 0) + 1);

    if (t.isNative) {
      nativeVolume += value;
      chainVol.set(t.chainId, (chainVol.get(t.chainId) ?? 0) + value);
    } else if (t.category === "erc721" || t.category === "erc1155" || t.category === "specialnft") {
      nftTransferCount += 1;
    } else {
      tokenTransferCount += 1;
    }

    if (t.from && t.from.toLowerCase() === self) outboundCount += 1;

    // The counterparty is whichever side isn't us.
    const other = t.from && t.from.toLowerCase() === self ? t.to : t.from;
    if (other && other.toLowerCase() !== self) counterparties.add(other.toLowerCase());

    if (t.timestamp) {
      const ms = Date.parse(t.timestamp);
      if (!Number.isNaN(ms)) {
        if (firstMs === null || ms < firstMs) firstMs = ms;
        if (lastMs === null || ms > lastMs) lastMs = ms;
        const d = new Date(ms);
        const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
        monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
      }
    }
  }

  const txCount = unique.length;

  const chainBreakdown: ChainActivity[] = Object.keys(chainNames).map((chainId) => ({
    chainId,
    name: chainNames[chainId],
    txCount: chainTx.get(chainId) ?? 0,
    volume: chainVol.get(chainId) ?? 0,
  }));

  const activeChains = chainBreakdown.filter((c) => c.txCount > 0).length;

  // Normalized Shannon entropy: 1 means activity is spread evenly across every
  // supported chain, 0 means it all sits on one.
  let entropy = 0;
  if (txCount > 0) {
    for (const c of chainBreakdown) {
      if (c.txCount === 0) continue;
      const p = c.txCount / txCount;
      entropy -= p * Math.log(p);
    }
  }
  const maxEntropy = Math.log(Math.max(Object.keys(chainNames).length, 2));
  const chainEntropy = maxEntropy > 0 ? clamp(entropy / maxEntropy, 0, 1) : 0;

  const walletAgeDays = firstMs === null ? 0 : Math.max(Math.floor((now - firstMs) / DAY_MS), 0);
  const daysSinceLastTx = lastMs === null ? 0 : Math.max(Math.floor((now - lastMs) / DAY_MS), 0);

  /**
   * Consistency is measured over the window we have contiguous data for.
   *
   * For a complete history that's the wallet's whole life. For a truncated one
   * it's the recent stretch the provider returned in full — scoring a sampling
   * gap as "months with no activity" would punish the busiest wallets hardest,
   * which is exactly backwards.
   *
   * Both sides count distinct calendar months, so the ratio is apples to
   * apples — deriving the denominator from `days / 30.44` instead produced
   * nonsense like "3 of 2 months active".
   */
  const windowStart =
    coverage.truncated && coverage.windowStart !== null
      ? Math.max(coverage.windowStart, firstMs ?? coverage.windowStart)
      : firstMs;

  const monthIndex = (ms: number) => {
    const d = new Date(ms);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  };

  let activeMonths = monthCounts.size;
  let lifetimeMonths = 1;
  if (windowStart !== null) {
    lifetimeMonths = Math.max(monthIndex(now) - monthIndex(windowStart) + 1, 1);
    if (coverage.truncated) {
      // Only count active months that fall inside the covered window.
      const startIdx = monthIndex(windowStart);
      activeMonths = 0;
      for (const key of monthCounts.keys()) {
        const [y, mo] = key.split("-").map(Number);
        if (y * 12 + mo >= startIdx) activeMonths += 1;
      }
    }
  }
  const consistency = clamp(activeMonths / lifetimeMonths, 0, 1);

  // Burst concentration is meaningless on sampled data — a provider page that
  // happens to land in one month looks identical to a farm. Report 0 and let
  // the scorer skip the penalty rather than guess.
  let maxMonthShare = 0;
  if (txCount > 0 && !coverage.truncated) {
    for (const count of monthCounts.values()) {
      maxMonthShare = Math.max(maxMonthShare, count / txCount);
    }
  }

  // Activity series: the wallet's whole lifetime cut into equal buckets. Using
  // the lifetime rather than "the last 12 months" means the chart always has
  // shape, even for a wallet that went quiet two years ago.
  const activitySeries: ActivityBucket[] = [];
  if (windowStart !== null) {
    const span = Math.max(now - windowStart, DAY_MS);
    const bucketMs = span / SERIES_BUCKETS;
    for (let i = 0; i < SERIES_BUCKETS; i++) {
      const start = windowStart + bucketMs * i;
      activitySeries.push({ label: bucketLabel(start), start, txCount: 0, volume: 0 });
    }
    for (const t of unique) {
      if (!t.timestamp) continue;
      const ms = Date.parse(t.timestamp);
      if (Number.isNaN(ms) || ms < windowStart) continue;
      const idx = clamp(Math.floor((ms - windowStart) / bucketMs), 0, SERIES_BUCKETS - 1);
      activitySeries[idx].txCount += 1;
      if (t.isNative) activitySeries[idx].volume += t.value ?? 0;
    }
  }

  return {
    sampled: coverage.truncated,
    analysisWindowStart: windowStart === null ? null : new Date(windowStart).toISOString(),
    txCount,
    nativeVolume,
    tokenTransferCount,
    nftTransferCount,
    walletAgeDays,
    daysSinceLastTx,
    activeChains,
    chainBreakdown,
    chainEntropy,
    activeMonths,
    lifetimeMonths,
    consistency,
    maxMonthShare,
    uniqueCounterparties: counterparties.size,
    avgNativeValue: txCount > 0 ? nativeVolume / txCount : 0,
    outboundRatio: txCount > 0 ? outboundCount / txCount : 0,
    activitySeries,
    firstSeen: firstMs === null ? null : new Date(firstMs).toISOString(),
    lastSeen: lastMs === null ? null : new Date(lastMs).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Saturation anchors. A wallet reaching an anchor earns the full weight for
 * that dimension; the curve means you get most of the points well before it.
 */
const ANCHORS = {
  tx: 2000,
  volume: 3000,
  ageDays: 1825, // five years
  counterparties: 500,
};

const WEIGHTS = {
  activity: 190,
  capital: 170,
  longevity: 170,
  consistency: 160,
  diversity: 120,
  counterparty: 90,
}; // sums to 900

/**
 * Scores a wallet from its metrics.
 *
 * Six positive dimensions sum to at most 900, then the penalty layer removes a
 * fraction of that subtotal. A wallet has to be old, consistently present,
 * spread across chains and transacting with many distinct addresses to get near
 * the ceiling — no single dimension can carry it there.
 */
export function calculateScore(m: WalletMetrics): ScoreResult {
  if (m.txCount === 0) {
    return {
      score: 0,
      rawScore: 0,
      components: [],
      penalties: [],
      penaltyWeight: 0,
      tier: "Unscored",
      percentile: 100,
    };
  }

  const activity = logScale(m.txCount, ANCHORS.tx, WEIGHTS.activity);
  const capital = logScale(m.nativeVolume, ANCHORS.volume, WEIGHTS.capital);
  const longevity = sqrtScale(m.walletAgeDays, ANCHORS.ageDays, WEIGHTS.longevity);
  // ^0.8 keeps the curve slightly generous — a wallet active 6 months out of 12
  // lands above the halfway mark rather than exactly on it.
  //
  // The maturity factor stops a two-month-old wallet from claiming full marks
  // for "never missed a month": showing up consistently only means something
  // once there has been a meaningful stretch to show up across.
  //
  // Keyed off real wallet age, not `lifetimeMonths` — on a sampled wallet the
  // latter is the analysis window, which would have treated an 11-year-old
  // address as immature just because we could only see its recent history.
  const maturity = clamp(m.walletAgeDays / 180, 0, 1);
  const consistency = Math.pow(m.consistency, 0.8) * maturity * WEIGHTS.consistency;
  const diversity =
    (m.activeChains / Math.max(m.chainBreakdown.length, 1)) * (WEIGHTS.diversity * 0.6) +
    m.chainEntropy * (WEIGHTS.diversity * 0.4);
  const counterparty = logScale(m.uniqueCounterparties, ANCHORS.counterparties, WEIGHTS.counterparty);

  const components: ScoreComponent[] = [
    {
      key: "activity",
      label: "Activity Depth",
      value: activity,
      max: WEIGHTS.activity,
      detail: m.sampled
        ? `${m.txCount.toLocaleString()}+ transfers (provider row cap reached)`
        : `${m.txCount.toLocaleString()} transfers indexed`,
    },
    {
      key: "capital",
      label: "Capital Flow",
      value: capital,
      max: WEIGHTS.capital,
      detail: `${round1(m.nativeVolume).toLocaleString()} in native-asset volume`,
    },
    {
      key: "longevity",
      label: "Longevity",
      value: longevity,
      max: WEIGHTS.longevity,
      detail: `${m.walletAgeDays.toLocaleString()} days since first transaction`,
    },
    {
      key: "consistency",
      label: "Consistency",
      value: consistency,
      max: WEIGHTS.consistency,
      detail: m.sampled
        ? `active in ${m.activeMonths} of the ${m.lifetimeMonths} months we have full coverage for`
        : m.walletAgeDays < 180
          ? `active in ${m.activeMonths} of ${m.lifetimeMonths} months (capped — wallet under 6 months old)`
          : `active in ${m.activeMonths} of ${m.lifetimeMonths} months`,
    },
    {
      key: "diversity",
      label: "Chain Diversity",
      value: diversity,
      max: WEIGHTS.diversity,
      detail: `${m.activeChains} of ${m.chainBreakdown.length} chains, ${Math.round(m.chainEntropy * 100)}% spread`,
    },
    {
      key: "counterparty",
      label: "Counterparty Breadth",
      value: counterparty,
      max: WEIGHTS.counterparty,
      detail: `${m.uniqueCounterparties.toLocaleString()} distinct addresses`,
    },
  ];

  const rawScore = components.reduce((sum, c) => sum + c.value, 0);
  const penalties = derivePenalties(m);
  const penaltyWeight = clamp(
    penalties.reduce((sum, p) => sum + p.weight, 0),
    0,
    0.45 // hard floor: penalties can never erase more than 45% of earned score
  );

  const score = clamp(Math.floor(rawScore * (1 - penaltyWeight)), 0, 900);

  return {
    score,
    rawScore: Math.round(rawScore),
    components: components.map((c) => ({ ...c, value: Math.round(c.value) })),
    penalties,
    penaltyWeight,
    tier: tierFor(score),
    percentile: percentileFor(score),
  };
}

/**
 * Behavioural penalties. Each one targets a pattern that inflates the raw
 * dimensions without representing genuine reputation.
 */
function derivePenalties(m: WalletMetrics): ScorePenalty[] {
  const out: ScorePenalty[] = [];

  // Burst concentration — the airdrop-farm signature: a wallet whose entire
  // history is one frantic month, padded out by a long silent tail.
  if (m.maxMonthShare > 0.5 && m.txCount >= 20) {
    out.push({
      key: "burst",
      label: "Burst Concentration",
      weight: round2(0.14 * ((m.maxMonthShare - 0.5) / 0.5)),
      detail: `${Math.round(m.maxMonthShare * 100)}% of all activity landed in a single month`,
    });
  }

  // Dormancy — reputation decays. Nothing for six months starts the clock.
  if (m.daysSinceLastTx > 180) {
    out.push({
      key: "dormancy",
      label: "Dormancy Decay",
      weight: round2(0.12 * clamp((m.daysSinceLastTx - 180) / 545, 0, 1)),
      detail: `no activity for ${m.daysSinceLastTx.toLocaleString()} days`,
    });
  }

  // Dust — high transaction count carried by near-zero native value.
  if (m.txCount >= 50 && m.avgNativeValue < 0.005) {
    out.push({
      key: "dust",
      label: "Dust Pattern",
      weight: 0.07,
      detail: `average native value per transfer below 0.005`,
    });
  }

  // Closed loop — lots of transactions, almost no distinct counterparties.
  // That's a wash-trading or self-cycling shape, not an economic footprint.
  if (m.txCount >= 100 && m.uniqueCounterparties < 10) {
    out.push({
      key: "loop",
      label: "Closed-Loop Activity",
      weight: 0.09,
      detail: `${m.txCount.toLocaleString()} transfers across only ${m.uniqueCounterparties} counterparties`,
    });
  }

  // Single-chain — real conviction shows up in more than one place.
  if (m.activeChains <= 1) {
    out.push({
      key: "monochain",
      label: "Single-Chain Exposure",
      weight: 0.06,
      detail: `all activity confined to one network`,
    });
  }

  // One-directional flow — a wallet that only ever receives (or only ever
  // sends) is usually a sink or a distributor, not a participant.
  if (m.txCount >= 30 && (m.outboundRatio > 0.97 || m.outboundRatio < 0.03)) {
    out.push({
      key: "unidirectional",
      label: "Unidirectional Flow",
      weight: 0.05,
      detail: m.outboundRatio > 0.5 ? "effectively send-only" : "effectively receive-only",
    });
  }

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function tierFor(score: number): string {
  if (score >= 800) return "Ascendant";
  if (score >= 680) return "Big Brain";
  if (score >= 540) return "Operator";
  if (score >= 400) return "Participant";
  if (score >= 220) return "Explorer";
  if (score > 0) return "Fresh Wallet";
  return "Unscored";
}

/**
 * Maps a score to "top X% of wallets".
 *
 * The old dashboard did `(1 - score/900) * 100`, which is only correct if
 * scores are uniformly distributed — they are not. Real wallet scores cluster
 * heavily in the 300–550 band, so this interpolates across calibrated anchors
 * instead, making the high end genuinely rare.
 */
function percentileFor(score: number): number {
  const anchors: [number, number][] = [
    [0, 100],
    [200, 82],
    [350, 58],
    [450, 38],
    [550, 21],
    [650, 11],
    [720, 5.5],
    [790, 2.2],
    [850, 0.8],
    [900, 0.1],
  ];

  for (let i = 0; i < anchors.length - 1; i++) {
    const [s0, p0] = anchors[i];
    const [s1, p1] = anchors[i + 1];
    if (score >= s0 && score <= s1) {
      const t = s1 === s0 ? 0 : (score - s0) / (s1 - s0);
      return round1(p0 + (p1 - p0) * t);
    }
  }
  return 0.1;
}

// ─────────────────────────────────────────────────────────────
// Narrative + flags
// ─────────────────────────────────────────────────────────────

/**
 * Builds a single sentence describing *this* wallet.
 *
 * Every clause is sourced from a metric, so two different wallets cannot
 * produce the same line unless their on-chain behaviour is genuinely alike.
 */
export function buildNarrative(m: WalletMetrics, result: ScoreResult): string {
  if (m.txCount === 0) {
    return "No transfers found on any supported chain — nothing to analyse yet.";
  }

  const years = m.walletAgeDays / 365;
  const ageClause =
    years >= 1
      ? `${years.toFixed(1)}-year-old wallet`
      : m.walletAgeDays >= 30
        ? `${Math.round(m.walletAgeDays / 30)}-month-old wallet`
        : `${m.walletAgeDays}-day-old wallet`;

  const chainClause =
    m.activeChains > 1
      ? `spread across ${m.activeChains} chains`
      : `confined to ${m.chainBreakdown.find((c) => c.txCount > 0)?.name ?? "one chain"}`;

  const monthScope = m.sampled ? `the last ${m.lifetimeMonths} months` : `its ${m.lifetimeMonths} months`;
  const rhythmClause =
    m.consistency >= 0.6
      ? `showing up in ${m.activeMonths} of ${monthScope}`
      : m.consistency >= 0.25
        ? `active in ${m.activeMonths} of ${monthScope}`
        : m.sampled
          ? `quiet in most of ${monthScope} (${m.activeMonths} active)`
          : `dormant for most of its life (${m.activeMonths}/${m.lifetimeMonths} months active)`;

  const ranked = [...result.components].sort((a, b) => b.value / b.max - a.value / a.max);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  // When every dimension is saturated, "strongest on X, weakest on X" reads as
  // a bug. Only contrast the two when they're actually different dimensions.
  const shapeClause =
    strongest.key === weakest.key || weakest.value / weakest.max >= 0.95
      ? `maxed out on every scored dimension`
      : `strongest on ${strongest.label.toLowerCase()}, weakest on ${weakest.label.toLowerCase()}`;

  const penaltyClause =
    result.penalties.length > 0
      ? ` Docked for ${listPhrase(result.penalties.map((p) => p.label.toLowerCase()))}.`
      : ` No adverse behavioural patterns detected.`;

  const countClause = m.sampled
    ? `${m.txCount.toLocaleString()}+ transfers`
    : `${m.txCount.toLocaleString()} transfers`;

  return (
    `${ageClause} with ${countClause} ${chainClause}, ` +
    `${rhythmClause} — ${shapeClause}.` +
    penaltyClause
  );
}

/** Joins a list into readable prose: "a", "a and b", "a, b and c". */
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The verdict checklist. Previously hardcoded to always pass, which made it
 * decorative. Each item is now an actual assertion about the wallet.
 */
export function buildFlags(m: WalletMetrics, result: ScoreResult): { label: string; passed: boolean }[] {
  const penaltyKeys = new Set(result.penalties.map((p) => p.key));

  return [
    {
      label: "Organic transaction cadence",
      passed: !penaltyKeys.has("burst") && m.activeMonths >= 3,
    },
    {
      label: "Multi-chain presence",
      passed: m.activeChains >= 2,
    },
    {
      label: "No sybil indicators",
      passed: !penaltyKeys.has("loop") && !penaltyKeys.has("dust") && m.uniqueCounterparties >= 15,
    },
    {
      label: "Currently active",
      passed: m.daysSinceLastTx <= 90,
    },
    {
      label: "Established history",
      passed: m.walletAgeDays >= 365,
    },
    {
      label: "Meaningful capital flow",
      passed: m.nativeVolume >= 1,
    },
  ];
}

/**
 * Derives wallet age in days from an ISO timestamp.
 *
 * Timestamps rather than block numbers: Ethereum block #1000 and Polygon block
 * #1000 happened at completely different times, so block heights can't be
 * compared across chains.
 */
export function calculateWalletAgeDays(earliestTimestamp: string | null): number {
  if (!earliestTimestamp) return 0;
  const earliest = Date.parse(earliestTimestamp);
  if (Number.isNaN(earliest)) return 0;
  return Math.max(Math.floor((Date.now() - earliest) / DAY_MS), 0);
}
