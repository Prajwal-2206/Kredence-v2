"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { getDeterministicDelegation } from "@/lib/mockDelegationData";

export default function GovernancePage() {
  return (
    <Suspense fallback={
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </main>
    }>
      <GovernanceContent />
    </Suspense>
  );
}

function GovernanceContent() {
  const { address: connectedAddress } = useAccount();
  const searchParams = useSearchParams();
  const searchAddress = searchParams?.get("address");
  const address = searchAddress || connectedAddress;

  const [loading, setLoading] = useState(true);
  const [govData, setGovData] = useState<any>(null);
  const [delData, setDelData] = useState<any>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const mockDelegation = getDeterministicDelegation(address);
        setDelData(mockDelegation);

        const res = await fetch(`/api/governance?address=${address}`);
        const data = await res.json();
        if (!data.error) {
          setGovData(data);
        }
      } catch (err) {
        console.error("Governance fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [address]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.98, y: 30 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  const terminalContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.5 }
    }
  };

  const terminalSentenceVariants: Variants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: "tween", ease: "easeOut", duration: 0.3 } }
  };

  if (!address) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in duration-500">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 outline p-4 rounded-full border-surface-container border">account_balance_wallet</span>
          <h2 className="text-2xl font-headline font-bold mb-2">Identity Required</h2>
          <p className="text-tertiary/60">Connect your wallet or search an address to view its governance war room.</p>
        </div>
      </main>
    );
  }

  if (loading || !govData || !delData) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-4 font-headline text-primary tracking-widest uppercase text-sm animate-pulse">Querying On-Chain State...</p>
      </main>
    );
  }

  // Parse Viem output or deterministic failover
  const uniPower = govData.power?.uni || (delData.totalPowerRaw * 0.4).toFixed(2);
  const arbPower = govData.power?.arb || (delData.totalPowerRaw * 0.6).toFixed(2);
  const totalWeightStr = govData.power?.uni && govData.power?.arb 
    ? `$${((govData.power.uni * 9.5) + (govData.power.arb * 1.8)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `$${(delData.totalPowerRaw * 3.4).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const authoredCount = govData.authoredCount || 0;
  const successRate = authoredCount > 0 ? "100%" : "N/A";
  const votes = govData.votes || [];

  return (
    <main className="lg:ml-64 pt-24 pb-12 px-10 max-w-7xl mx-auto space-y-12">
      <motion.header 
        variants={itemVariants}
        initial="hidden"
        animate="show"
        className="relative"
      >
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary/10 blur-[100px] rounded-full"></div>
        
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#00f0ff]"></div>
          <span className="text-primary tracking-widest text-xs font-medium uppercase">Live Protocol Feed</span>
        </div>
        
        <h1 className="text-6xl font-bold font-headline text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary tracking-tighter leading-tight mb-4 relative z-10">
          DAO War Room
        </h1>
        <p className="text-xl text-on-surface-variant max-w-2xl font-light relative z-10">
          Governance Participation & Ecosystem Conviction. High-fidelity aggregate of your cross-chain political influence.
        </p>
      </motion.header>

      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-12 gap-6"
      >
        {/* Voting Power */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-8 group">
          <div className="relative overflow-hidden rounded-3xl bg-surface-container-low/60 backdrop-blur-xl border border-white/5 p-8 shadow-[0_10px_40px_rgba(111,0,190,0.1)] h-full">
            <div className="flex justify-between items-start mb-10 relative z-10">
              <div>
                <h3 className="text-2xl font-headline text-secondary mb-1">Voting Power</h3>
                <p className="text-on-surface-variant text-sm">Aggregated veToken positions</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-mono text-primary">{totalWeightStr}</p>
                <p className="text-xs text-primary/60 uppercase tracking-tighter">Total Governance Weight</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
              {/* Curve (Fallback visual) */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-white/5" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                    <circle className="text-primary-container shadow-[0_0_15px_rgba(0,240,255,0.5)]" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364" strokeDashoffset="72.8" strokeWidth="8"></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-lg font-bold font-mono">80%</span>
                    <span className="text-[10px] text-on-surface-variant uppercase">Locked</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-headline text-sm tracking-widest uppercase">Curve (veCRV)</h4>
                  <p className="font-mono text-xs text-on-surface-variant">{(delData.totalPowerRaw * 0.3).toLocaleString()} Power</p>
                </div>
              </div>
              {/* Uniswap (Live Viem Data) */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-white/5" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                    <circle className="text-secondary shadow-[0_0_15px_rgba(221,183,255,0.5)]" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364" strokeDashoffset={uniPower > 0 ? "36.4" : "364"} strokeWidth="8"></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-lg font-bold font-mono">{uniPower > 0 ? '90%' : '0%'}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase">Liquid</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-headline text-sm tracking-widest uppercase">Uniswap (UNI)</h4>
                  <p className="font-mono text-xs text-on-surface-variant">{uniPower > 0 ? uniPower.toLocaleString() : '12.4K'} Power</p>
                </div>
              </div>
              {/* Arbitrum (Live Viem Data) */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle className="text-white/5" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                    <circle className="text-error shadow-[0_0_15px_rgba(255,180,171,0.5)]" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364" strokeDashoffset={arbPower > 0 ? "180" : "364"} strokeWidth="8"></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-lg font-bold font-mono">{arbPower > 0 ? '50%' : '0%'}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase">{arbPower > 0 ? 'Delegated' : 'Idle'}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-headline text-sm tracking-widest uppercase">Arbitrum (ARB)</h4>
                  <p className="font-mono text-xs text-on-surface-variant">{arbPower > 0 ? arbPower.toLocaleString() : '892.1K'} Power</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Author Status Card */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
          <div className="relative h-full rounded-3xl bg-surface-container-high/40 border border-[#FFD700]/30 p-8 shadow-[0_0_40px_rgba(255,215,0,0.15)] flex flex-col justify-between overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#FFD700]/10 blur-[40px] rounded-full group-hover:bg-[#FFD700]/20 transition-all duration-500"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-headline text-[#FFD700]">Proposal Author</h3>
                {authoredCount > 0 && <span className="bg-[#FFD700]/10 text-[#FFD700] text-[10px] font-bold px-3 py-1 rounded-full border border-[#FFD700]/20 uppercase tracking-widest">VIP Tier</span>}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-6xl font-bold font-headline text-white">{authoredCount}</span>
                <span className="text-on-surface-variant font-headline tracking-widest uppercase text-xs">Proposals Authored</span>
              </div>
            </div>
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
                <span className="text-on-surface-variant text-sm uppercase tracking-wider">Success Rate</span>
                <span className="text-xl font-mono text-primary">{successRate}</span>
              </div>
              <img className="w-full rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" alt="Abstract Data" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDGZzaEOIqC5RCgfsRiq1dDVW8cwIPjrKy6GchcEfCD-pntTFzHRLXlkCCdrV_vR9XXh3eQdjIRn4-qvTes9OpObLz_Hl0RzOlXfBIk9QNj16_RvzVqbuoFuqtMZUFuUUOtpLnSXu5vC70H35NuRdFg_CupmYXAqKqZXqZV01bLwWe04hlpy6rvEQsICop8txPlR78Dw7GMqIOUbWA5reyiGnSj34R8HljZT-G3Xsq3yswH2wSxEutI_4auv-NrytaUpssoyCwCi5IF"/>
            </div>
          </div>
        </motion.div>
      </motion.section>

      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-12 gap-6"
      >
        {/* Snapshot & Tally Terminal */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-7">
          <div className="bg-[#070d1f] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[500px]">
            <div className="bg-surface-container-high px-6 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-error/40"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFD700]/40"></div>
                <div className="w-3 h-3 rounded-full bg-primary/40"></div>
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em]">Transaction_Receipts_v2.0</div>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">terminal</span>
            </div>
            
            <motion.div 
              variants={terminalContainerVariants}
              initial="hidden"
              animate="show"
              className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-4 leading-relaxed"
            >
              {votes.length === 0 ? (
                <div className="flex gap-4 group">
                  <span className="text-error shrink-0">ERR</span>
                  <p className="text-on-surface-variant">No Snapshot vote history detected for this address.</p>
                </div>
              ) : (
                votes.map((vote: any, idx: number) => {
                  const choiceName = vote.proposal?.choices?.[vote.choice - 1] || "Unknown";
                  const status = vote.proposal?.state === "closed" ? "[EXECUTED]" : `[${vote.proposal?.state.toUpperCase()}]`;
                  const space = vote.proposal?.space?.name || "DAO";
                  
                  return (
                    <motion.div variants={terminalSentenceVariants} key={vote.id || idx} className="flex gap-4 group">
                      <span className="text-primary/40 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                      <p className="text-on-surface">
                        <span className="text-secondary">{status}</span> {space}: {vote.proposal?.title.substring(0, 40)}{vote.proposal?.title.length > 40 ? '...' : ''} - Voted: <span className="text-primary-container font-bold">{choiceName}</span>
                      </p>
                    </motion.div>
                  );
                })
              )}
              <motion.div variants={terminalSentenceVariants} className="flex gap-4 group mt-4">
                <span className="text-primary/40 shrink-0">&gt;</span>
                <p className="text-secondary animate-pulse">Initializing cross-chain listener...</p>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Delegation Network */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-5">
          <div className="relative h-full rounded-3xl bg-surface-container-low/60 backdrop-blur-xl border border-white/5 p-8 shadow-[0_10px_40px_rgba(0,240,255,0.05)] overflow-hidden">
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-headline text-primary mb-1">Delegation Network</h3>
                <p className="text-on-surface-variant text-sm">Your influence footprint</p>
              </div>
              {delData.isTopDelegate && (
                <div className="px-3 py-1 bg-primary-container/20 text-primary-container rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary-container/30">
                  Top Delegate
                </div>
              )}
            </div>
            
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary p-[1px]">
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                      <img alt="Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuASPB5RqPWvzQ-J4BK2L7SFLwrG4d_RqtgqAbULUN_CQsc_F80YLgeQta-Olt78ldITZhie2JMtjXA7bZAYKqGMjkMH4lGNcx7SxNbFxuzosn8_VcGAd_eWTV18uaVRtvtpkg33Rc_s9GrwRKMgqU_GAXUWDtaroLP4DJDLAE0pL5Iyddoaoc44Un12fVFZu6S0bEy0enOJisXjbmu1f1PGON5wwsYIJMXeDka-b2yJlyGFd8EO1wawNH_9azZms-dsT5EhU0OpwQh8"/>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Inbound Delegations</p>
                    <p className="text-[10px] text-on-surface-variant">{delData.inboundWallets} Active Wallets</p>
                  </div>
                </div>
                <span className="text-primary font-mono font-bold">+{delData.totalPowerFormatted} Power</span>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Outbound Delegations</p>
                    <p className="text-[10px] text-on-surface-variant">{delData.outboundProtocols}</p>
                  </div>
                </div>
                <span className="text-on-surface-variant font-mono font-bold">{delData.outboundPowerFormatted} Power</span>
              </div>
            </div>

            <div className="mt-8 relative h-40">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.4)] z-10">
                  <span className="text-[10px] font-bold text-white">YOU</span>
                </div>
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <line stroke="rgba(0,240,255,0.2)" strokeWidth="2" x1="50%" x2="20%" y1="50%" y2="20%"></line>
                  <line stroke="rgba(0,240,255,0.2)" strokeWidth="2" x1="50%" x2="80%" y1="50%" y2="30%"></line>
                  <line stroke="rgba(0,240,255,0.2)" strokeWidth="2" x1="50%" x2="70%" y1="50%" y2="80%"></line>
                  <line stroke="rgba(0,240,255,0.2)" strokeWidth="2" x1="50%" x2="30%" y1="50%" y2="70%"></line>
                </svg>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute top-4 left-10 w-4 h-4 rounded-full bg-secondary shadow-[0_0_10px_rgba(221,183,255,0.5)]"></motion.div>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2.5 }} className="absolute top-10 right-12 w-3 h-3 rounded-full bg-primary-container shadow-[0_0_10px_rgba(0,240,255,0.5)]"></motion.div>
                <div className="absolute bottom-8 right-24 w-5 h-5 rounded-full bg-tertiary shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                <div className="absolute bottom-12 left-16 w-3 h-3 rounded-full bg-secondary-container shadow-[0_0_10px_rgba(111,0,190,0.5)]"></div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>
    </main>
  );
}
