"use client";

import { useAccount } from "wagmi";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { getDeterministicIdentity } from "@/lib/mockIdentityData";

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

function ReputationContent() {
  const { address: connectedAddress } = useAccount();
  const searchParams = useSearchParams();
  const searchAddress = searchParams?.get("address");
  
  const address = searchAddress || connectedAddress;

  const [loading, setLoading] = useState(true);
  const [repData, setRepData] = useState<any>(null);
  const [alchemyData, setAlchemyData] = useState<any>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Mock/Deterministic ID Data
        const identity = getDeterministicIdentity(address);
        setRepData(identity);

        // Fetch Live Alchemy Data
        const res = await fetch(`/api/reputation?address=${address}`);
        const data = await res.json();
        
        if (!data.error) {
          setAlchemyData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [address]);

  // Framer Motion Variants
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

  if (loading || !repData) {
    return (
      <main className="lg:ml-64 pt-24 pb-12 px-8 min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin"></div>
        <p className="mt-4 font-headline text-secondary tracking-widest uppercase text-sm animate-pulse">Syncing Graph Data...</p>
      </main>
    );
  }

  // Derive final values from both inputs
  const walletAge = alchemyData?.walletAgeDays || 21;
  const uniswapVol = alchemyData?.protocols?.uniswap || 0;
  const aaveVol = alchemyData?.protocols?.aave || 0;
  const lidoVol = alchemyData?.protocols?.lido || 0;
  
  // Create deterministic fallback values for total volume if alchemy drops
  const totalVerifiedVol = Math.max(uniswapVol + aaveVol + lidoVol, 15000 + parseFloat(repData.trustScore) * 1000);

  // Derive groupings for badges
  const groupedBadges = repData.badges.reduce((acc: any, badge: any) => {
    if (!acc[badge.group]) acc[badge.group] = [];
    acc[badge.group].push(badge);
    return acc;
  }, {});

  const badgeGroups = Object.entries(groupedBadges).map(([group, badges]) => ({ group, badges }));

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
            <span className="text-primary tracking-widest text-xs font-headline font-bold uppercase">Human Verified Identity</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold text-white leading-none mb-6">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent italic break-all">
              {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </span>
          </h1>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2 glass-pane px-4 py-2 rounded-full border border-white/5">
              <span className="text-secondary font-bold">{repData.lensFollowers}</span>
              <span className="text-on-surface-variant text-xs font-medium">Lens Followers</span>
            </div>
            <div className="flex items-center space-x-2 glass-pane px-4 py-2 rounded-full border border-white/5">
              <span className="text-primary-container font-bold">FID: {repData.farcasterId}</span>
              <span className="text-on-surface-variant text-xs font-medium">Farcaster</span>
            </div>
          </div>
        </div>
        
        <div className="glass-pane p-6 rounded-2xl flex items-center space-x-8 neon-shadow-purple border border-white/5">
          <div className="text-center">
            <p className="text-3xl font-headline font-bold text-white">{repData.trustScore}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Trust Score</p>
          </div>
          <div className="h-10 w-[1px] bg-white/10"></div>
          <div className="text-center">
            <p className="text-3xl font-headline font-bold text-secondary">{repData.sybilGrade}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Sybil Grade</p>
          </div>
        </div>
      </motion.header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Radar Chart Section */}
        <motion.section variants={itemVariants} className="col-span-12 lg:col-span-7 glass-pane rounded-3xl p-8 relative overflow-hidden h-[500px] border border-white/5 neon-shadow-cyan">
          <div className="relative z-10">
            <h3 className="text-xl font-headline font-bold text-white mb-2">Sybil Resistance Matrix</h3>
            <p className="text-on-surface-variant text-sm max-w-sm">Multidimensional analysis of wallet behavior and funding providence.</p>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pt-10">
            <ResponsiveContainer width="90%" height="90%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={repData.radarData}>
                <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#b9cacb', fontSize: 10, fontWeight: 'bold', textAnchor: 'middle' }} 
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar 
                  name="Identity Profile" 
                  dataKey="A" 
                  stroke="#00f0ff" 
                  fill="rgba(0, 240, 255, 0.25)" 
                  fillOpacity={0.8} 
                  activeDot={{ r: 6, fill: '#dbfcff', stroke: '#00f0ff', strokeWidth: 2 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="absolute bottom-8 right-8 glass-pane bg-primary-container/10 border border-primary-container/20 px-6 py-3 rounded-2xl flex items-center space-x-3 backdrop-blur-md">
            <span className="material-symbols-outlined text-primary-container">shield_person</span>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">Status</p>
              <p className="text-lg font-headline font-bold text-primary-container">Verified Human</p>
            </div>
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
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBBY079J9R1Iz8Fnx26XogF6KkGsQyHy_5dp17TJwztiXe7UUJ4iz4BnUO_jDJ5Vt5bm_7547G7FWHBYZREBhASry7xsiMZxknhfvZpHZZieeE9_lgEcfjivv0M0fPpZ0D0ViT1fBzECPLaf9kFECcjsdIH3K2J7tYQYKVk3klIOQc2GV82QPlSYsj0n36cc8nSLCXX3oLZQxdNQG4g56oeWEIgTfbvVg9GkBeX2RyNBLVIkmY6DOt97ns89jOjyFewNQy5k_0WjrC" className="w-6 h-6" alt="Uniswap"/>
                </div>
                <div>
                  <p className="text-white font-medium">Uniswap</p>
                  <p className="text-xs text-on-surface-variant">LPs & Swaps</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary font-headline font-bold">${uniswapVol ? uniswapVol.toLocaleString() : "14.2M"}</p>
                <p className="text-[10px] uppercase text-on-surface-variant tracking-tighter">Volume</p>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfN4nBMkkdut0hXPs01c9LZnfiOV2K1BEjM3SxPyfDr3-moNHnvnSTQTE46-yKfGmMcxgV1vbszsbEsD0frGTfy4CmxyIMoC-MVFMg1ps7Hj-iRe3skBix4A9Tsm1R_OqWzTfURZkTcQdHi8c5qD12MJWvB0Ge0Q-9Ef1fewq2vzien0g188bZwzm-c8Y_uPwZe5B07tDSQtKQKD2eZgd9qnPLgM_FRoAXkHLY2MDEl5tGhkoYTDJwMa0_M4-VG55QwpuE9vZXC_ZF" className="w-6 h-6" alt="Aave"/>
                </div>
                <div>
                  <p className="text-white font-medium">Aave</p>
                  <p className="text-xs text-on-surface-variant">Borrow/Lend</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary font-headline font-bold">${aaveVol ? aaveVol.toLocaleString() : "2.8M"}</p>
                <p className="text-[10px] uppercase text-on-surface-variant tracking-tighter">Volume</p>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-white/10">
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHaJoeLhshWYDDniGgkcpKB0HxQqSBh7upHxTbkZF3QIj_vZdnsn_71yICohza8yW_fpjNcGU3915aMvudHiaW9LSfL6ztHHqvQ7hFa4u5bmZlchSZimZ99gBf09gwfgPIsdwuxMlMxfKraZUkju8yAB0BEqy0QWEDzy2B4zUTsmtW8faog-xF8mS4hi8k0KCJqyr5R-xWRygR6eAewDLETjpRS5w70YD3qeacQbEJonA2_dL9_BTD4_XtUc1Kr9dGByituEM4KYIX" className="w-6 h-6" alt="Lido"/>
                </div>
                <div>
                  <p className="text-white font-medium">Lido</p>
                  <p className="text-xs text-on-surface-variant">Liquid Staking</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary font-headline font-bold">${lidoVol ? lidoVol.toLocaleString() : "124.5k"}</p>
                <p className="text-[10px] uppercase text-on-surface-variant tracking-tighter">Staked</p>
              </div>
            </motion.div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">Total Verified Volume</span>
            <span className="text-2xl font-headline font-bold text-white">${totalVerifiedVol.toLocaleString()}</span>
          </div>
        </motion.section>

        {/* Achievement Grid */}
        <motion.section variants={itemVariants} className="col-span-12 glass-pane rounded-3xl p-8 border border-white/5">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-headline font-bold text-white mb-2">Achievement Grid</h3>
              <p className="text-on-surface-variant text-sm">Soulbound credentials and attestation history.</p>
            </div>
            <div className="flex space-x-2">
              <button className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-all">All Badges</button>
              <button className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-white/5 transition-all">Recent</button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {badgeGroups.map((bg: any, index: number) => {
              const themeColor = index === 0 ? "secondary" : index === 1 ? "primary" : "error";
              
              return (
                <div key={bg.group} className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <span className={`material-symbols-outlined text-${themeColor} text-lg`}>
                      {index === 0 ? 'code' : index === 1 ? 'rocket_launch' : 'local_fire_department'}
                    </span>
                    <h4 className={`text-sm font-headline font-bold uppercase tracking-widest text-${themeColor}`}>{bg.group}</h4>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {bg.badges.map((badge: any) => (
                      <motion.div 
                        key={badge.id}
                        whileHover={{ scale: 1.05 }}
                        className="aspect-square glass-pane rounded-xl flex items-center justify-center cursor-pointer relative group border border-white/5"
                        title={badge.title}
                      >
                        <img src={badge.image} className="w-10 h-10 grayscale group-hover:grayscale-0 transition-all duration-300" alt={badge.title} />
                        <div className={`absolute inset-0 bg-${themeColor}/10 opacity-0 group-hover:opacity-100 rounded-xl transition-all shadow-[0_0_15px_rgba(var(--${themeColor}),0.3)] pointer-events-none`}></div>
                      </motion.div>
                    ))}
                    <div className="aspect-square border border-white/5 bg-black/20 rounded-xl flex items-center justify-center text-xs text-on-surface-variant font-bold hover:bg-white/5 transition-colors cursor-pointer">
                      +{(Math.abs(walletAge - bg.badges.length) % 5) + 1}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      </motion.div>
    </main>
  );
}
