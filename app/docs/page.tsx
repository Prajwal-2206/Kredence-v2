"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DocsPage() {
  const [activeHash, setActiveHash] = useState("#vision");

  useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash || "#vision");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="flex pt-16 font-body text-on-surface bg-background min-h-screen">
      <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#0c1324]/40 backdrop-blur-2xl border-r border-white/5 flex flex-col p-6 gap-2 overflow-y-auto z-40">
        <div className="mb-6">
          <h3 className="text-[#dbfcff] font-headline font-bold text-lg">Documentation</h3>
          <p className="text-[#f4f6ff]/50 text-xs uppercase tracking-widest">v2.0.4-beta</p>
        </div>
        
        <a href="#vision" className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeHash === '#vision' ? 'bg-white/10 text-[#dbfcff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'text-[#f4f6ff]/50 hover:bg-white/5 hover:translate-x-1'}`}>
          <span className="material-symbols-outlined text-sm">visibility</span>
          <span className="font-label text-sm">Vision</span>
        </a>
        
        <a href="#usage" className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeHash === '#usage' ? 'bg-white/10 text-[#dbfcff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'text-[#f4f6ff]/50 hover:bg-white/5 hover:translate-x-1'}`}>
          <span className="material-symbols-outlined text-sm">auto_fix_high</span>
          <span className="font-label text-sm">How to Use</span>
        </a>
        
        <a href="#stack" className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeHash === '#stack' ? 'bg-white/10 text-[#dbfcff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'text-[#f4f6ff]/50 hover:bg-white/5 hover:translate-x-1'}`}>
          <span className="material-symbols-outlined text-sm">memory</span>
          <span className="font-label text-sm">Under the Hood</span>
        </a>
        
        <a href="#math" className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeHash === '#math' ? 'bg-white/10 text-[#dbfcff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'text-[#f4f6ff]/50 hover:bg-white/5 hover:translate-x-1'}`}>
          <span className="material-symbols-outlined text-sm">functions</span>
          <span className="font-label text-sm">Math</span>
        </a>
        
        <a href="#setup" className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeHash === '#setup' ? 'bg-white/10 text-[#dbfcff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'text-[#f4f6ff]/50 hover:bg-white/5 hover:translate-x-1'}`}>
          <span className="material-symbols-outlined text-sm">terminal</span>
          <span className="font-label text-sm">Local Setup</span>
        </a>
      </aside>

      <main className="ml-64 w-full min-h-screen p-12 lg:px-24">
        <section className="mb-24 relative pt-12" id="vision">
          <div className="absolute top-0 -left-24 w-96 h-96 bg-primary-container/10 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_#00f0ff] animate-pulse"></span>
              <span className="text-primary font-mono text-sm tracking-widest uppercase">Live Mainnet v2</span>
            </div>
            <h1 className="text-6xl font-headline font-bold text-gradient mb-8 tracking-tighter leading-tight">
                Multi-Chain <br/>Reputation Engine
            </h1>
            <div className="glass-pane p-8 rounded-2xl border border-white/5 shadow-2xl max-w-3xl">
              <h2 className="text-2xl font-headline font-bold text-secondary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">psychology</span>
                The Vision
              </h2>
              <p className="text-tertiary/80 leading-relaxed text-lg">
                Trad-fi credit scores are a centralized joke. Kredence v2 is an elite, multi-chain decentralized credit scoring engine built to decode on-chain reputation. We transform complex wallet telemetry into a portable, verifiable trust score.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-24 pt-20" id="usage">
          <h2 className="text-4xl font-headline font-bold text-gradient mb-12">How to Use the App</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-surface-container-low p-6 rounded-xl border-t border-white/10 hover:bg-surface-container-high transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary mb-4 font-headline">1</div>
              <h3 className="font-bold mb-2 font-headline">Connect</h3>
              <p className="text-sm text-on-surface-variant">Hit the glowing "Connect" button to authenticate your identity privately.</p>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl border-t border-white/10 hover:bg-surface-container-high transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary mb-4 font-headline">2</div>
              <h3 className="font-bold mb-2 font-headline">Dashboard</h3>
              <p className="text-sm text-on-surface-variant">Launch the app to reveal your parsed analytics across EVM ecosystem chains.</p>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl border-t border-white/10 hover:bg-surface-container-high transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary mb-4 font-headline">3</div>
              <h3 className="font-bold mb-2 font-headline">Analyze</h3>
              <p className="text-sm text-on-surface-variant">Our engine crawls your transaction history, DeFi positions, and overall age in real-time.</p>
            </div>
          </div>
        </section>

        <section className="mb-24 pt-20" id="stack">
          <h2 className="text-4xl font-headline font-bold text-gradient mb-12">Under the Hood</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[500px]">
            <div className="md:col-span-2 md:row-span-2 glass-pane rounded-2xl p-8 border border-white/5 flex flex-col justify-end relative overflow-hidden group min-h-[300px]">
              <img className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700 pointer-events-none" alt="Neural network grid" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7IUPWxgOX0z9bhXgJ1vkHSas4IDpBt3Ws8RmNraKIoNcSWk6j9PWul24kuytjuBiI-8gjMQHeIR94wNZL0-HOoGda0VqfEeL--vP8a5VOY9q1rnzw0YXGnSxrVJq_-BwCiVs1tkMlXU2yb36o2xtVTHr8Uv_jVfVvhXvEI7AqpwMqy5jocM9kAH2IAtW41g1j3Cqg9davYt4v-fXK90W3D3PuPIlTOTFh6GoPbsExCiWHAvozP4Z_SbPWiIBt5JbInTKqhy9ZpBfx"/>
              <div className="relative z-10">
                <h3 className="text-3xl font-headline font-bold mb-2 text-primary">Next.js 15</h3>
                <p className="text-on-surface-variant">The core framework powering server-side reputation compute and lightning-fast UI hydration.</p>
              </div>
            </div>
            <div className="md:col-span-2 glass-pane rounded-2xl p-6 border border-white/5 flex items-center gap-4">
              <div className="bg-secondary-container/20 p-4 rounded-xl shrink-0">
                <span className="material-symbols-outlined text-secondary text-3xl">brush</span>
              </div>
              <div>
                <h4 className="font-bold font-headline">Tailwind CSS v4</h4>
                <p className="text-xs text-on-surface-variant mt-1">Atomic styling for the high-fidelity glassmorphism interface.</p>
              </div>
            </div>
            <div className="glass-pane rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
              <span className="material-symbols-outlined text-primary mb-2 text-3xl">hub</span>
              <h4 className="font-bold text-sm font-headline pt-2">Wagmi + Query</h4>
            </div>
            <div className="glass-pane rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
              <span className="material-symbols-outlined text-primary mb-2 text-3xl">database</span>
              <h4 className="font-bold text-sm font-headline pt-2">Moralis API</h4>
            </div>
          </div>
        </section>

        <section className="mb-24 pt-20" id="math">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h2 className="text-4xl font-headline font-bold text-gradient">The Alpha: WLC Algorithm</h2>
            <span className="px-4 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-primary w-fit">ALGO_VER: 2.0.4</span>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="glass-pane p-8 rounded-2xl border border-white/10">
                <h4 className="text-sm font-mono text-primary mb-4 uppercase tracking-widest">Normalized Metrics</h4>
                <div className="bg-black/40 p-6 rounded-xl font-mono text-lg text-center border border-white/5 overflow-x-auto whitespace-nowrap">
                    N<sub>i</sub> = (X<sub>i</sub> - X<sub>min</sub>) / (X<sub>max</sub> - X<sub>min</sub>)
                </div>
                <p className="mt-4 text-sm text-on-surface-variant italic">Ensures all parameters (age, density, volume, chains) are scaled to a unified 0-1 range.</p>
              </div>
              <div className="glass-pane p-8 rounded-2xl border border-white/10 bg-gradient-to-br from-surface-container-low to-secondary-container/10 border-t-secondary/20 border-l-secondary/20">
                <h4 className="text-sm font-mono text-secondary mb-4 uppercase tracking-widest">Final Weighted Score</h4>
                <div className="bg-black/40 p-6 rounded-xl font-mono text-lg text-center border border-white/5 overflow-x-auto whitespace-nowrap">
                    Score = (Σ(W<sub>i</sub> * N<sub>i</sub>)) * 1000
                </div>
              </div>
            </div>
            
            <div className="glass-pane p-8 rounded-2xl border border-white/5 h-full flex flex-col">
              <h3 className="font-headline font-bold text-xl mb-6 text-tertiary">Ecosystem Weights</h3>
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                  <span>Transaction Volume</span>
                  <span className="font-mono text-primary font-bold">W = 0.40</span>
                </div>
                <div className="flex justify-between items-center p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                  <span>Wallet Active Age</span>
                  <span className="font-mono text-primary font-bold">W = 0.35</span>
                </div>
                <div className="flex justify-between items-center p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                  <span>Cross-Chain Reach</span>
                  <span className="font-mono text-primary font-bold">W = 0.25</span>
                </div>
              </div>
              <div className="mt-8 p-4 bg-error/10 border border-error/20 rounded-lg">
                <p className="text-xs text-error leading-relaxed">Warning: Scores are refreshed dynamically via Moralis API to prevent manipulation via sybil attacks or flash loan balance bloating.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24 pt-20" id="setup">
          <h2 className="text-4xl font-headline font-bold text-gradient mb-8">Local Setup</h2>
          <div className="space-y-6">
            <div>
              <p className="mb-4 font-bold text-tertiary">1. Clone &amp; Install</p>
              <div className="bg-[#070d1f] p-6 rounded-xl border border-white/10 font-mono text-sm relative group overflow-hidden">
                <div className="text-[#00dbe9] mb-1">git clone https://github.com/kredence/v2-engine.git</div>
                <div className="text-[#00dbe9]">cd v2-engine && npm install</div>
              </div>
            </div>
            
            <div>
              <p className="mb-4 font-bold text-tertiary">2. Setup Secrets</p>
              <div className="bg-[#070d1f] p-6 rounded-xl border border-white/10 font-mono text-sm leading-relaxed">
                <div className="text-on-surface-variant opacity-50 mb-2"># .env.local</div>
                <div className="text-[#ddb7ff]">MORALIS_API_KEY="your_api_key_here"</div>
              </div>
            </div>
            
            <div>
              <p className="mb-4 font-bold text-tertiary">3. Ignite the Engine</p>
              <div className="bg-[#070d1f] p-6 rounded-xl border border-white/10 font-mono text-sm">
                <div className="text-[#00f0ff] font-bold">npm run dev</div>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-12 pb-8 border-t border-white/5 text-center mt-32">
          <p className="text-on-surface-variant text-sm mb-4">Built with precision for the decentralized future.</p>
          <div className="flex justify-center gap-8">
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-headline uppercase tracking-widest" href="#">GitHub</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-headline uppercase tracking-widest" href="#">Twitter</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-headline uppercase tracking-widest" href="#">Discord</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
