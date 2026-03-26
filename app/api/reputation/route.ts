import { NextResponse } from 'next/server';
import { Alchemy, Network, AssetTransfersCategory } from 'alchemy-sdk';

const LIDO_CONTRACT = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84".toLowerCase();
const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2".toLowerCase();
const UNISWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45".toLowerCase();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  
  if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

  const settings = {
    apiKey: process.env.ALCHEMY_API_KEY || "EiTDJYuKpalOvRb0kjdNy",
    network: Network.ETH_MAINNET,
  };

  const alchemy = new Alchemy(settings);

  try {
    // 1. Fetch Latest Block to compare age
    const latestBlock = await alchemy.core.getBlockNumber();

    // 2. Fetch Protocol Interactions (Limited to latest to build profile quickly)
    // In production we would paginate or use custom indexers
    const transfers = await alchemy.core.getAssetTransfers({
      fromBlock: "0x0",
      toBlock: "latest",
      fromAddress: address,
      category: [
        AssetTransfersCategory.EXTERNAL, 
        AssetTransfersCategory.ERC20, 
        AssetTransfersCategory.SPECIALNFT
      ],
      maxCount: 1000, // 1000 txs
    });

    const items = transfers.transfers;

    // Protocol Volume Tally
    let uniVolume = 0;
    let aaveVolume = 0;
    let lidoVolume = 0;
    let earliestBlock = latestBlock;

    items.forEach(tx => {
      const to = tx.to?.toLowerCase();
      const val = tx.value || 0;

      if (to === UNISWAP_ROUTER) uniVolume += val;
      if (to === AAVE_POOL) aaveVolume += val;
      if (to === LIDO_CONTRACT) lidoVolume += val;

      const blockNum = parseInt(tx.blockNum, 16);
      if (blockNum < earliestBlock) earliestBlock = blockNum;
    });

    // Roughly 1 block every 12 seconds in Ethereum
    const blocksElapsed = latestBlock - earliestBlock;
    const walletAgeDays = Math.max(Math.floor((blocksElapsed * 12) / 86400), 1);

    return NextResponse.json({ 
      walletAgeDays,
      protocols: {
        uniswap: uniVolume,
        aave: aaveVolume,
        lido: lidoVolume
      }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("ALCHEMY REPUTATION API ERROR:", msg);
    return NextResponse.json({ 
      error: 'Reputation analysis failed', 
      details: msg 
    }, { status: 500 });
  }
}
