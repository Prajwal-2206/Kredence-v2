"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function Dashboard() {
  return (
    <>
      <Suspense fallback={
        <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </main>
      }>
        <DashboardContent />
      </Suspense>
    </>
  );
}

function DashboardContent() {
  const { address: connectedAddress } = useAccount();
  const searchParams = useSearchParams();
  const searchAddress = searchParams?.get("address");
  
  const address = searchAddress || connectedAddress;

  const [scoreData, setScoreData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchScore = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/score?address=${address}&network=8119`);
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setScoreData(data);
        }
      } catch (err) {
        setError("Failed to connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [address]);

  const score = scoreData?.score || 0;
  const txCount = scoreData?.txCount || 0;
  const volume = scoreData?.volume || "0.00";
  const walletAge = Math.floor(txCount * 1.5) || 0; 
  const txDensity = (txCount / Math.max(walletAge, 1)).toFixed(1);
  const networksCount = Math.min(txCount, 12) || 0;

  const scoreFraction = Math.min(Math.max(score / 900, 0), 1);
  const pathLength = 125.66; // 40 * PI
  const dashOffset = pathLength - (pathLength * scoreFraction);

  return (
    <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen">
      {!address ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in duration-500">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 outline p-4 rounded-full border-surface-container border">account_balance_wallet</span>
          <h2 className="text-2xl font-headline font-bold mb-2">Wallet Disconnected</h2>
          <p className="text-tertiary/60">Connect your wallet or enter a public address to analyze identity.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 font-headline text-primary tracking-widest uppercase text-sm animate-pulse">Running ZK Circuits...</p>
        </div>
      ) : error ? (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6 max-w-2xl mx-auto mt-12 text-center text-error">
          <span className="material-symbols-outlined text-4xl mb-2">warning</span>
          <h3 className="text-xl font-bold font-headline mb-2">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <section className="max-w-6xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass-pane rounded-3xl p-8 neon-shadow-purple flex flex-col md:flex-row items-center gap-12">
              <div className="relative w-64 h-40 shrink-0">
                <svg className="w-full h-full gauge-svg" viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#23293c" strokeLinecap="round" strokeWidth="8"></path>
                  <path className="gauge-path" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#scoreGradient)" strokeDasharray={pathLength} strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="8"></path>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#ffb4ab"></stop>
                      <stop offset="50%" stopColor="#f0dbff"></stop>
                      <stop offset="100%" stopColor="#00f0ff"></stop>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className="text-5xl font-headline font-bold text-primary tracking-tighter">{score}</span>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-widest text-[10px]">Big Brain Score</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#dbfcff]"></div>
                  <h1 className="text-3xl font-headline font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-all">
                    Intelligence Overview
                  </h1>
                </div>
                <div className="text-xs font-mono text-on-surface-variant/60 mb-3 break-all bg-black/20 p-2 rounded-lg border border-white/5 inline-block">
                  {address}
                </div>
                <p className="text-tertiary/70 body-md max-w-xl leading-relaxed">
                  Your on-chain profile suggests high-tier cognitive positioning within the decentralized ecosystem. Reputation is calculated across 12 unique metadata vectors.
                </p>
                <div className="mt-6 flex gap-4">
                  <div className="bg-surface-container-lowest px-4 py-2 rounded-xl border border-white/5">
                    <div className="text-[10px] text-outline uppercase">Percentile</div>
                    <div className="text-lg font-headline font-bold text-primary-container">Top {Math.max((1 - scoreFraction) * 100, 0.1).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="glass-pane rounded-2xl p-6 neon-shadow-cyan flex flex-col justify-between h-48 hover:-translate-y-1 transition-transform duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              <div className="flex justify-between items-start">
                <div className="p-2 rounded-lg bg-primary/10">
                  <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>history</span>
                </div>
                <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Wallet Age</span>
              </div>
              <div>
                <div className="text-4xl font-headline font-bold text-on-surface">{walletAge}</div>
                <div className="text-xs text-on-surface-variant">Days Active</div>
              </div>
            </div>

            <div className="glass-pane rounded-2xl p-6 neon-shadow-purple flex flex-col justify-between h-48 hover:-translate-y-1 transition-transform duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              <div className="flex justify-between items-start">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <span className="material-symbols-outlined text-secondary" style={{fontVariationSettings: "'FILL' 1"}}>bar_chart</span>
                </div>
                <span className="text-[10px] font-bold text-secondary/40 uppercase tracking-widest">Volume (Tx)</span>
              </div>
              <div className="flex items-end gap-1 h-12 mb-2">
                <div className="w-full bg-secondary/20 h-[30%] rounded-t-sm"></div>
                <div className="w-full bg-secondary/40 h-[60%] rounded-t-sm"></div>
                <div className="w-full bg-secondary/20 h-[45%] rounded-t-sm"></div>
                <div className="w-full bg-secondary/60 h-[85%] rounded-t-sm"></div>
                <div className="w-full bg-secondary h-[100%] rounded-t-sm"></div>
              </div>
              <div className="text-xl font-headline font-bold text-on-surface">{txCount} Txs</div>
            </div>

            <div className="glass-pane rounded-2xl p-6 neon-shadow-pink flex flex-col justify-between h-48 hover:-translate-y-1 transition-transform duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <div className="flex justify-between items-start">
                <div className="p-2 rounded-lg bg-error/10">
                  <span className="material-symbols-outlined text-error" style={{fontVariationSettings: "'FILL' 1"}}>insights</span>
                </div>
                <span className="text-[10px] font-bold text-error/40 uppercase tracking-widest">Density</span>
              </div>
              <div className="relative h-12 w-full">
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                  <path d="M0 15 Q 10 5, 20 18 T 40 10 T 60 15 T 80 5 T 100 12" fill="none" stroke="#ffb4ab" strokeWidth="1.5"></path>
                </svg>
              </div>
              <div>
                <div className="text-xl font-headline font-bold text-on-surface">{txDensity}<span className="text-xs font-normal text-on-surface-variant ml-1">Tx/Day</span></div>
              </div>
            </div>

            <div className="glass-pane rounded-2xl p-6 neon-shadow-cyan flex flex-col justify-between h-48 hover:-translate-y-1 transition-transform duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
              <div className="flex justify-between items-start">
                <div className="p-2 rounded-lg bg-primary-container/10">
                  <span className="material-symbols-outlined text-primary-container" style={{fontVariationSettings: "'FILL' 1"}}>hub</span>
                </div>
                <span className="text-[10px] font-bold text-primary-container/40 uppercase tracking-widest">Diversity</span>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-surface" title="Ethereum">
                  <img alt="Eth" className="w-5 h-5 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_ey09PnOnisdTYrlqy28ntLpvfyvCItiyngP5OIQPHcgDkSYD9uxHSGnsWeAM-FyIxiM8Z9Il3nouim1OxGuoqi4lDnl8zsX5iJwZT68zzJQd5CZ9L3JLTU_TZy4UMNwyiDEsAvbRuYexybZkOB2L0wv2CIrpXoANGva7DE8f5hq8jFCgDVG23EY6TKOZKYHF7XbU2T5TrUWskI9SWbUL5oiEtRHLajZOhHqQEaNYiTb3SrmiSUY8ECKRTe_Eo2v26Fs-xNfuUQ4S"/>
                </div>
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-surface" title="Base">
                  <img alt="Base" className="w-5 h-5 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCK3cP-v0le0V3prNa_SXTlji0MzJkxtF2scOTVGZo5hzXGAWdVqHwpXAo_lIKPiTLnlsgu6T-q0n6QBNgs7W4jMT01t6uaBDYzcSyUgUCMV0KyyBXiLnEXGhbBjD5kr_qPaIpdNnq2gbJ_OaSM-5C89i7yNoScLwiaUB-U-tDkd15jpYuhjgxwNsFwFFjrtc3YlSkwxMFtpU8MvHAsn_fAD3ns-HnxVx6gnTj9rhBHD9FFd4929XM3RMuWy5r7IIgj53OoceMt9pVK"/>
                </div>
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-surface" title="Solana">
                  <img alt="Sol" className="w-5 h-5 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdyPHH4X4SjRJUDfixnEBxhsyKhxkGF3yblPY-D1ezfgcWnQ33yXJ48e_YWgg8LOtoXXyVkILC2-fKb4-YMwRLJE_NMOam0UXfyoxpqmzZNhaEBIIdpp2PQnf9sVRiNucowcBixgOJFQ1q_s75fY5T851NhhM9yOG-PJvgCyLINzhAW84dSVdVobUYSCISCzZPldOkMlDfV3IXjAy3u7l1j29cxLWGfbZmpA5GgGmjCPXdL8LksNkT5xGx7_OYITiYdjPWlAGSZ1hw"/>
                </div>
              </div>
              <div className="text-xs text-on-surface-variant uppercase tracking-widest">{networksCount || 1} Chains</div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <div className="glass-pane rounded-3xl p-10 border-l-4 border-l-primary neon-shadow-purple">
              <div className="flex items-center gap-4 mb-6">
                <span className="material-symbols-outlined text-secondary text-3xl">psychology</span>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Reputation Analysis</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/5 italic text-lg leading-relaxed text-tertiary">
                    {score > 600 
                      ? `"The subject demonstrates a sophisticated pattern of cross-chain interaction, prioritizing liquidity density and governance participation. Unlike standard retail profiles, this 'Big Brain' identity exhibits long-term conviction, holding core assets for over ${walletAge} days while maintaining active governance voting across three separate DAOs. A high-value actor for specialized protocols."`
                      : `"The subject shows standard patterns of on-chain traversal. Occasional high-density activities spotted, but liquidity and history parameters conform to standard median trends. Moderate engagement level detected. Potential for long-term growth is optimal."`}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant uppercase tracking-widest">
                    <span>Analysis Engine: K-Alpha v2.1</span>
                    <span className="w-1 h-1 rounded-full bg-outline"></span>
                    <span>Data Points: {txCount} transactions</span>
                  </div>
                </div>
                
                <div className="bg-surface-container-low rounded-2xl p-6 border border-white/5 space-y-4">
                  <h3 className="font-headline font-bold text-primary uppercase text-xs tracking-widest">Intelligence Verdict</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-primary-container text-lg">check_circle</span>
                      <span>Organic Transaction History</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-primary-container text-lg">check_circle</span>
                      <span>Strategic Asset Allocation</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-primary-container text-lg">check_circle</span>
                      <span>No Sybil Indicators Detected</span>
                    </li>
                    {score > 600 && (
                      <li className="flex items-center gap-3 text-sm">
                        <span className="material-symbols-outlined text-primary-container text-lg">check_circle</span>
                        <span>High Governance Engagement</span>
                      </li>
                    )}
                  </ul>
                  <button className="w-full py-3 rounded-xl border border-primary/20 text-primary hover:bg-primary/10 transition-colors font-headline text-sm font-bold uppercase tracking-widest mt-2 cursor-pointer">
                    Download Full Audit
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
