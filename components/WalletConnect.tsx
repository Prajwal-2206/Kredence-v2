"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status } = useConnect();
  const { disconnect } = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleConnect = (connector: any) => {
    try {
        connect({ connector });
        setIsModalOpen(false);
    } catch(err) {
        console.error("Connection error:", err);
    }
  };

  if (isConnected && address) {
    return (
      <button 
        onClick={() => disconnect()}
        className="px-6 py-2 rounded-full font-headline font-bold text-sm bg-surface-container-high text-primary hover:bg-surface-bright border border-primary/20 transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.1)] cursor-pointer"
      >
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary to-secondary"></div>
        {formatAddress(address)}
      </button>
    );
  }

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed px-6 py-2.5 rounded-full font-headline font-bold shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:opacity-90 active:scale-95 transition-all whitespace-nowrap cursor-pointer z-50 relative"
      >
        {status === 'pending' ? 'Connecting...' : 'Connect'}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-[#0c1324]/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl bg-white/10 backdrop-blur-2xl rounded-[2rem] p-1 shadow-2xl overflow-hidden border border-white/20">
            <div className="absolute inset-0 glass-highlight pointer-events-none"></div>
            
            <div className="relative z-10 p-8 md:p-10 flex flex-col items-center">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-8 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>

              <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-primary/20 rounded-full border border-primary/30">
                  <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_#00f0ff]"></span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-primary">Secure Connection</span>
                </div>
                <h2 className="text-3xl font-headline font-bold text-primary tracking-tight shadow-black drop-shadow-md">Connect Wallet</h2>
                <p className="text-on-surface-variant mt-2 text-sm">Select your preferred provider to enter the ecosystem</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full perspective-1000 relative z-20">
                {['MetaMask', 'Phantom', 'Rainbow'].map((walletName) => {
                  let icon = "login";
                  let bgClass = "bg-primary/20";
                  let iconColor = "text-primary";

                  const nameLower = walletName.toLowerCase();
                  if (nameLower === "metamask") {
                     bgClass = "bg-[#f6851b]/20";
                     iconColor = "text-[#f6851b]";
                     icon = "account_balance_wallet";
                  } else if (nameLower === "phantom") {
                     bgClass = "bg-[#ab9ff2]/20";
                     iconColor = "text-[#ab9ff2]";
                     icon = "token";
                  } else if (nameLower === "rainbow") {
                     bgClass = "bg-gradient-to-tr from-orange-400 to-blue-500";
                     iconColor = "text-white";
                     icon = "filter_vintage";
                  }

                  return (
                    <div key={walletName} onClick={() => {
                        const target = connectors.find(c => c.name.toLowerCase().includes(nameLower));
                        if (target) {
                            handleConnect(target);
                        } else {
                            // Target injected or WalletConnect as fallback if they don't have the specific extension
                            const fallback = connectors.find(c => c.name.toLowerCase().includes('injected') || c.name.toLowerCase().includes('walletconnect'));
                            if (fallback) handleConnect(fallback);
                        }
                    }} className="group relative preserve-3d hover-tilt transition-all duration-500 cursor-pointer">
                      <div className="h-full bg-[#151b2d]/90 hover:bg-[#23293c] p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-4 transition-all shadow-xl hover:shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${bgClass}`}>
                           {icon && <span className={`material-symbols-outlined text-4xl ${iconColor}`} style={{fontVariationSettings: "'FILL' 1"}}>{icon}</span>}
                        </div>
                        <span className="font-headline font-bold text-sm text-white text-center break-words max-w-full px-1">{walletName}</span>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="material-symbols-outlined text-primary text-sm">north_east</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 pt-8 w-full border-t border-white/10 text-center relative z-20">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  By connecting your wallet, you agree to our <span className="text-primary hover:underline cursor-pointer">Terms of Service</span>.
                </p>
                <div className="mt-6 flex justify-center gap-8">
                  <div className="flex items-center gap-2 text-on-surface-variant/80">
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold">Audited</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant/80">
                    <span className="material-symbols-outlined text-lg">shield</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold">Non-Custodial</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>
          </div>
        </div>
      )}
    </>
  );
}
