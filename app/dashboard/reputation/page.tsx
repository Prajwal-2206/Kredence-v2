"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export default function ReputationPage() {
  return (
    <Suspense fallback={
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </main>
    }>
      <ReputationContent />
    </Suspense>
  );
}

interface ProtocolTally {
  uniswap: number;
  aave: number;
  lido: number;
}

interface AlchemyData {
  walletAgeDays: number;
  /** Native ETH sent to each protocol. */
  protocols: ProtocolTally;
  /** Transfers touching each protocol, token movements included. */
  interactions?: ProtocolTally;
}

function ReputationContent() {
  const { address: connectedAddress } = useAccount();
  const searchParams = useSearchParams();
  const searchAddress = searchParams?.get("address");

  const address = searchAddress || connectedAddress;

  const [loading, setLoading] = useState(true);
  const [alchemyData, setAlchemyData] = useState<AlchemyData | null>(null);
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
        const res = await fetch(`/api/reputation?address=${address}`);
        const data = await res.json();

        if (data.error) {
          setError(data.details ? `${data.error}: ${data.details}` : data.error);
        } else {
          setAlchemyData(data);
        }
      } catch (err) {
        console.error(err);
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
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (!address) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in duration-500">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 outline p-4 rounded-full border-surface-container border">account_balance_wallet</span>
          <h2 className="text-2xl font-headline font-bold mb-2">Identity Required</h2>
          <p className="text-tertiary/60">Connect your wallet or search an address to view its reputation matrix.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin"></div>
        <p className="mt-4 font-headline text-secondary tracking-widest uppercase text-sm animate-pulse">Querying On-Chain Data...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen">
        <div className="bg-error/10 border border-error/20 rounded-2xl p-6 max-w-2xl mx-auto mt-12 text-center text-error">
          <span className="material-symbols-outlined text-4xl mb-2">warning</span>
          <h3 className="text-xl font-bold font-headline mb-2">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  const walletAge = alchemyData?.walletAgeDays ?? 0;
  const uniswapVol = alchemyData?.protocols?.uniswap ?? 0;
  const aaveVol = alchemyData?.protocols?.aave ?? 0;
  const lidoVol = alchemyData?.protocols?.lido ?? 0;
  const totalVol = uniswapVol + aaveVol + lidoVol;

  // Interaction counts catch protocol usage that moves no native ETH — a USDC
  // swap through the Uniswap router has zero ETH volume but is still activity.
  const uniswapTx = alchemyData?.interactions?.uniswap ?? 0;
  const aaveTx = alchemyData?.interactions?.aave ?? 0;
  const lidoTx = alchemyData?.interactions?.lido ?? 0;
  const protocolsUsed = [uniswapTx, aaveTx, lidoTx].filter(n => n > 0).length;
  const hasActivity = protocolsUsed > 0 || totalVol > 0 || walletAge > 1;

  /**
   * Radar is driven by ETH volume when there is any, and falls back to raw
   * interaction counts when a wallet trades purely in tokens — otherwise a busy
   * stablecoin trader would render as an empty chart.
   */
  const useVolume = totalVol > 0;
  const metric = (vol: number, txs: number) => (useVolume ? vol : txs);
  const maxMetric = Math.max(
    metric(uniswapVol, uniswapTx),
    metric(aaveVol, aaveTx),
    metric(lidoVol, lidoTx),
    1
  );
  const radarData = [
    { subject: 'Uniswap', A: Math.min((metric(uniswapVol, uniswapTx) / maxMetric) * 100, 100), fullMark: 100 },
    { subject: 'Aave', A: Math.min((metric(aaveVol, aaveTx) / maxMetric) * 100, 100), fullMark: 100 },
    { subject: 'Lido', A: Math.min((metric(lidoVol, lidoTx) / maxMetric) * 100, 100), fullMark: 100 },
    { subject: 'Wallet Age', A: Math.min(walletAge / 10, 100), fullMark: 100 },
    { subject: 'Diversity', A: protocolsUsed * 33, fullMark: 100 },
  ];

  /** "1.20 ETH" when native value moved, else "3 interactions", else nothing. */
  const formatVolume = (vol: number, txs: number) => {
    if (vol > 0) return `${vol.toFixed(2)} ETH`;
    if (txs > 0) return `${txs} interaction${txs === 1 ? '' : 's'}`;
    return 'No activity';
  };

  return (
    <main className="lg:ml-64 pt-24 pb-12 px-10 min-h-screen">
      <motion.header
        variants={itemVariants}
        initial="hidden"
        animate="show"
        className="mb-12 flex flex-col md:flex-row justify-between items-end gap-8"
      >
        <div className="max-w-2xl">
          <div className="flex items-center space-x-3 mb-4">
            <span className="w-3 h-3 rounded-full bg-primary-container shadow-[0_0_10px_#00f0ff]"></span>
            <span className="text-primary tracking-widest text-xs font-headline font-bold uppercase">On-Chain Reputation</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold text-white leading-none mb-6">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent italic break-all">
              {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </span>
          </h1>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2 glass-pane px-4 py-2 rounded-full border border-white/5">
              <span className="text-secondary font-bold">{walletAge}</span>
              <span className="text-on-surface-variant text-xs font-medium">Days Active</span>
            </div>
            <div className="flex items-center space-x-2 glass-pane px-4 py-2 rounded-full border border-white/5">
              <span className="text-primary-container font-bold">{protocolsUsed}</span>
              <span className="text-on-surface-variant text-xs font-medium">Protocols Used</span>
            </div>
          </div>
        </div>
      </motion.header>

      {!hasActivity ? (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center justify-center h-[40vh] text-center"
        >
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">search_off</span>
          <h2 className="text-2xl font-headline font-bold mb-2">No Protocol Activity Found</h2>
          <p className="text-tertiary/60 max-w-md">This wallet has no recorded interactions with Uniswap, Aave, or Lido on Ethereum Mainnet.</p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Radar Chart Section */}
          <motion.section variants={itemVariants} className="col-span-12 lg:col-span-7 glass-pane rounded-3xl p-8 relative overflow-hidden h-[500px] border border-white/5 neon-shadow-cyan">
            <div className="relative z-10">
              <h3 className="text-xl font-headline font-bold text-white mb-2">Protocol Interaction Matrix</h3>
              <p className="text-on-surface-variant text-sm max-w-sm">Multidimensional analysis of DeFi protocol engagement depth.</p>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pt-10">
              <ResponsiveContainer width="90%" height="90%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#b9cacb', fontSize: 10, fontWeight: 'bold', textAnchor: 'middle' }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Protocol Profile"
                    dataKey="A"
                    stroke="#00f0ff"
                    fill="rgba(0, 240, 255, 0.25)"
                    fillOpacity={0.8}
                    activeDot={{ r: 6, fill: '#dbfcff', stroke: '#00f0ff', strokeWidth: 2 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          {/* Protocol Trust Tiers */}
          <motion.section variants={itemVariants} className="col-span-12 lg:col-span-5 glass-pane rounded-3xl p-8 flex flex-col justify-between border border-white/5 neon-shadow-purple">
            <div>
              <h3 className="text-xl font-headline font-bold text-white mb-2">Protocol Trust Tiers</h3>
              <p className="text-on-surface-variant text-sm mb-8">Interaction depth across major liquidity layers.</p>
            </div>

            <div className="space-y-4">
              <motion.div whileHover={{ scale: 1.02 }} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-primary">swap_horiz</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Uniswap</p>
                    <p className="text-xs text-on-surface-variant">LPs & Swaps</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-primary font-headline font-bold">{formatVolume(uniswapVol, uniswapTx)}</p>
                  <p className="text-[10px] uppercase text-on-surface-variant tracking-tighter">Volume</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-secondary">account_balance</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Aave</p>
                    <p className="text-xs text-on-surface-variant">Borrow/Lend</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-primary font-headline font-bold">{formatVolume(aaveVol, aaveTx)}</p>
                  <p className="text-[10px] uppercase text-on-surface-variant tracking-tighter">Volume</p>
                </div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-tertiary">water_drop</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Lido</p>
                    <p className="text-xs text-on-surface-variant">Liquid Staking</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-primary font-headline font-bold">{formatVolume(lidoVol, lidoTx)}</p>
                  <p className="text-[10px] uppercase text-on-surface-variant tracking-tighter">Staked</p>
                </div>
              </motion.div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-on-surface-variant">Total Protocol Volume</span>
              <span className="text-2xl font-headline font-bold text-white">{totalVol > 0 ? `${totalVol.toFixed(2)} ETH` : "0 ETH"}</span>
            </div>
          </motion.section>
        </motion.div>
      )}
    </main>
  );
}
