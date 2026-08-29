import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet, arbitrum } from 'viem/chains';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
});

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
});

// The standard OpenZeppelin ERC20Votes interface used by many top DAOs
const VotesAbi = parseAbi([
  'function getVotes(address account) view returns (uint256)'
]);

const UNI_ADDR = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
const ARB_ADDR = '0x912CE59144191C1204E64559FE8253a0e49E6548';

export async function getLiveGovernancePower(address: string) {
  if (!address || !address.startsWith('0x')) return { uni: null, arb: null };

  const formattedAddress = address as `0x${string}`;

  try {
    const [uniVotesStr, arbVotesStr] = await Promise.all([
      ethClient.readContract({
        address: UNI_ADDR,
        abi: VotesAbi,
        functionName: 'getVotes',
        args: [formattedAddress]
      }).catch(() => 0n),
      arbClient.readContract({
        address: ARB_ADDR,
        abi: VotesAbi,
        functionName: 'getVotes',
        args: [formattedAddress]
      }).catch(() => 0n)
    ]);

    // UNI and ARB both use 18 decimals
    const uniPower = Number(uniVotesStr) / 1e18;
    const arbPower = Number(arbVotesStr) / 1e18;

    return {
      uni: uniPower > 0 ? uniPower : null,
      arb: arbPower > 0 ? arbPower : null
    };
  } catch (error) {
    console.error("Viem Contract Read Error:", error);
    return { uni: null, arb: null };
  }
}
