import { NextResponse } from 'next/server';
import axios from 'axios';
import { calculateScore, calculateWalletAgeDays } from '@/lib/scoring';
import type { ChainActivity } from '@/lib/scoring';

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
     * 4 chains × 2 directions = 8 API calls, all fired in parallel.
     */
    const chainPromises = SUPPORTED_CHAINS.map(async (chain) => {
      const alchemyUrl = `https://${chain.subdomain}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

      const reqBase = {
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          category: ["external", "erc20", "erc721", "specialnft"],
          maxCount: "0x3E8",
          withMetadata: true,  // This gives us blockTimestamp for wallet age
        }]
      };

      const headers = { "Content-Type": "application/json" };

      // Fire both directions in parallel for this chain
      const [outRes, inRes] = await Promise.all([
        axios.post(alchemyUrl, {
          ...reqBase,
          params: [{ ...reqBase.params[0], fromAddress: address }]
        }, { headers }).catch(() => ({ data: { result: { transfers: [] } } })),
        axios.post(alchemyUrl, {
          ...reqBase,
          params: [{ ...reqBase.params[0], toAddress: address }]
        }, { headers }).catch(() => ({ data: { result: { transfers: [] } } })),
      ]);

      const transfers = [
        ...(outRes.data?.result?.transfers || []),
        ...(inRes.data?.result?.transfers || []),
      ];

      // Sum up volume for this chain
      let chainVolume = 0;
      transfers.forEach((tx: any) => {
        chainVolume += tx.value || 0;
      });

      // Find earliest timestamp on this chain
      let earliestTimestamp: string | null = null;
      transfers.forEach((tx: any) => {
        const ts = tx.metadata?.blockTimestamp;
        if (ts && (!earliestTimestamp || ts < earliestTimestamp)) {
          earliestTimestamp = ts;
        }
      });

      return {
        chainId: chain.chainId,
        name: chain.name,
        txCount: transfers.length,
        volume: chainVolume,
        earliestTimestamp,
      };
    });

    // Wait for ALL chains to finish (parallel execution)
    const chainResults = await Promise.all(chainPromises);

    // Aggregate across all chains
    let totalTxCount = 0;
    let totalVolume = 0;
    let globalEarliestTimestamp: string | null = null;
    const chainBreakdown: ChainActivity[] = [];

    for (const result of chainResults) {
      totalTxCount += result.txCount;
      totalVolume += result.volume;

      if (result.earliestTimestamp && (!globalEarliestTimestamp || result.earliestTimestamp < globalEarliestTimestamp)) {
        globalEarliestTimestamp = result.earliestTimestamp;
      }

      chainBreakdown.push({
        chainId: result.chainId,
        name: result.name,
        txCount: result.txCount,
        volume: result.volume,
      });
    }

    const { score } = calculateScore({ txCount: totalTxCount, totalValueEth: totalVolume });
    const walletAgeDays = calculateWalletAgeDays(globalEarliestTimestamp);
    const activeChains = chainBreakdown.filter(c => c.txCount > 0).length;

    return NextResponse.json({
      score,
      txCount: totalTxCount,
      volume: totalVolume.toFixed(4),
      walletAgeDays,
      activeChains,
      chainBreakdown,
    });

  } catch (error: any) {
    console.error("ALCHEMY API ERROR:", error.response?.data || error.message);
    return NextResponse.json({
      error: 'Score calculation failed via Alchemy Engine',
      details: error.response?.data?.message || error.message
    }, { status: 500 });
  }
}
