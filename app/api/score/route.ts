import { NextResponse } from 'next/server';
import axios from 'axios';
import { computeWalletMetrics, calculateScore, buildNarrative, buildFlags } from '@/lib/scoring';
import { redactSecrets } from '@/lib/redact';
import type { RawTransfer } from '@/lib/scoring';

/**
 * Each chain Alchemy supports gets an entry here.
 * To add a new chain later, just add one object — nothing else changes.
 * This is called the "data-driven" pattern: behavior is defined by data,
 * not by if/else chains that you have to edit every time.
 */
const SUPPORTED_CHAINS = [
  { chainId: '1', name: 'Ethereum', subdomain: 'eth-mainnet' },
  { chainId: '137', name: 'Polygon', subdomain: 'polygon-mainnet' },
  { chainId: '8453', name: 'Base', subdomain: 'base-mainnet' },
  { chainId: '42161', name: 'Arbitrum', subdomain: 'arb-mainnet' },
];

const CHAIN_NAMES: Record<string, string> = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.chainId, c.name])
);

/**
 * Alchemy's per-response row cap. A response that comes back exactly this full
 * is our signal that history was cut off.
 */
const PAGE_SIZE = 1000;
const PAGE_SIZE_HEX = "0x3E8";

/** Alchemy transfer shape, narrowed to the fields we actually consume. */
interface AlchemyTransfer {
  uniqueId?: string;
  hash?: string;
  from?: string;
  to?: string | null;
  value?: number | null;
  asset?: string | null;
  category?: string;
  metadata?: { blockTimestamp?: string };
}

/** Earliest parseable blockTimestamp in a page, or null if none carry one. */
function earliestTimestampOf(page: AlchemyTransfer[]): number | null {
  let earliest: number | null = null;
  for (const t of page) {
    const ts = t.metadata?.blockTimestamp;
    if (!ts) continue;
    const ms = Date.parse(ts);
    if (Number.isNaN(ms)) continue;
    if (earliest === null || ms < earliest) earliest = ms;
  }
  return earliest;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  if (!ALCHEMY_API_KEY) {
    return NextResponse.json({ error: 'Server misconfigured: missing ALCHEMY_API_KEY' }, { status: 500 });
  }

  try {
    /**
     * For each chain, we need BOTH outbound and inbound transfers to get
     * the full picture. Alchemy's getAssetTransfers only filters by
     * fromAddress OR toAddress, not both — so we make 2 calls per chain.
     *
     * We also query each direction twice, once ascending and once descending.
     * Alchemy caps a single response at PAGE_SIZE rows, and an ascending-only
     * query therefore returns a heavy wallet's OLDEST transfers — which made
     * `lastSeen` years stale and fired a bogus dormancy penalty on wallets that
     * trade daily. Ascending pins the true first transaction, descending pins
     * the true most recent one, and the scorer dedupes the overlap.
     *
     * 4 chains × 2 directions × 2 orders = 16 API calls, all fired in parallel.
     */
    const chainPromises = SUPPORTED_CHAINS.map(async (chain) => {
      const alchemyUrl = `https://${chain.subdomain}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
      const headers = { "Content-Type": "application/json" };

      const baseParams = {
        fromBlock: "0x0",
        toBlock: "latest",
        category: ["external", "erc20", "erc721", "specialnft"],
        maxCount: PAGE_SIZE_HEX,
        withMetadata: true,  // This gives us blockTimestamp for wallet age
      };

      const fetchPage = (direction: 'from' | 'to', order: 'asc' | 'desc') =>
        axios.post(alchemyUrl, {
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [{
            ...baseParams,
            order,
            ...(direction === 'from' ? { fromAddress: address } : { toAddress: address }),
          }],
        }, { headers })
          .then((r) => (r.data?.result?.transfers ?? []) as AlchemyTransfer[])
          .catch(() => [] as AlchemyTransfer[]);

      const [outAsc, inAsc, outDesc, inDesc] = await Promise.all([
        fetchPage('from', 'asc'),
        fetchPage('to', 'asc'),
        fetchPage('from', 'desc'),
        fetchPage('to', 'desc'),
      ]);

      // A page that came back completely full means there is more history we
      // never saw — the wallet's record is sampled, not complete.
      const truncated = [outAsc, inAsc, outDesc, inDesc].some((p) => p.length >= PAGE_SIZE);

      /**
       * Where our *complete* recent coverage begins on this chain.
       *
       * The descending pages are contiguous back from now, so everything from
       * their earliest row onward is fully observed. When nothing was truncated
       * we have the whole history, so the window is unbounded (null).
       */
      let recentWindowStart: number | null = null;
      if (truncated) {
        for (const page of [outDesc, inDesc]) {
          if (page.length < PAGE_SIZE) continue; // this direction is complete
          const earliest = earliestTimestampOf(page);
          if (earliest !== null && (recentWindowStart === null || earliest > recentWindowStart)) {
            // Take the LATEST of the per-direction starts: only from that point
            // on is every direction fully covered.
            recentWindowStart = earliest;
          }
        }
      }

      const raw: AlchemyTransfer[] = [...outAsc, ...inAsc, ...outDesc, ...inDesc];

      /**
       * Normalize into the provider-agnostic shape the scorer expects.
       *
       * `isNative` is keyed off the "external" category, which is Alchemy's
       * label for a plain value transfer of the chain's gas token. This matters:
       * the previous version summed `tx.value` across every category, so a
       * single 5,000 USDC transfer was counted as 5,000 ETH of volume. Token
       * and NFT movements are still counted as activity — just not as capital.
       */
      const transfers = raw.map((t, i): RawTransfer => ({
        chainId: chain.chainId,
        uniqueId: t.uniqueId ?? `${t.hash ?? 'nohash'}:${i}`,
        from: t.from ?? null,
        to: t.to ?? null,
        value: t.value ?? 0,
        asset: t.asset ?? null,
        category: t.category ?? 'unknown',
        timestamp: t.metadata?.blockTimestamp ?? null,
        isNative: t.category === 'external',
      }));

      return { transfers, truncated, recentWindowStart };
    });

    // Wait for ALL chains to finish (parallel execution)
    const perChain = await Promise.all(chainPromises);
    const transfers = perChain.flatMap((c) => c.transfers);
    const truncated = perChain.some((c) => c.truncated);

    // The analysis window has to be complete on EVERY chain, so take the latest
    // per-chain start. Untruncated chains impose no constraint.
    const windowStart = truncated
      ? perChain.reduce<number | null>(
          (latest, c) =>
            c.recentWindowStart !== null && (latest === null || c.recentWindowStart > latest)
              ? c.recentWindowStart
              : latest,
          null
        )
      : null;

    // All the derivation happens in lib/scoring.ts — this route stays a
    // fetch-and-normalize layer with no scoring opinions of its own.
    const metrics = computeWalletMetrics(transfers, address, CHAIN_NAMES, Date.now(), {
      truncated,
      windowStart,
    });
    const result = calculateScore(metrics);

    return NextResponse.json({
      // Core figures the dashboard reads directly
      score: result.score,
      txCount: metrics.txCount,
      volume: metrics.nativeVolume.toFixed(4),
      walletAgeDays: metrics.walletAgeDays,
      activeChains: metrics.activeChains,
      chainBreakdown: metrics.chainBreakdown,

      // Scoring transparency
      rawScore: result.rawScore,
      components: result.components,
      penalties: result.penalties,
      penaltyWeight: result.penaltyWeight,
      tier: result.tier,
      percentile: result.percentile,

      // Charts + copy
      activitySeries: metrics.activitySeries,
      narrative: buildNarrative(metrics, result),
      flags: buildFlags(metrics, result),
      metrics,
    });

  } catch (error: unknown) {
    // Axios errors carry the useful detail on `response.data`; anything else
    // we fall back to a plain message. Narrowing keeps this off `any`.
    const axiosDetail =
      axios.isAxiosError(error) ? (error.response?.data as { message?: string } | undefined) : undefined;
    const message = error instanceof Error ? error.message : String(error);

    // Raw text stays in the server log; the client gets a redacted copy, since
    // provider errors embed the API key in the request URL.
    console.error("ALCHEMY API ERROR:", axiosDetail ?? message);
    return NextResponse.json({
      error: 'Score calculation failed via Alchemy Engine',
      details: redactSecrets(axiosDetail?.message ?? message)
    }, { status: 500 });
  }
}
