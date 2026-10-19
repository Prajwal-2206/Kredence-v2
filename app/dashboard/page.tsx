"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { generateAuditPDF } from "@/lib/auditReport";
import { cacheScore } from "@/lib/watchlist";
import type { AuditReportData } from "@/lib/auditReport";
import type {
  ActivityBucket,
  ChainActivity,
  ScoreComponent,
  ScorePenalty,
  WalletMetrics,
} from "@/lib/scoring";

/**
 * Chain logos keyed by chainId.
 * When we add a new chain to SUPPORTED_CHAINS in the API,
 * we just add its logo here — the UI picks it up automatically.
 */
const CHAIN_META: Record<string, { name: string; logo: string }> = {
  "1": {
    name: "Ethereum",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  },
  "137": {
    name: "Polygon",
    logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
  },
  "8453": {
    name: "Base",
    logo: "https://raw.githubusercontent.com/base-org/brand-kit/refs/heads/main/logo/symbol/Base_Symbol_Blue.svg",
  },
  "42161": {
    name: "Arbitrum",
    logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg",
  },
};

/**
 * The /api/score response. Typing this properly (rather than `any`) means the
 * chart and breakdown code below is checked against what the route actually
 * returns — if the two drift apart, the build catches it.
 */
interface ScoreResponse {
  score: number;
  txCount: number;
  volume: string;
  walletAgeDays: number;
  activeChains: number;
  chainBreakdown: ChainActivity[];
  rawScore: number;
  components: ScoreComponent[];
  penalties: ScorePenalty[];
  penaltyWeight: number;
  tier: string;
  percentile: number;
  activitySeries: ActivityBucket[];
  narrative: string;
  flags: { label: string; passed: boolean }[];
  metrics: WalletMetrics;
}

/**
 * Turns a series of values into a smooth SVG path using Catmull-Rom splines
 * converted to cubic béziers.
 *
 * The straight-line alternative (`polyline`) looks jagged at this size, and the
 * old hardcoded `Q`/`T` path looked smooth but was the same squiggle for every
 * wallet. This gives us both: smooth, and actually derived from the data.
 */
function buildSparklinePath(values: number[], width = 100, height = 20): string {
  if (values.length === 0) return "";

  const max = Math.max(...values, 1);
  const pad = 2; // keeps the stroke from clipping at the viewBox edges
  const pts = values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: height - pad - (v / max) * (height - pad * 2),
  }));

  if (pts.length === 1) return `M0 ${pts[0].y.toFixed(2)} L${width} ${pts[0].y.toFixed(2)}`;

  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    // Catmull-Rom → bézier control points (tension 1/6 is the standard conversion)
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Closes a sparkline path into a fillable area by dropping to the baseline. */
function closeAsArea(path: string, width = 100, height = 20): string {
  if (!path) return "";
  return `${path} L${width} ${height} L0 ${height} Z`;
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { address: connectedAddress } = useAccount();
  const searchParams = useSearchParams();
  const searchAddress = searchParams?.get("address");

  const address = searchAddress || connectedAddress;

  const [scoreData, setScoreData] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Accordion state: tracks which card is expanded.
   * null = all collapsed. "age" | "volume" | "density" | "diversity" = that card is open.
   * Clicking the same card toggles it closed. Clicking another opens that one instead.
   */
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const toggleCard = (card: string) => {
    setExpandedCard(prev => prev === card ? null : card);
  };

  /**
   * Fetches reputation + governance data on demand, merges with score data,
   * and generates the PDF. We don't fetch these on page load because most users
   * won't click this button — no point slowing down the dashboard for everyone.
   */
  const handleDownloadAudit = async () => {
    if (!address || !scoreData) return;
    setDownloadingPDF(true);

    try {
      // Fire both API calls in parallel — same pattern we use in the score API
      const [repRes, govRes] = await Promise.all([
        fetch(`/api/reputation?address=${address}`).then(r => r.json()).catch(() => null),
        fetch(`/api/governance?address=${address}`).then(r => r.json()).catch(() => null),
      ]);

      const reportData: AuditReportData = {
        address: address as string,
        score: scoreData.score,
        txCount: scoreData.txCount,
        volume: scoreData.volume,
        walletAgeDays: scoreData.walletAgeDays,
        activeChains: scoreData.activeChains,
        chainBreakdown: scoreData.chainBreakdown,
        // K-Alpha v3.0 transparency fields — the report renders these when present
        narrative: scoreData.narrative ?? null,
        tier: scoreData.tier ?? null,
        percentile: scoreData.percentile ?? null,
        rawScore: scoreData.rawScore ?? null,
        components: scoreData.components ?? null,
        penalties: scoreData.penalties ?? null,
        flags: scoreData.flags ?? null,
        protocols: repRes?.error ? null : repRes?.protocols ?? null,
        governance: govRes?.error ? null : {
          power: govRes?.power ?? { uni: null, arb: null },
          votes: govRes?.votes ?? [],
          authoredCount: govRes?.authoredCount ?? 0,
        },
      };

      await generateAuditPDF(reportData);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchScore = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/score?address=${address}`);
        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else {
          setScoreData(data);
          // Remember this result so the Settings watchlist can show a score
          // next to the wallet without re-fetching every saved address.
          cacheScore(address, data.score, data.walletAgeDays);
        }
      } catch {
        setError("Failed to connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [address]);

  const score = scoreData?.score || 0;
  const txCount = scoreData?.txCount || 0;
  const volume = scoreData?.volume || "0.00";
  const walletAge = scoreData?.walletAgeDays || 0;
  const txDensity = (txCount / Math.max(walletAge, 1)).toFixed(1);
  const networksCount = scoreData?.activeChains || 0;
  const chainBreakdown: ChainActivity[] = scoreData?.chainBreakdown || [];

  // Find the earliest chain for the "first seen" date display.
  // Guarded on `available` so an unreachable chain can never be counted as
  // active on the strength of a zero we never actually measured.
  const activeChains = chainBreakdown.filter((c) => c.available && c.txCount > 0);

  /**
   * Scoring transparency payload from K-Alpha v3.0. Everything below is
   * computed server-side from real transfer data — the UI only renders it.
   */
  const components: ScoreComponent[] = scoreData?.components || [];
  const penalties: ScorePenalty[] = scoreData?.penalties || [];
  const flags: { label: string; passed: boolean }[] = scoreData?.flags || [];
  const narrative: string = scoreData?.narrative || "";
  const tier: string = scoreData?.tier || "Unscored";
  const percentile: number = scoreData?.percentile ?? 100;
  const rawScore = scoreData?.rawScore || 0;
  const penaltyWeight: number = scoreData?.penaltyWeight || 0;
  const metrics = scoreData?.metrics;

  /**
   * Activity series: the wallet's lifetime cut into 12 equal buckets.
   * Both the volume bars and the density sparkline read from this, so the two
   * cards tell the same story instead of showing decorative placeholder shapes.
   */
  const activitySeries: ActivityBucket[] = scoreData?.activitySeries || [];
  const seriesTx = activitySeries.map((b) => b.txCount);
  const maxBucketTx = Math.max(...seriesTx, 1);
  const densityPath = buildSparklinePath(seriesTx);
  const densityArea = closeAsArea(densityPath);
  const peakBucket = activitySeries.reduce<ActivityBucket | null>(
    (best, b) => (best === null || b.txCount > best.txCount ? b : best),
    null
  );

  const scoreFraction = Math.min(Math.max(score / 900, 0), 1);
  const pathLength = 125.66; // 40 * PI
  const dashOffset = pathLength - (pathLength * scoreFraction);

  /**
   * Framer Motion variants for the dropdown panel.
   * - initial/exit: height 0, invisible, slightly shifted up
   * - animate: auto height, fully visible, in place
   *
   * The key trick is `height: "auto"` — Framer Motion can animate TO auto height
   * (CSS transitions can't do this). This is one of the main reasons to use
   * Framer Motion over plain CSS for expand/collapse.
   */
  const dropdownVariants = {
    initial: { height: 0, opacity: 0, y: -8 },
    animate: { height: "auto", opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
    exit: { height: 0, opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const } },
  };

  return (
    <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen">
      {!address ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in duration-500">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 outline p-4 rounded-full border-surface-container border">account_balance_wallet</span>
          <h2 className="text-2xl font-headline font-bold mb-2">Wallet Disconnected</h2>
          <p className="text-tertiary/60">Connect your wallet or enter a public address to analyze identity.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 font-headline text-primary tracking-widest uppercase text-sm animate-pulse">Running ZK Circuits...</p>
        </div>
      ) : error ? (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6 max-w-2xl mx-auto mt-12 text-center text-error">
          <span className="material-symbols-outlined text-4xl mb-2">warning</span>
          <h3 className="text-xl font-bold font-headline mb-2">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <section className="max-w-6xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass-pane rounded-3xl p-8 neon-shadow-purple flex flex-col md:flex-row items-center gap-12">
              <div className="relative w-64 h-40 shrink-0">
                <svg className="w-full h-full gauge-svg" viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#23293c" strokeLinecap="round" strokeWidth="8"></path>
                  <path className="gauge-path" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#scoreGradient)" strokeDasharray={pathLength} strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="8"></path>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#ffb4ab"></stop>
                      <stop offset="50%" stopColor="#f0dbff"></stop>
                      <stop offset="100%" stopColor="#00f0ff"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className="text-5xl font-headline font-bold text-primary tracking-tighter">{score}</span>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-widest text-[10px]">Big Brain Score</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#dbfcff]"></div>
                  <h1 className="text-3xl font-headline font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-all">
                    Intelligence Overview
                  </h1>
                </div>
                <div className="text-xs font-mono text-on-surface-variant/60 mb-3 break-all bg-black/20 p-2 rounded-lg border border-white/5 inline-block">
                  {address}
                </div>
                <p className="text-tertiary/70 body-md max-w-xl leading-relaxed">
                  {narrative || "No transfers found on any supported chain."}
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="bg-surface-container-lowest px-4 py-2 rounded-xl border border-white/5">
                    <div className="text-[10px] text-outline uppercase">Tier</div>
                    <div className="text-lg font-headline font-bold text-primary-container">{tier}</div>
                  </div>
                  <div className="bg-surface-container-lowest px-4 py-2 rounded-xl border border-white/5">
                    <div className="text-[10px] text-outline uppercase">Percentile</div>
                    <div className="text-lg font-headline font-bold text-primary-container">Top {percentile}%</div>
                  </div>
                  <div className="bg-surface-container-lowest px-4 py-2 rounded-xl border border-white/5">
                    <div className="text-[10px] text-outline uppercase">Raw / Penalised</div>
                    <div className="text-lg font-headline font-bold text-primary-container">
                      {rawScore}
                      {penaltyWeight > 0 && (
                        <span className="text-error text-sm font-normal ml-1.5">−{Math.round(penaltyWeight * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">

            {/* ── WALLET AGE CARD ── */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              <div
                onClick={() => toggleCard("age")}
                className={`glass-pane rounded-2xl p-6 neon-shadow-cyan flex flex-col justify-between h-48 transition-all duration-300 cursor-pointer select-none ${expandedCard === "age" ? "ring-1 ring-primary/30" : "hover:-translate-y-1"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>history</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Wallet Age</span>
                    <motion.span
                      animate={{ rotate: expandedCard === "age" ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="material-symbols-outlined text-primary/30 text-sm"
                    >expand_more</motion.span>
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-headline font-bold text-on-surface">{walletAge}</div>
                  <div className="text-xs text-on-surface-variant">Days Active</div>
                </div>
              </div>
              <AnimatePresence>
                {expandedCard === "age" && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="glass-pane rounded-2xl mt-2 p-4 border border-primary/10 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-primary text-sm">info</span>
                        <span>Time since first on-chain transaction across all chains</span>
                      </div>
                      <div className="text-sm text-on-surface">
                        <span className="text-primary font-bold">{walletAge > 365 ? `${(walletAge / 365).toFixed(1)} years` : `${walletAge} days`}</span>
                        <span className="text-on-surface-variant"> of blockchain history</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── VOLUME CARD ── */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              <div
                onClick={() => toggleCard("volume")}
                className={`glass-pane rounded-2xl p-6 neon-shadow-purple flex flex-col justify-between h-48 transition-all duration-300 cursor-pointer select-none ${expandedCard === "volume" ? "ring-1 ring-secondary/30" : "hover:-translate-y-1"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <span className="material-symbols-outlined text-secondary" style={{fontVariationSettings: "'FILL' 1"}}>bar_chart</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-secondary/40 uppercase tracking-widest">Volume (Tx)</span>
                    <motion.span
                      animate={{ rotate: expandedCard === "volume" ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="material-symbols-outlined text-secondary/30 text-sm"
                    >expand_more</motion.span>
                  </div>
                </div>
                {/*
                  One bar per lifetime bucket. Height is the bucket's share of the
                  busiest bucket; opacity tracks the same ratio so quiet periods
                  visibly recede. Empty buckets keep a 4% stub so the axis reads
                  as a timeline rather than a gap.
                */}
                <div className="flex items-end gap-[3px] h-12 mb-2">
                  {activitySeries.length > 0 ? activitySeries.map((bucket, i) => {
                    const ratio = bucket.txCount / maxBucketTx;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-secondary rounded-t-sm transition-all duration-500"
                        style={{
                          height: `${Math.max(ratio * 100, 4)}%`,
                          opacity: 0.25 + ratio * 0.75,
                        }}
                        title={`${bucket.label}: ${bucket.txCount} tx`}
                      ></div>
                    );
                  }) : (
                    <div className="w-full h-[4%] bg-secondary/20 rounded-t-sm"></div>
                  )}
                </div>
                <div className="text-xl font-headline font-bold text-on-surface">{txCount.toLocaleString()} Txs</div>
              </div>
              <AnimatePresence>
                {expandedCard === "volume" && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="glass-pane rounded-2xl mt-2 p-4 border border-secondary/10 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-2">
                        <span className="material-symbols-outlined text-secondary text-sm">info</span>
                        <span>Per-chain transaction breakdown</span>
                      </div>
                      {chainBreakdown.map((chain) => {
                        const meta = CHAIN_META[chain.chainId];
                        if (!meta || chain.txCount === 0) return null;
                        const pct = txCount > 0 ? ((chain.txCount / txCount) * 100).toFixed(0) : "0";
                        return (
                          <div key={chain.chainId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src={meta.logo} alt={meta.name} className="w-4 h-4 rounded-full" />
                              <span className="text-sm text-on-surface">{meta.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-secondary rounded-full" style={{ width: `${pct}%` }}></div>
                              </div>
                              <span className="text-xs font-mono text-on-surface-variant w-16 text-right">{chain.txCount.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                      {activeChains.length === 0 && (
                        <div className="text-xs text-on-surface-variant text-center py-2">No transactions found</div>
                      )}
                      {metrics && activitySeries.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-white/5 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">{metrics.sampled ? "Analysis window" : "Timeline"}</span>
                            <span className="text-on-surface font-mono">
                              {activitySeries[0].label} → {activitySeries[activitySeries.length - 1].label}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Native volume</span>
                            <span className="text-on-surface font-mono">{volume}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Token / NFT transfers</span>
                            <span className="text-on-surface font-mono">
                              {metrics.tokenTransferCount.toLocaleString()} / {metrics.nftTransferCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── DENSITY CARD ── */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <div
                onClick={() => toggleCard("density")}
                className={`glass-pane rounded-2xl p-6 neon-shadow-pink flex flex-col justify-between h-48 transition-all duration-300 cursor-pointer select-none ${expandedCard === "density" ? "ring-1 ring-error/30" : "hover:-translate-y-1"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-error/10">
                    <span className="material-symbols-outlined text-error" style={{fontVariationSettings: "'FILL' 1"}}>insights</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-error/40 uppercase tracking-widest">Density</span>
                    <motion.span
                      animate={{ rotate: expandedCard === "density" ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="material-symbols-outlined text-error/30 text-sm"
                    >expand_more</motion.span>
                  </div>
                </div>
                {/*
                  Real cadence curve, interpolated through the same 12 lifetime
                  buckets the volume bars use. Previously this was a fixed `d`
                  attribute — the identical squiggle for every wallet on earth.
                */}
                <div className="relative h-12 w-full">
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                    <defs>
                      <linearGradient id="densityFill" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffb4ab" stopOpacity="0.35"></stop>
                        <stop offset="100%" stopColor="#ffb4ab" stopOpacity="0"></stop>
                      </linearGradient>
                    </defs>
                    {densityPath ? (
                      <>
                        <path d={densityArea} fill="url(#densityFill)" stroke="none"></path>
                        <path
                          d={densityPath}
                          fill="none"
                          stroke="#ffb4ab"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        ></path>
                      </>
                    ) : (
                      <line x1="0" y1="18" x2="100" y2="18" stroke="#ffb4ab" strokeOpacity="0.2" strokeWidth="1.5"></line>
                    )}
                  </svg>
                </div>
                <div>
                  <div className="text-xl font-headline font-bold text-on-surface">{txDensity}<span className="text-xs font-normal text-on-surface-variant ml-1">Tx/Day</span></div>
                </div>
              </div>
              <AnimatePresence>
                {expandedCard === "density" && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="glass-pane rounded-2xl mt-2 p-4 border border-error/10 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-error text-sm">info</span>
                        <span>Average transactions per day of wallet lifetime</span>
                      </div>
                      <div className="text-sm text-on-surface font-mono">
                        <span className="text-error font-bold">{txCount.toLocaleString()}</span>
                        <span className="text-on-surface-variant"> txs </span>
                        <span className="text-on-surface-variant">/</span>
                        <span className="text-on-surface-variant"> </span>
                        <span className="text-error font-bold">{walletAge.toLocaleString()}</span>
                        <span className="text-on-surface-variant"> days</span>
                        <span className="text-on-surface-variant"> = </span>
                        <span className="text-primary font-bold">{txDensity}</span>
                      </div>
                      {metrics && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Active months</span>
                            <span className="text-on-surface font-mono">{metrics.activeMonths} / {metrics.lifetimeMonths}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Busiest period</span>
                            <span className="text-on-surface font-mono">{peakBucket?.label ?? "—"} ({peakBucket?.txCount ?? 0} tx)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Last seen</span>
                            <span className="text-on-surface font-mono">
                              {metrics.daysSinceLastTx === 0 ? "today" : `${metrics.daysSinceLastTx.toLocaleString()}d ago`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Peak concentration</span>
                            <span className={`font-mono ${metrics.maxMonthShare > 0.5 ? "text-error" : "text-on-surface"}`}>
                              {Math.round(metrics.maxMonthShare * 100)}% in one month
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── DIVERSITY CARD ── */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
              <div
                onClick={() => toggleCard("diversity")}
                className={`glass-pane rounded-2xl p-6 neon-shadow-cyan flex flex-col justify-between h-48 transition-all duration-300 cursor-pointer select-none ${expandedCard === "diversity" ? "ring-1 ring-primary-container/30" : "hover:-translate-y-1"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary-container/10">
                    <span className="material-symbols-outlined text-primary-container" style={{fontVariationSettings: "'FILL' 1"}}>hub</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-primary-container/40 uppercase tracking-widest">Diversity</span>
                    <motion.span
                      animate={{ rotate: expandedCard === "diversity" ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="material-symbols-outlined text-primary-container/30 text-sm"
                    >expand_more</motion.span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {activeChains.map((chain) => {
                    const meta = CHAIN_META[chain.chainId];
                    if (!meta) return null;
                    return (
                      <div key={chain.chainId} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-surface" title={meta.name}>
                        <img alt={meta.name} className="w-5 h-5 rounded-full" src={meta.logo} />
                      </div>
                    );
                  })}
                  {activeChains.length === 0 && (
                    <span className="text-xs text-on-surface-variant">No chains</span>
                  )}
                </div>
                <div className="text-xs text-on-surface-variant uppercase tracking-widest">{networksCount} {networksCount === 1 ? 'Chain' : 'Chains'}</div>
              </div>
              <AnimatePresence>
                {expandedCard === "diversity" && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="glass-pane rounded-2xl mt-2 p-4 border border-primary-container/10 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-2">
                        <span className="material-symbols-outlined text-primary-container text-sm">info</span>
                        <span>Chains with detected activity</span>
                      </div>
                      {activeChains.length > 0 ? activeChains.map((chain) => {
                        const meta = CHAIN_META[chain.chainId];
                        if (!meta) return null;
                        return (
                          <div key={chain.chainId} className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                            <div className="flex items-center gap-3">
                              <img src={meta.logo} alt={meta.name} className="w-5 h-5 rounded-full" />
                              <span className="text-sm font-medium text-on-surface">{meta.name}</span>
                            </div>
                            <span className="text-xs font-mono text-primary-container">{chain.txCount.toLocaleString()} txs</span>
                          </div>
                        );
                      }) : (
                        <div className="text-xs text-on-surface-variant text-center py-2">No cross-chain activity detected</div>
                      )}
                      {/*
                        A chain we reached and found empty, and a chain we could
                        not reach, are different claims. Only the first one
                        justifies "not active on" — the second is unknown, and
                        saying otherwise asserts a fact we never checked.
                      */}
                      {chainBreakdown.filter((c) => !c.available).length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">
                            Could not be queried
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {chainBreakdown.filter((c) => !c.available).map((chain) => {
                              const meta = CHAIN_META[chain.chainId];
                              if (!meta) return null;
                              return (
                                <div
                                  key={chain.chainId}
                                  title="This network could not be reached, so activity here is unknown — not zero."
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20"
                                >
                                  <img src={meta.logo} alt={meta.name} className="w-3 h-3 rounded-full opacity-60" />
                                  <span className="text-[10px] text-amber-400/80">{meta.name}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[10px] text-on-surface-variant/50 mt-1.5">
                            Activity on these networks is unknown and excluded from scoring.
                          </div>
                        </div>
                      )}
                      {chainBreakdown.filter((c) => c.available && c.txCount === 0).length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Not active on</div>
                          <div className="flex gap-2">
                            {chainBreakdown.filter((c) => c.available && c.txCount === 0).map((chain) => {
                              const meta = CHAIN_META[chain.chainId];
                              if (!meta) return null;
                              return (
                                <div key={chain.chainId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 opacity-40">
                                  <img src={meta.logo} alt={meta.name} className="w-3 h-3 rounded-full" />
                                  <span className="text-[10px] text-on-surface-variant">{meta.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </section>

          <section className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <div className="glass-pane rounded-3xl p-10 border-l-4 border-l-primary neon-shadow-purple">
              <div className="flex items-center gap-4 mb-6">
                <span className="material-symbols-outlined text-secondary text-3xl">psychology</span>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Reputation Analysis</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-4">
                  {/* One line, every clause sourced from a metric for this specific wallet. */}
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/5 text-base leading-relaxed text-tertiary">
                    {narrative || "No transfers found on any supported chain — nothing to analyse yet."}
                  </div>

                  {/*
                    The data provider caps rows per response, so a very busy
                    wallet's middle history is missing. Cadence metrics are
                    measured only over the window we have in full — say so
                    rather than letting the charts imply complete coverage.
                  */}
                  {metrics?.sampled && (
                    <div className="flex items-start gap-2 text-xs text-on-surface-variant/80 rounded-xl px-4 py-3 bg-white/[0.03] border border-white/5">
                      <span className="material-symbols-outlined text-sm text-primary/70 mt-px">info</span>
                      <span>
                        This wallet exceeds the indexer&apos;s row limit. Wallet age and last-seen are exact;
                        cadence, charts and consistency are measured over the
                        {metrics.analysisWindowStart
                          ? ` window from ${new Date(metrics.analysisWindowStart).toLocaleDateString(undefined, { month: "short", year: "numeric" })} onward`
                          : " observed window"}.
                      </span>
                    </div>
                  )}

                  {/* Score decomposition: where each of the 900 points came from. */}
                  <div className="space-y-2.5">
                    {components.map((c) => {
                      const pct = c.max > 0 ? (c.value / c.max) * 100 : 0;
                      return (
                        <div key={c.key}>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-sm text-on-surface">{c.label}</span>
                            <span className="text-xs font-mono text-on-surface-variant">
                              <span className="text-primary font-bold">{c.value}</span> / {c.max}
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <div className="text-[10px] text-on-surface-variant/60 mt-1">{c.detail}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Penalty layer — only rendered when something actually fired. */}
                  {penalties.length > 0 && (
                    <div className="rounded-2xl p-4 border border-error/20 bg-error/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-error">Behavioural Penalties</span>
                        <span className="text-xs font-mono text-error">−{Math.round(penaltyWeight * 100)}% applied</span>
                      </div>
                      {penalties.map((p) => (
                        <div key={p.key} className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm text-on-surface">{p.label}</div>
                            <div className="text-[10px] text-on-surface-variant/60">{p.detail}</div>
                          </div>
                          <span className="text-xs font-mono text-error shrink-0">−{Math.round(p.weight * 100)}%</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-on-surface-variant/50 pt-1 border-t border-error/10">
                        Raw {rawScore} × (1 − {penaltyWeight.toFixed(2)}) = {score}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs font-label text-on-surface-variant uppercase tracking-widest">
                    <span>Analysis Engine: K-Alpha v3.0</span>
                    <span className="w-1 h-1 rounded-full bg-outline"></span>
                    <span>Data Points: {txCount.toLocaleString()}{metrics?.sampled ? "+" : ""} transfers</span>
                    {metrics && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-outline"></span>
                        <span>{metrics.uniqueCounterparties.toLocaleString()} counterparties</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-2xl p-6 border border-white/5 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-headline font-bold text-primary uppercase text-xs tracking-widest">Intelligence Verdict</h3>
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      {flags.filter((f) => f.passed).length}/{flags.length}
                    </span>
                  </div>
                  {/*
                    Each item is an assertion evaluated against the wallet's real
                    metrics server-side, so a failing check actually shows as failed.
                  */}
                  <ul className="space-y-3">
                    {flags.map((f) => (
                      <li key={f.label} className={`flex items-center gap-3 text-sm ${f.passed ? "" : "opacity-45"}`}>
                        <span
                          className={`material-symbols-outlined text-lg ${f.passed ? "text-primary-container" : "text-error"}`}
                        >
                          {f.passed ? "check_circle" : "cancel"}
                        </span>
                        <span>{f.label}</span>
                      </li>
                    ))}
                    {flags.length === 0 && (
                      <li className="text-xs text-on-surface-variant">No data to evaluate</li>
                    )}
                  </ul>
                  <button
                    onClick={handleDownloadAudit}
                    disabled={downloadingPDF}
                    className="w-full py-3 rounded-xl border border-primary/20 text-primary hover:bg-primary/10 transition-colors font-headline text-sm font-bold uppercase tracking-widest mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  >
                    {downloadingPDF ? "Generating Report..." : "Download Full Audit"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
