"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import type { CreditComponent, LendingPosition, LiquidationRisk } from "@/lib/credit";

/**
 * Credit report — K-Credit v1.0.
 *
 * Reads live Aave v3 positions rather than transfer history, so this page
 * answers "can this wallet be lent to?" where the main dashboard answers
 * "is this wallet real?". The two scores are deliberately shown apart:
 * K-Alpha is cumulative and stable, K-Credit is instantaneous and can change
 * with the price of collateral between one refresh and the next.
 */

interface CreditResponse {
  address: string;
  creditScore: number;
  grade: string;
  risk: LiquidationRisk;
  liquidationProbability: number;
  thinFile: boolean;
  components: CreditComponent[];
  warnings: string[];
  notMeasured: string[];
  totalCollateralUsd: number;
  totalDebtUsd: number;
  totalAvailableBorrowsUsd: number;
  debtToCollateral: number;
  minHealthFactor: number | null;
  weightedHealthFactor: number | null;
  positions: LendingPosition[];
  narrative: string;
  coverage: {
    complete: boolean;
    chainsRead: number;
    chainsTotal: number;
    unavailableChains: string[];
    emptyChains: string[];
  };
}

const RISK_STYLE: Record<LiquidationRisk, { text: string; bg: string; border: string; label: string }> = {
  critical: { text: "text-error", bg: "bg-error/10", border: "border-error/30", label: "Critical" },
  high: { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30", label: "High" },
  moderate: { text: "text-amber-300", bg: "bg-amber-300/10", border: "border-amber-300/20", label: "Moderate" },
  low: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20", label: "Low" },
  none: { text: "text-tertiary/60", bg: "bg-white/5", border: "border-white/10", label: "No debt" },
};

const usd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`;

function CreditReport() {
  const params = useSearchParams();
  const { address: connected } = useAccount();
  const address = params.get("address") ?? connected ?? "";

  /**
   * Settled result for one specific address, rather than separate data/error/
   * loading flags.
   *
   * Keyed by the address it describes, so "loading" is derived — true whenever
   * the settled result does not yet correspond to the address being viewed.
   * That removes the synchronous setState this effect used to do on every
   * address change, which triggered an extra render pass and tripped
   * react-hooks/set-state-in-effect. It also fixes a real bug: the previous
   * version briefly showed the *previous* wallet's credit report while the
   * next one was still in flight.
   */
  const [settled, setSettled] = useState<{
    address: string;
    data: CreditResponse | null;
    error: string | null;
  }>({ address: "", data: null, error: null });

  const loading = address !== "" && settled.address !== address;
  const data = settled.address === address ? settled.data : null;
  const error = settled.address === address ? settled.error : null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    fetch(`/api/credit?address=${address}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setSettled({ address, data: null, error: json.details ? `${json.error}: ${json.details}` : json.error });
        } else {
          setSettled({ address, data: json as CreditResponse, error: null });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSettled({ address, data: null, error: e instanceof Error ? e.message : String(e) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Connect a wallet or pass <span className="font-mono text-primary">?address=0x…</span> to pull a credit report.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-on-surface-variant animate-pulse">
        Reading live lending positions across 10 chains…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 m-6 rounded-2xl bg-error/10 border border-error/20 text-error text-sm">{error}</div>
    );
  }

  if (!data) return null;

  const risk = RISK_STYLE[data.risk];

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-6xl">
      <div>
        <h1 className="font-headline text-2xl uppercase tracking-widest text-primary">Credit Report</h1>
        <p className="text-xs text-on-surface-variant mt-1 font-mono">{data.address}</p>
      </div>

      {/* Headline score + risk band */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-surface-container-low border border-primary/10 p-6 flex flex-col justify-between">
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">K-Credit Score</div>
          <div className="flex items-end gap-3 mt-3">
            <span className="font-headline text-5xl text-primary">{data.creditScore}</span>
            <span className="text-sm text-on-surface-variant mb-2">/ 900</span>
          </div>
          <div className="mt-2 text-xs text-on-surface-variant">
            Grade <span className="text-primary font-semibold">{data.grade}</span>
            {data.thinFile && <span className="ml-2 opacity-60">· thin file</span>}
          </div>
        </div>

        <div className={`rounded-2xl ${risk.bg} border ${risk.border} p-6 flex flex-col justify-between`}>
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Liquidation Risk</div>
          <div className={`font-headline text-3xl mt-3 ${risk.text}`}>{risk.label}</div>
          <div className="mt-2 text-xs text-on-surface-variant">
            {data.minHealthFactor === null
              ? "No borrowed position"
              : `Modelled at ${(data.liquidationProbability * 100).toFixed(1)}% · health factor ${data.minHealthFactor.toFixed(3)}`}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-low border border-primary/10 p-6 flex flex-col justify-between">
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Debt to Collateral</div>
          <div className="font-headline text-3xl text-primary mt-3">
            {Math.round(data.debtToCollateral * 100)}%
          </div>
          <div className="mt-2 text-xs text-on-surface-variant">
            {usd(data.totalDebtUsd)} against {usd(data.totalCollateralUsd)}
          </div>
        </div>
      </div>

      <p className="text-sm text-on-surface-variant leading-relaxed">{data.narrative}</p>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="rounded-2xl bg-amber-400/5 border border-amber-400/20 p-5 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest text-amber-400/70">Attention</div>
          {data.warnings.map((w, i) => (
            <div key={i} className="text-sm text-amber-200/90">• {w}</div>
          ))}
        </div>
      )}

      {/* Score components */}
      <div className="rounded-2xl bg-surface-container-low border border-primary/10 p-6">
        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mb-4">
          How this score was built
        </div>
        <div className="flex flex-col gap-4">
          {data.components.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-on-surface">{c.label}</span>
                <span className="font-mono text-primary text-xs">
                  {c.value} / {c.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 mt-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${c.max > 0 ? (c.value / c.max) * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-on-surface-variant/70 mt-1">{c.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Positions */}
      <div className="rounded-2xl bg-surface-container-low border border-primary/10 p-6">
        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mb-4">
          Open positions · Aave v3
        </div>
        {data.positions.length === 0 ? (
          <div className="text-sm text-on-surface-variant">No open position on any readable chain.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.positions.map((p) => (
              <div
                key={`${p.chainId}-${p.protocol}`}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="text-sm text-on-surface">{p.chainName}</div>
                <div className="flex gap-6 text-xs font-mono">
                  <span className="text-on-surface-variant">supplied {usd(p.collateralUsd)}</span>
                  <span className="text-on-surface-variant">borrowed {usd(p.debtUsd)}</span>
                  <span className={p.healthFactor !== null && p.healthFactor < 1.25 ? "text-error" : "text-primary"}>
                    HF {p.healthFactor === null ? "—" : p.healthFactor.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coverage + honesty panel. Mirrors the main dashboard: a chain we could
          not read is reported as unknown, never rendered as a zero balance. */}
      <div className="rounded-2xl bg-surface-container-lowest border border-white/5 p-6 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Coverage</div>
        <div className="text-xs text-on-surface-variant">
          Read {data.coverage.chainsRead} of {data.coverage.chainsTotal} chains.
          {data.coverage.unavailableChains.length > 0 && (
            <span className="text-amber-400/80">
              {" "}
              Unreachable: {data.coverage.unavailableChains.join(", ")} — positions there are unknown, not zero.
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-2">Not measured</div>
        <ul className="text-xs text-on-surface-variant/70 flex flex-col gap-1">
          {data.notMeasured.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function CreditPage() {
  return (
    <Suspense fallback={<div className="p-8 text-on-surface-variant">Loading…</div>}>
      <CreditReport />
    </Suspense>
  );
}
