import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import {
  CHAINS,
  AAVE_POOL_ABI,
  toPosition,
  computeCreditMetrics,
  calculateCreditScore,
  buildCreditNarrative,
  type LendingPosition,
  type RawAccountData,
  type CreditChain,
} from "@/lib/credit";
import { redactSecrets } from "@/lib/redact";

/**
 * Live credit risk for a wallet, read straight from Aave v3 pools.
 *
 * Deliberately independent of the Alchemy key that /api/score depends on:
 * these are plain `eth_call` reads, so public RPCs serve them fine. That
 * keeps credit scoring working on all ten chains regardless of which
 * networks the provider plan has enabled.
 */

/** Per-RPC budget. Short, because each chain has fallbacks to get through. */
const RPC_TIMEOUT_MS = 12_000;

/**
 * Read one chain's account data, walking the RPC candidates in order.
 *
 * Returns null only when every candidate failed — the caller records that as
 * an unavailable chain, never as an empty position. Conflating the two is
 * precisely the bug that made the transfer scorer under-report chain
 * diversity for every wallet it ever scored.
 */
async function readChain(
  chain: CreditChain,
  address: `0x${string}`
): Promise<{ position: LendingPosition | null; errors: string[] }> {
  const errors: string[] = [];

  for (const rpc of chain.rpcs) {
    try {
      const client = createPublicClient({
        transport: http(rpc, { timeout: RPC_TIMEOUT_MS, retryCount: 0 }),
      });

      // Confirm the endpoint really serves the chain we think it does before
      // trusting a position read from it. A misrouted RPC would otherwise
      // attribute one chain's debt to another.
      const servedChainId = await client.getChainId();
      if (servedChainId !== chain.chainId) {
        errors.push(`${hostOf(rpc)}: served chain ${servedChainId}, expected ${chain.chainId}`);
        continue;
      }

      const raw = (await client.readContract({
        address: chain.aavePool,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [address],
      })) as unknown as RawAccountData;

      return { position: toPosition(chain, raw), errors };
    } catch (e: unknown) {
      const msg = e instanceof Error ? (e.message.split("\n")[0] ?? e.message) : String(e);
      errors.push(`${hostOf(rpc)}: ${msg.slice(0, 120)}`);
    }
  }

  return { position: null, errors };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("address")?.trim() ?? "";

  if (!raw) {
    return NextResponse.json({ error: "No address provided" }, { status: 400 });
  }
  if (!isAddress(raw)) {
    return NextResponse.json({ error: "Not a valid EVM address" }, { status: 400 });
  }
  const address = raw as `0x${string}`;

  /**
   * Optional K-Alpha score, passed through by the dashboard so a wallet with
   * no debt can still be scored on standing. Ignored unless it parses to a
   * sane 0–900 figure — a caller-supplied number must never be able to inflate
   * a credit grade by arriving malformed.
   */
  const behaviouralRaw = searchParams.get("behavioural");
  const parsed = behaviouralRaw === null ? NaN : Number(behaviouralRaw);
  const behaviouralScore =
    Number.isFinite(parsed) && parsed >= 0 && parsed <= 900 ? Math.round(parsed) : null;

  try {
    const results = await Promise.all(
      CHAINS.map(async (chain) => ({ chain, ...(await readChain(chain, address)) }))
    );

    const positions = results
      .map((r) => r.position)
      .filter((p): p is LendingPosition => p !== null);

    const unavailable = results.filter((r) => r.position === null);
    const unavailableChains = unavailable.map((r) => r.chain.name);

    // Failures are logged server-side with full detail and redacted before
    // they can reach the client.
    for (const u of unavailable) {
      console.error(`[credit] ${u.chain.name} unreachable:`, redactSecrets(u.errors.join(" | ")));
    }

    const metrics = computeCreditMetrics(positions, unavailableChains);
    const result = calculateCreditScore(metrics, behaviouralScore);

    return NextResponse.json({
      address,
      creditScore: result.creditScore,
      grade: result.grade,
      risk: result.risk,
      liquidationProbability: result.liquidationProbability,
      thinFile: result.thinFile,

      components: result.components,
      warnings: result.warnings,
      notMeasured: result.notMeasured,

      totalCollateralUsd: metrics.totalCollateralUsd,
      totalDebtUsd: metrics.totalDebtUsd,
      totalAvailableBorrowsUsd: metrics.totalAvailableBorrowsUsd,
      debtToCollateral: metrics.debtToCollateral,
      minHealthFactor: metrics.minHealthFactor,
      weightedHealthFactor: metrics.weightedHealthFactor,

      positions: metrics.positions,
      narrative: buildCreditNarrative(metrics, result),

      coverage: {
        complete: unavailableChains.length === 0,
        chainsRead: CHAINS.length - unavailableChains.length,
        chainsTotal: CHAINS.length,
        unavailableChains,
        emptyChains: metrics.emptyChains,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("CREDIT ENGINE ERROR:", message);
    return NextResponse.json(
      { error: "Credit assessment failed", details: redactSecrets(message) },
      { status: 500 }
    );
  }
}
