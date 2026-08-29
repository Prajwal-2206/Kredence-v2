import { NextResponse } from 'next/server';
import { Alchemy, Network, AssetTransfersCategory } from 'alchemy-sdk';
import { analyzeTransfers } from '@/lib/reputation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing ALCHEMY_API_KEY' }, { status: 500 });
  }

  const alchemy = new Alchemy({ apiKey, network: Network.ETH_MAINNET });

  try {
    const latestBlock = await alchemy.core.getBlockNumber();

    const transfers = await alchemy.core.getAssetTransfers({
      fromBlock: "0x0",
      toBlock: "latest",
      fromAddress: address,
      category: [
        AssetTransfersCategory.EXTERNAL,
        AssetTransfersCategory.ERC20,
        AssetTransfersCategory.SPECIALNFT
      ],
      maxCount: 1000,
    });

    const result = analyzeTransfers(transfers.transfers, latestBlock);

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("ALCHEMY REPUTATION API ERROR:", msg);
    return NextResponse.json({
      error: 'Reputation analysis failed',
      details: msg
    }, { status: 500 });
  }
}
