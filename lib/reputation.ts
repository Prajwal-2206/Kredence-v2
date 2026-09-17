const LIDO_CONTRACT = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84".toLowerCase();
const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2".toLowerCase();
const UNISWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45".toLowerCase();

const PROTOCOLS = {
  uniswap: UNISWAP_ROUTER,
  aave: AAVE_POOL,
  lido: LIDO_CONTRACT,
} as const;

type ProtocolKey = keyof typeof PROTOCOLS;

export interface TransferItem {
  to?: string | null;
  value?: number | null;
  /** Alchemy category; "external" is a native ETH transfer. */
  category?: string;
  blockNum: string;
  /** ISO timestamp from Alchemy's withMetadata, when available. */
  timestamp?: string | null;
}

export interface ProtocolVolumes {
  uniswap: number;
  aave: number;
  lido: number;
}

export interface ReputationResult {
  walletAgeDays: number;
  /** Native ETH moved into each protocol. */
  protocols: ProtocolVolumes;
  /** Transfers touching each protocol, token movements included. */
  interactions: ProtocolVolumes;
}

const emptyTally = (): ProtocolVolumes => ({ uniswap: 0, aave: 0, lido: 0 });

/** Earliest point in time a transfer set proves the wallet existed. */
function earliestOf(items: TransferItem[]): { block: number | null; ms: number | null } {
  let block: number | null = null;
  let ms: number | null = null;

  for (const tx of items) {
    const b = parseInt(tx.blockNum, 16);
    if (!Number.isNaN(b) && (block === null || b < block)) block = b;

    if (!tx.timestamp) continue;
    const t = Date.parse(tx.timestamp);
    if (!Number.isNaN(t) && (ms === null || t < ms)) ms = t;
  }

  return { block, ms };
}

/**
 * Analyzes raw Alchemy transfer items to produce:
 * - Native ETH volume sent to each tracked protocol, plus raw interaction counts
 * - Wallet age in days
 *
 * `outbound` carries the protocol interactions (user -> contract). `inbound` is
 * optional and only contributes to wallet age, so a wallet that mostly receives
 * still dates correctly.
 */
export function analyzeTransfers(
  outbound: TransferItem[],
  latestBlock: number,
  inbound: TransferItem[] = []
): ReputationResult {
  const protocols = emptyTally();
  const interactions = emptyTally();

  for (const tx of outbound) {
    const to = tx.to?.toLowerCase();
    if (!to) continue;

    for (const [name, contract] of Object.entries(PROTOCOLS) as [ProtocolKey, string][]) {
      if (to !== contract) continue;
      interactions[name] += 1;
      // Only native transfers are denominated in ETH. Summing an ERC20 `value`
      // here would report a 3,000 USDC swap as 3,000 ETH of volume.
      if (tx.category === 'external') protocols[name] += tx.value || 0;
    }
  }

  const first = earliestOf([...outbound, ...inbound]);

  let walletAgeDays: number;
  if (first.ms !== null) {
    walletAgeDays = Math.floor((Date.now() - first.ms) / 86_400_000);
  } else if (first.block !== null) {
    // ~12 seconds per Ethereum block
    walletAgeDays = Math.floor(((latestBlock - first.block) * 12) / 86_400);
  } else {
    walletAgeDays = 0;
  }

  return {
    walletAgeDays: Math.max(walletAgeDays, 0),
    protocols,
    interactions,
  };
}
