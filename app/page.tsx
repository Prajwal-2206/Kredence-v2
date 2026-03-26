"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isConnected } = useAccount();
  const [inputAddress, setInputAddress] = useState("");
  const router = useRouter();

  const handleLaunch = () => {
    if (inputAddress.trim().length > 0) {
      router.push(`/dashboard?address=${inputAddress.trim()}`);
    } else {
      router.push(isConnected ? "/dashboard" : "/");
    }
  };

  return (
    <>
      <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden neon-mesh px-6 py-24 pt-32">
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-secondary-container/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-primary-container/5 blur-[150px] rounded-full"></div>

        <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 relative group">
            <div className="absolute inset-0 bg-white/5 rounded-[2.5rem] blur-2xl -rotate-1 group-hover:rotate-0 transition-transform duration-700"></div>
            <div className="relative bg-black/20 backdrop-blur-2xl rounded-[2.5rem] p-10 md:p-16 glass-edge border border-white/5 shadow-2xl shadow-black/40">
              <div className="flex items-center gap-3 mb-8">
                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#dbfcff]"></span>
                <span className="text-primary text-[0.6875rem] font-bold tracking-[0.2rem] uppercase">System Online: v2.0.4</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-headline font-bold leading-[1.1] mb-6 text-gradient tracking-tighter">
                Kredence v2
              </h1>
              
              <p className="text-lg md:text-xl text-tertiary/70 font-light leading-relaxed mb-10 max-w-lg">
                Your Multi-Chain Reputation, Decoded. Seamlessly aggregate trust scores across EVM, Solana, and Cosmos into a single, sovereign identity.
              </p>
              
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center w-full max-w-xl">
                  <input 
                    type="text" 
                    value={inputAddress}
                    onChange={(e) => setInputAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLaunch()}
                    placeholder="Enter Wallet Address (0x...)" 
                    className="flex-1 min-w-[280px] px-6 py-4 rounded-full bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none text-white font-mono placeholder:text-white/30 backdrop-blur-md shadow-inner transition-colors"
                  />
                  <button onClick={handleLaunch} className="group relative px-10 py-4 rounded-full font-headline font-bold text-lg bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:shadow-[0_0_35px_rgba(0,240,255,0.5)] transition-all duration-500 cursor-pointer text-center whitespace-nowrap">
                     Launch App
                    <div className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping opacity-20 group-hover:opacity-40 pointer-events-none"></div>
                  </button>
                </div>
                
                <div className="flex items-center gap-4 px-2">
                  <span className="w-12 h-[1px] bg-white/10"></span>
                  <Link href="/docs" target="_blank" className="font-headline font-bold text-sm text-primary hover:text-white transition-colors cursor-pointer uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">library_books</span> Documentation
                  </Link>
                  <span className="w-12 h-[1px] bg-white/10"></span>
                </div>
              </div>

              <div className="mt-16 flex items-center gap-12 pt-12 border-t border-white/5">
                <div>
                  <div className="text-2xl font-headline font-bold text-primary">420K+</div>
                  <div className="text-[0.6875rem] uppercase tracking-widest text-on-surface-variant">Active Identities</div>
                </div>
                <div>
                  <div className="text-2xl font-headline font-bold text-secondary">12+</div>
                  <div className="text-[0.6875rem] uppercase tracking-widest text-on-surface-variant">L1/L2 Protocols</div>
                </div>
                <div>
                  <div className="text-2xl font-headline font-bold text-tertiary">$1.2B</div>
                  <div className="text-[0.6875rem] uppercase tracking-widest text-on-surface-variant">Reputation Value</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex justify-center items-center">
            <div className="relative w-72 h-72 md:w-96 md:h-96 group">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full relative animate-[pulse_6s_infinite] transition-transform duration-1000 group-hover:scale-110">
                  <div className="absolute inset-0 border border-primary/20 rounded-full blur-xl animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img className="w-full h-full object-cover rounded-full opacity-40 mix-blend-screen grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmipkclZxR5loAJRZVE3AUCLVeLcFrY-bCkfCYInwyzZYfUqbTJvbvgPOY1owJ59MqHxu4xTzcv8vDpEBUr65hpVSCOjvTw3ylI8ns91k15PBfJ16dLDkkRtJcn5sj4mVAzFvm2RpPBWnooj3T7hRtoAIiuOMIyX_U98rC0PKU6HBFC4zzYJNu6ePdoOKagVnJUxMQxGBEZKjeQ2C2Vj2z9NFknXnYIp2vyDoceZ8Xnk7awCUWW58-DduVSJm4KyMCbDHqJI_67Gs8" alt="Abstract crystalline structure"/>
                  </div>
                  <div className="absolute top-10 left-10 w-4 h-4 rounded-full bg-primary/40 blur-sm animate-bounce"></div>
                  <div className="absolute bottom-20 right-0 w-6 h-6 rounded-full bg-secondary/30 blur-md animate-pulse"></div>
                  <div className="absolute top-1/2 -right-10 w-2 h-2 rounded-full bg-tertiary animate-ping"></div>
                </div>
              </div>

              <div className="absolute -bottom-8 -left-8 bg-surface-container/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary p-[1px]">
                    <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-sm" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">Vitalik.eth</div>
                    <div className="text-[0.6rem] text-primary uppercase font-bold tracking-widest">Kredence Score: 994</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 w-48 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-4/5 bg-primary shadow-[0_0_10px_#00f0ff]"></div>
                  </div>
                  <div className="flex justify-between text-[0.6rem] text-on-surface-variant font-bold uppercase tracking-tighter">
                    <span>Security Rank</span>
                    <span>Tier 01</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="relative bg-surface py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-headline font-bold mb-6 text-gradient inline-block">Engineered for Sovereignty</h2>
            <p className="text-tertiary/60 max-w-2xl text-lg">Beyond standard metrics. Kredence aggregates complex on-chain behaviors into human-readable reputation signatures.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
            <Link href="https://etherscan.io/" target="_blank" className="md:col-span-8 relative rounded-[2rem] overflow-hidden bg-surface-container-low group cursor-pointer border border-white/5 block">
              <img className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAj59ZYCSL3urArdQdcCQMjWspePoZ44sh7nyJP5Ss0WjVRqICR-qfGecVO026KIskAb1j2mrXKQMuJKu03qnVdApB9DHRSXy1rtr-r81iLQOIES_HaFdvL_0P5JP1CptMOjBh4yn7xMUGMKkLt501ujC5X3oeBWJ6GIoCAWpYGSo42c6lCSNv0oEexI5Ke2MBRhEgCbJC40bNv7O63jWGBQzjFKI64s7sYPDLJyZDY94hFGDtAFf7ABGHBLuozsF1MrnV5WDkCOHx" alt="Server Data"/>
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
              <div className="relative h-full flex flex-col justify-end p-10">
                <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center mb-6 overflow-hidden">
                  <span className="material-symbols-outlined text-primary text-3xl group-hover:rotate-45 group-hover:scale-125 transition-transform duration-500 delay-100">hub</span>
                </div>
                <h3 className="text-3xl font-headline font-bold text-white mb-4">Hyper-Connected Nodes</h3>
                <p className="text-tertiary/70 max-w-md">Connect your entire Web3 footprint. From DAO contributions to DeFi liquidity positions, nothing is left behind.</p>
              </div>
            </Link>
            
            <Link href="https://www.zkdocs.com/" target="_blank" className="md:col-span-4 relative rounded-[2rem] overflow-hidden bg-surface-container-high group cursor-pointer border border-white/5 block">
              <div className="relative h-full flex flex-col p-10">
                <div className="w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-secondary text-3xl group-hover:rotate-12 group-hover:scale-125 group-hover:-translate-y-1 transition-all duration-300">shield_lock</span>
                </div>
                <h3 className="text-2xl font-headline font-bold text-white mb-4">ZK-Privacy Proofs</h3>
                <p className="text-tertiary/70 mb-8">Prove your status without revealing your wallets. Powered by Zero-Knowledge circuits.</p>
                <div className="mt-auto overflow-hidden rounded-xl border border-white/5 aspect-square relative glass-pane flex items-center justify-center">
                  <div className="absolute inset-0 bg-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:scale-110 group-hover:grayscale-0 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfCZWq1VZiVDX4SXhojyOVvboHLmqD70N2oIkkppdIdDoEWkwTFx6Tkqu1KHn83PSTF4VEyBt5nFpsHhIjS70nI1W8Hsr38RTnW4FqnoTuzSzDvRVz7aR8nIpJ-JIfGuIrz489b8wsFoQl07vyYOXLwuKMy0yyujsmi3Djp6vWn5FPfd3jHGsD38MKE24h35Gok5yusEIfr5OHgsnR5LHhpm9KusC3wV-TJARi7CJwUrkt4HOeT9bFflfNctLPhfgk1bNaTejYbAQM" alt="Geometry"/>
                </div>
              </div>
            </Link>
            
            <Link href="https://opensea.io/" target="_blank" className="md:col-span-4 relative rounded-[2rem] overflow-hidden bg-surface-container-highest group cursor-pointer border border-white/5 block">
              <div className="relative h-full flex flex-col p-10">
                <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-tertiary text-3xl group-hover:text-primary group-hover:rotate-180 group-hover:drop-shadow-[0_0_10px_#dbfcff] transition-all duration-700">auto_awesome</span>
                </div>
                <h3 className="text-2xl font-headline font-bold text-white mb-4 group-hover:text-primary transition-colors">Dynamic NFTs</h3>
                <p className="text-tertiary/70 group-hover:text-tertiary/90 transition-colors">Your ID evolves as you do. Watch your visual avatar grow with every successful governance vote.</p>
              </div>
            </Link>
            
            <div className="md:col-span-8 relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-secondary-container/30 to-primary-container/10 group cursor-pointer border border-white/5">
              <div className="relative h-full flex flex-col md:flex-row items-center p-10 gap-10">
                <div className="flex-1">
                  <h3 className="text-3xl font-headline font-bold text-white mb-4">Institutional Grade</h3>
                  <p className="text-tertiary/70 mb-6">Built for protocols that demand verified liquidity and reliable participant history. Kredence API bridges the gap.</p>
                  <button className="text-primary font-bold text-sm tracking-widest uppercase hover:underline">Explore API</button>
                </div>
                <div className="w-full md:w-1/2 h-40 md:h-full flex items-center justify-center">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-3xl border border-white/20 rotate-12 absolute -top-4 -left-4"></div>
                    <div className="w-32 h-32 rounded-3xl border border-white/20 -rotate-12 absolute -bottom-4 -right-4"></div>
                    <div className="w-32 h-32 rounded-3xl bg-primary-container/20 backdrop-blur-xl border border-white/30 flex items-center justify-center relative z-10">
                      <span className="material-symbols-outlined text-primary text-5xl">api</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-surface-container-lowest py-20 px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-6 max-w-xs">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent font-headline">Kredence v2</span>
            <p className="text-sm text-tertiary/40 leading-relaxed">The decentralized identity layer for the multi-chain future. Own your reputation, anywhere.</p>
            <div className="flex gap-4">
              <Link href="#links" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 transition-colors"><span className="material-symbols-outlined text-sm">language</span></Link>
              <Link href="#links" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 transition-colors"><span className="material-symbols-outlined text-sm">terminal</span></Link>
              <Link href="#links" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 transition-colors"><span className="material-symbols-outlined text-sm">share</span></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
            <div className="space-y-4">
              <h4 className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">Ecosystem</h4>
              <ul className="space-y-2 text-sm text-tertiary/50">
                <li><Link href="#gov" className="hover:text-primary transition-colors">Governance</Link></li>
                <li><Link href="#stake" className="hover:text-primary transition-colors">Staking</Link></li>
                <li><Link href="#grants" className="hover:text-primary transition-colors">Grants</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">Developers</h4>
              <ul className="space-y-2 text-sm text-tertiary/50">
                <li><Link href="#sdk" className="hover:text-primary transition-colors">SDK Guide</Link></li>
                <li><Link href="#contracts" className="hover:text-primary transition-colors">Contracts</Link></li>
                <li><Link href="#audit" className="hover:text-primary transition-colors">Audit</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-headline font-bold text-xs uppercase tracking-widest text-on-surface">Legal</h4>
              <ul className="space-y-2 text-sm text-tertiary/50">
                <li><Link href="#privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link href="#terms" className="hover:text-primary transition-colors">Terms</Link></li>
                <li><Link href="#cookies" className="hover:text-primary transition-colors">Cookies</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-16 mt-16 border-t border-white/5 text-[0.6rem] uppercase tracking-[0.2rem] text-tertiary/20 text-center">
          © 2024 Kredence Labs. Secured by Decentralized Trust.
        </div>
      </footer>
    </>
  );
}