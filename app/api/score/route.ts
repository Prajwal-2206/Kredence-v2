import { NextResponse } from 'next/server';
import axios from 'axios';
import { calculateScore } from '@/lib/scoring';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const network = searchParams.get('network') || '1';

  if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  if (!ALCHEMY_API_KEY) {
    return NextResponse.json({ error: 'Server misconfigured: missing ALCHEMY_API_KEY' }, { status: 500 });
  }

  try {
    let alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    if (network === '137') alchemyUrl = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    else if (network === '8453') alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    const reqBase = {
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [{
        fromBlock: "0x0",
        toBlock: "latest",
        category: ["external", "erc20", "erc721", "specialnft"],
        maxCount: "0x3E8"
      }]
    };

    const [outRes, inRes] = await Promise.all([
      axios.post(alchemyUrl, { ...reqBase, params: [{ ...reqBase.params[0], fromAddress: address }] }, { headers: { "Content-Type": "application/json" } }),
      axios.post(alchemyUrl, { ...reqBase, params: [{ ...reqBase.params[0], toAddress: address }] }, { headers: { "Content-Type": "application/json" } })
    ]);

    const items = [
      ...(outRes.data?.result?.transfers || []),
      ...(inRes.data?.result?.transfers || [])
    ];

    const totalTxCount = items.length;

    let totalValueEth = 0;
    items.forEach((tx: any) => {
      totalValueEth += tx.value || 0;
    });

    const { score } = calculateScore({ txCount: totalTxCount, totalValueEth });

    return NextResponse.json({
      score,
      txCount: totalTxCount,
      volume: totalValueEth.toFixed(4),
      network
    });

  } catch (error: any) {
    console.error("ALCHEMY API ERROR:", error.response?.data || error.message);
    return NextResponse.json({
      error: 'Score calculation failed via Alchemy Engine',
      details: error.response?.data?.message || error.message
    }, { status: 500 });
  }
}
