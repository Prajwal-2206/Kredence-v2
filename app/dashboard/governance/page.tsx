"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, Variants } from "framer-motion";

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

interface GovData {
  power: { uni: number | null; arb: number | null };
  votes: any[];
  authoredCount: number;
}

function GovernanceContent() {
  const { address: connectedAddress } = useAccount();
  const searchParams = useSearchParams();
  const searchAddress = searchParams?.get("address");
  const address = searchAddress || connectedAddress;

  const [loading, setLoading] = useState(true);
  const [govData, setGovData] = useState<GovData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/governance?address=${address}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setGovData(data);
        }
      } catch (err) {
        console.error("Governance fetch error:", err);
        setError("Failed to connect to the server.");
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

  if (loading) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-4 font-headline text-primary tracking-widest uppercase text-sm animate-pulse">Querying On-Chain State...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen">
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6 max-w-2xl mx-auto mt-12 text-center text-error">
          <span className="material-symbols-outlined text-4xl mb-2">warning</span>
          <h3 className="text-xl font-bold font-headline mb-2">Governance Query Failed</h3>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  const uniPower = govData?.power?.uni ?? 0;
  const arbPower = govData?.power?.arb ?? 0;
  const authoredCount = govData?.authoredCount ?? 0;
  const votes = govData?.votes ?? [];
  const hasAnyActivity = uniPower > 0 || arbPower > 0 || votes.length > 0 || authoredCount > 0;

  // Derive donut chart offsets from real power (proportion of full circle = 364 circumference)
  const maxPower = Math.max(uniPower, arbPower, 1);
  const uniOffset = 364 - Math.min((uniPower / maxPower) * 364, 364);
  const arbOffset = 364 - Math.min((arbPower / maxPower) * 364, 364);

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
          Governance Participation & Ecosystem Conviction. Real-time aggregate of your cross-chain political influence.
        </p>
      </motion.header>

      {!hasAnyActivity ? (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center justify-center h-[40vh] text-center"
        >
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">how_to_vote</span>
          <h2 className="text-2xl font-headline font-bold mb-2">No Governance Activity</h2>
          <p className="text-tertiary/60 max-w-md">This wallet has no UNI/ARB voting power, Snapshot votes, or authored proposals on record.</p>
        </motion.div>
      ) : (
        <>
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
                    <p className="text-on-surface-variant text-sm">On-chain token voting weight (UNI & ARB)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  {/* Uniswap */}
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle className="text-white/5" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                        <circle className="text-secondary shadow-[0_0_15px_rgba(221,183,255,0.5)]" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364" strokeDashoffset={uniPower > 0 ? uniOffset : 364} strokeWidth="8"></circle>
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-lg font-bold font-mono">{uniPower > 0 ? uniPower.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span>
                        <span className="text-[10px] text-on-surface-variant uppercase">Votes</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-headline text-sm tracking-widest uppercase">Uniswap (UNI)</h4>
                      <p className="font-mono text-xs text-on-surface-variant">{uniPower > 0 ? 'Active' : 'No delegation'}</p>
                    </div>
                  </div>
                  {/* Arbitrum */}
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle className="text-white/5" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                        <circle className="text-error shadow-[0_0_15px_rgba(255,180,171,0.5)]" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364" strokeDashoffset={arbPower > 0 ? arbOffset : 364} strokeWidth="8"></circle>
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-lg font-bold font-mono">{arbPower > 0 ? arbPower.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span>
                        <span className="text-[10px] text-on-surface-variant uppercase">Votes</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-headline text-sm tracking-widest uppercase">Arbitrum (ARB)</h4>
                      <p className="font-mono text-xs text-on-surface-variant">{arbPower > 0 ? 'Active' : 'No delegation'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Author Status Card */}
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
              <div className="relative h-full rounded-3xl bg-surface-container-high/40 border border-white/5 p-8 flex flex-col justify-between overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-headline text-secondary">Proposal Author</h3>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-6xl font-bold font-headline text-white">{authoredCount}</span>
                    <span className="text-on-surface-variant font-headline tracking-widest uppercase text-xs">Proposals Authored</span>
                  </div>
                </div>
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
                    <span className="text-on-surface-variant text-sm uppercase tracking-wider">Snapshot Votes</span>
                    <span className="text-xl font-mono text-primary">{votes.length}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.section>

          {/* Snapshot Vote History Terminal */}
          {votes.length > 0 && (
            <motion.section
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={itemVariants}>
                <div className="bg-[#070d1f] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[500px]">
                  <div className="bg-surface-container-high px-6 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-error/40"></div>
                      <div className="w-3 h-3 rounded-full bg-[#FFD700]/40"></div>
                      <div className="w-3 h-3 rounded-full bg-primary/40"></div>
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em]">Snapshot_Vote_History</div>
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">terminal</span>
                  </div>

                  <motion.div
                    variants={terminalContainerVariants}
                    initial="hidden"
                    animate="show"
                    className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-4 leading-relaxed"
                  >
                    {votes.map((vote: any, idx: number) => {
                      const choiceName = vote.proposal?.choices?.[vote.choice - 1] || "Unknown";
                      const status = vote.proposal?.state === "closed" ? "[EXECUTED]" : `[${vote.proposal?.state?.toUpperCase()}]`;
                      const space = vote.proposal?.space?.name || "DAO";

                      return (
                        <motion.div variants={terminalSentenceVariants} key={vote.id || idx} className="flex gap-4 group">
                          <span className="text-primary/40 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                          <p className="text-on-surface">
                            <span className="text-secondary">{status}</span> {space}: {vote.proposal?.title?.substring(0, 40)}{(vote.proposal?.title?.length ?? 0) > 40 ? '...' : ''} - Voted: <span className="text-primary-container font-bold">{choiceName}</span>
                          </p>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              </motion.div>
            </motion.section>
          )}
        </>
      )}
    </main>
  );
}
