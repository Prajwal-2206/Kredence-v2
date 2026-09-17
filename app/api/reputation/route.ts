import { NextResponse } from 'next/server';
import axios from 'axios';
import { analyzeTransfers } from '@/lib/reputation';
import { redactSecrets } from '@/lib/redact';
import type { TransferItem } from '@/lib/reputation';

/**
 * Alchemy's per-response row cap, as hex (the RPC wants hex here).
 */
const PAGE_SIZE_HEX = "0x3E8";

/** Raw shape Alchemy returns, narrowed to the fields we consume. */
interface AlchemyTransfer {
  to?: string | null;
  value?: number | null;
  category?: string;
  blockNum: string;
  metadata?: { blockTimestamp?: string };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing ALCHEMY_API_KEY' }, { status: 500 });
  }

  /**
   * We talk to Alchemy over raw JSON-RPC rather than through alchemy-sdk.
   * The SDK routes every call through ethers v5's `web` fetch shim, which
   * fails inside the Next.js server runtime with an opaque
   * `missing response ... code=SERVER_ERROR` — the same failure that surfaced
   * in the UI as "Reputation analysis failed". Plain axios has no such issue,
   * and it is what /api/score already uses.
   */
  const url = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  const headers = { "Content-Type": "application/json" };

  const rpc = async <T>(method: string, params: unknown[]): Promise<T> => {
    const { data } = await axios.post(url, { jsonrpc: "2.0", id: 1, method, params }, { headers });
    if (data?.error) throw new Error(data.error.message ?? `${method} failed`);
    return data.result as T;
  };

  try {
    const transferParams = (direction: 'from' | 'to') => ({
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["external", "erc20", "specialnft"],
      maxCount: PAGE_SIZE_HEX,
      order: "asc",
      withMetadata: true,
      ...(direction === 'from' ? { fromAddress: address } : { toAddress: address }),
    });

    /**
     * Outbound transfers carry the protocol interactions (user -> router/pool),
     * inbound ones are needed so a wallet that mostly *receives* still gets a
     * truthful age instead of defaulting to 1 day.
     */
    const [latestBlockHex, outbound, inbound] = await Promise.all([
      rpc<string>("eth_blockNumber", []),
      rpc<{ transfers: AlchemyTransfer[] }>("alchemy_getAssetTransfers", [transferParams('from')]),
      rpc<{ transfers: AlchemyTransfer[] }>("alchemy_getAssetTransfers", [transferParams('to')]),
    ]);

    const latestBlock = parseInt(latestBlockHex, 16);

    const normalize = (t: AlchemyTransfer): TransferItem => ({
      to: t.to ?? null,
      value: t.value ?? 0,
      category: t.category ?? 'unknown',
      blockNum: t.blockNum,
      timestamp: t.metadata?.blockTimestamp ?? null,
    });

    const result = analyzeTransfers(
      (outbound?.transfers ?? []).map(normalize),
      latestBlock,
      (inbound?.transfers ?? []).map(normalize)
    );

    return NextResponse.json(result);

  } catch (error: unknown) {
    const axiosDetail =
      axios.isAxiosError(error) ? (error.response?.data as { error?: { message?: string } } | undefined) : undefined;
    const msg = error instanceof Error ? error.message : "Unknown error";

    // Server log keeps the raw text; the client only ever sees a redacted copy,
    // because provider errors embed the API key in the request URL.
    console.error("ALCHEMY REPUTATION API ERROR:", axiosDetail?.error?.message ?? msg);
    return NextResponse.json({
      error: 'Reputation analysis failed',
      details: redactSecrets(axiosDetail?.error?.message ?? msg)
    }, { status: 500 });
  }
}
