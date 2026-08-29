const LIDO_CONTRACT = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84".toLowerCase();
const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2".toLowerCase();
const UNISWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45".toLowerCase();

export interface TransferItem {
  to?: string | null;
  value?: number | null;
  blockNum: string;
}

export interface ProtocolVolumes {
  uniswap: number;
  aave: number;
  lido: number;
}

export interface ReputationResult {
  walletAgeDays: number;
  protocols: ProtocolVolumes;
}

/**
 * Analyzes raw Alchemy transfer items to produce:
 * - Protocol-specific volumes (Uniswap, Aave, Lido)
 * - Wallet age in days (derived from earliest block number)
 */
export function analyzeTransfers(
  items: TransferItem[],
  latestBlock: number
): ReputationResult {
  let uniVolume = 0;
  let aaveVolume = 0;
  let lidoVolume = 0;
  let earliestBlock = latestBlock;

  for (const tx of items) {
    const to = tx.to?.toLowerCase();
    const val = tx.value || 0;

    if (to === UNISWAP_ROUTER) uniVolume += val;
    if (to === AAVE_POOL) aaveVolume += val;
    if (to === LIDO_CONTRACT) lidoVolume += val;

    const blockNum = parseInt(tx.blockNum, 16);
    if (blockNum < earliestBlock) earliestBlock = blockNum;
  }

  // ~12 seconds per Ethereum block
  const blocksElapsed = latestBlock - earliestBlock;
  const walletAgeDays = Math.max(Math.floor((blocksElapsed * 12) / 86400), 1);

  return {
    walletAgeDays,
    protocols: {
      uniswap: uniVolume,
      aave: aaveVolume,
      lido: lidoVolume,
    },
  };
}
