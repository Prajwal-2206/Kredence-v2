"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LiquidationRisk } from "@/lib/credit";

/**
 * Compact K-Credit summary for the main dashboard.
 *
 * Deliberately a thin band rather than another stat card: credit standing is
 * a different kind of claim from the behavioural score above it, and giving
 * it its own row keeps the two from reading as one blended number.
 *
 * Fails quietly. A wallet with no lending position is the common case, and an
 * unreachable chain is a routine condition — neither should push an error
 * state onto a dashboard whose primary content loaded fine.
 */

interface CreditSummary {
  creditScore: number;
  grade: string;
  risk: LiquidationRisk;
  liquidationProbability: number;
  thinFile: boolean;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  minHealthFactor: number | null;
  coverage: { chainsRead: number; chainsTotal: number; unavailableChains: string[] };
}

const RISK: Record<LiquidationRisk, { label: string; text: string; dot: string }> = {
  critical: { label: "Critical", text: "text-error", dot: "bg-error" },
  high: { label: "High", text: "text-amber-400", dot: "bg-amber-400" },
  moderate: { label: "Moderate", text: "text-amber-300", dot: "bg-amber-300" },
  low: { label: "Low", text: "text-primary", dot: "bg-primary" },
  none: { label: "No debt", text: "text-tertiary/60", dot: "bg-tertiary/40" },
};

const usd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;

export default function CreditBand({
  address,
  behavioural,
}: {
  address: string | undefined;
  behavioural: number;
}) {
  const [settled, setSettled] = useState<{ address: string; data: CreditSummary | null }>({
    address: "",
    data: null,
  });

  const loading = !!address && settled.address !== address;
  const data = address && settled.address === address ? settled.data : null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    fetch(`/api/credit?address=${address}&behavioural=${behavioural}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setSettled({ address, data: json?.error ? null : (json as CreditSummary) });
      })
      .catch(() => {
        if (!cancelled) setSettled({ address, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [address, behavioural]);

  if (!address) return null;

  if (loading) {
    return (
      <div className="glass-pane rounded-2xl p-6 flex items-center gap-4 animate-pulse">
        <div className="h-3 w-3 rounded-full bg-primary/30" />
        <div className="text-xs text-on-surface-variant uppercase tracking-widest">
          Reading lending positions across 10 chains…
        </div>
      </div>
    );
  }

  if (!data) return null;

  const risk = RISK[data.risk];
  const hasPosition = data.totalCollateralUsd > 0 || data.totalDebtUsd > 0;

  return (
    <Link href={`/dashboard/credit?address=${address}`} className="block group">
      <div className="glass-pane rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 neon-shadow-cyan">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          {/* Score */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="p-2 rounded-lg bg-primary/10">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                credit_score
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                K-Credit
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-headline font-bold text-primary tracking-tighter">
                  {data.creditScore}
                </span>
                <span className="text-xs text-outline">/ 900</span>
                <span className="text-sm font-headline text-primary-container ml-1">{data.grade}</span>
              </div>
            </div>
          </div>

          {/* Risk */}
          <div className="flex items-center gap-3 shrink-0">
            <span className={`h-2 w-2 rounded-full ${risk.dot}`} />
            <div>
              <div className="text-[10px] text-outline uppercase tracking-widest">Liquidation risk</div>
              <div className={`text-sm font-headline ${risk.text}`}>
                {risk.label}
                {data.minHealthFactor !== null && (
                  <span className="text-on-surface-variant font-body ml-2 text-xs">
                    HF {data.minHealthFactor.toFixed(2)} · {(data.liquidationProbability * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Position */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-outline uppercase tracking-widest">Position</div>
            <div className="text-sm text-on-surface-variant truncate">
              {hasPosition ? (
                <>
                  {usd(data.totalCollateralUsd)} supplied
                  {data.totalDebtUsd > 0 ? ` · ${usd(data.totalDebtUsd)} borrowed` : " · nothing borrowed"}
                </>
              ) : (
                <span className="text-on-surface-variant/60">
                  No Aave v3 position on {data.coverage.chainsRead} readable chains
                </span>
              )}
              {data.coverage.unavailableChains.length > 0 && (
                <span className="text-amber-400/70">
                  {" "}
                  · {data.coverage.unavailableChains.length} chain
                  {data.coverage.unavailableChains.length === 1 ? "" : "s"} unreachable
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-primary/50 uppercase tracking-widest shrink-0 group-hover:text-primary transition-colors">
            Full report →
          </div>
        </div>
      </div>
    </Link>
  );
}
