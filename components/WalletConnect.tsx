"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";

/**
 * Wallet connect button and picker.
 *
 * Three things here are deliberate and were each previously broken:
 *
 * 1. The modal is rendered through a portal into document.body. It used to be
 *    a plain child of this component, which lives inside the top nav — and
 *    that nav sets `backdrop-blur-xl`. A non-none backdrop-filter makes an
 *    element a containing block for its fixed-position descendants, so
 *    `fixed inset-0` resolved against the nav's ~72px strip rather than the
 *    viewport, and the dialog rendered clipped against the top of the screen.
 *
 * 2. The wallet list comes from the connectors wagmi actually discovered,
 *    rather than a hardcoded ['MetaMask', 'Phantom', 'Rainbow']. The old list
 *    advertised wallets the user may not have while hiding ones they do, and
 *    its name-matching fell back to the generic injected connector — which,
 *    when Phantom has claimed window.ethereum, silently connects Phantom
 *    while the user is clicking MetaMask.
 *
 * 3. Connection outcome is surfaced. The old handler called connect() inside
 *    a try/catch and closed the modal immediately. wagmi's connect() is a
 *    mutation that reports failure asynchronously, so the catch never fired:
 *    a failed connection closed the dialog and showed nothing at all.
 */

/** Visual treatment per known wallet, with a neutral default for the rest. */
const WALLET_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  metamask: { bg: "bg-[#f6851b]/20", fg: "text-[#f6851b]", icon: "account_balance_wallet" },
  phantom: { bg: "bg-[#ab9ff2]/20", fg: "text-[#ab9ff2]", icon: "token" },
  rainbow: { bg: "bg-gradient-to-tr from-orange-400 to-blue-500", fg: "text-white", icon: "filter_vintage" },
  coinbase: { bg: "bg-[#0052ff]/20", fg: "text-[#4d8bff]", icon: "account_balance" },
  walletconnect: { bg: "bg-[#3b99fc]/20", fg: "text-[#3b99fc]", icon: "qr_code_2" },
  brave: { bg: "bg-[#fb542b]/20", fg: "text-[#fb542b]", icon: "shield" },
  rabby: { bg: "bg-[#7084ff]/20", fg: "text-[#7084ff]", icon: "pets" },
};

function styleFor(name: string) {
  const key = Object.keys(WALLET_STYLE).find((k) => name.toLowerCase().includes(k));
  return key
    ? WALLET_STYLE[key]
    : { bg: "bg-primary/20", fg: "text-primary", icon: "account_balance_wallet" };
}

/**
 * The connectors worth showing.
 *
 * Deduped by name, because EIP-6963 discovery and RainbowKit's defaults can
 * both advertise the same wallet. The generic "Injected" entry is dropped
 * when any named wallet was discovered — it is the one that silently routes
 * to whichever extension happens to own window.ethereum.
 */
function usableConnectors(connectors: readonly Connector[]): Connector[] {
  /*
   * When a wallet is advertised twice under one name, keep the EIP-6963
   * entry. A browser with the MetaMask extension installed yields both the
   * discovered injected connector and wagmi's SDK-backed `metaMask` one, and
   * the SDK path lazily imports @metamask/connect-evm and routes through
   * MetaMask's relay. Connecting straight to the installed extension is
   * faster and has fewer moving parts, so discovery wins the tie.
   */
  const best = new Map<string, Connector>();
  for (const c of connectors) {
    const key = c.name.toLowerCase().trim();
    const existing = best.get(key);
    if (!existing) {
      best.set(key, c);
      continue;
    }
    if (existing.type !== "injected" && c.type === "injected") best.set(key, c);
  }

  const unique = [...best.values()];

  // The bare "Injected" entry routes to whichever extension currently owns
  // window.ethereum, so it is only offered when nothing named was found.
  const named = unique.filter((c) => !/^injected$/i.test(c.name));
  return named.length > 0 ? named : unique;
}

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status, error, reset } = useConnect();
  const { disconnect } = useDisconnect();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  /*
   * No effect synchronises any of this.
   *
   * A successful connection takes the early-return branch below, so the modal
   * stops being rendered without anything having to close it. The spinner is
   * derived from `pendingId === uid && status === "pending"` at render time,
   * so a settled attempt stops showing one on its own. And the portal needs
   * no mounted flag, because `isModalOpen` can only become true from a click,
   * which is necessarily after hydration.
   */

  // Escape closes, matching what any dialog is expected to do.
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleConnect = (connector: Connector) => {
    reset();
    setPendingId(connector.uid);
    connect({ connector });
  };

  const openModal = () => {
    reset();
    setPendingId(null);
    setIsModalOpen(true);
  };

  if (isConnected && address) {
    return (
      <button
        onClick={() => {
          // Also clear the dialog, so a later disconnect cannot re-reveal a
          // modal that was still flagged open when the connection succeeded.
          setIsModalOpen(false);
          setPendingId(null);
          disconnect();
        }}
        className="px-6 py-2 rounded-full font-headline font-bold text-sm bg-surface-container-high text-primary hover:bg-surface-bright border border-primary/20 transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.1)] cursor-pointer"
      >
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary to-secondary"></div>
        {formatAddress(address)}
      </button>
    );
  }

  const wallets = usableConnectors(connectors);

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
      onClick={() => setIsModalOpen(false)}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-[#0c1324]/80 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl my-auto bg-white/10 backdrop-blur-2xl rounded-[2rem] p-1 shadow-2xl overflow-hidden border border-white/20"
      >
        <div className="absolute inset-0 glass-highlight pointer-events-none"></div>

        <div className="relative z-10 p-8 md:p-10 flex flex-col items-center">
          <button
            onClick={() => setIsModalOpen(false)}
            aria-label="Close"
            className="absolute top-6 right-8 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>

          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-primary/20 rounded-full border border-primary/30">
              <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_#00f0ff]"></span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-primary">Secure Connection</span>
            </div>
            <h2 className="text-3xl font-headline font-bold text-primary tracking-tight shadow-black drop-shadow-md">
              Connect Wallet
            </h2>
            <p className="text-on-surface-variant mt-2 text-sm">
              {wallets.length > 0
                ? "Select your preferred provider to enter the ecosystem"
                : "No wallet extension detected in this browser"}
            </p>
          </div>

          {wallets.length === 0 ? (
            <div className="w-full rounded-2xl border border-white/10 bg-[#151b2d]/90 p-6 text-center text-sm text-on-surface-variant">
              Install a browser wallet such as MetaMask, Phantom or Rabby, then reload this page.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full perspective-1000 relative z-20">
              {wallets.map((connector) => {
                const s = styleFor(connector.name);
                const isPending = pendingId === connector.uid && status === "pending";

                return (
                  <button
                    key={connector.uid}
                    onClick={() => handleConnect(connector)}
                    disabled={status === "pending"}
                    className="group relative preserve-3d hover-tilt transition-all duration-500 cursor-pointer disabled:cursor-wait disabled:opacity-60 text-left"
                  >
                    <div className="h-full bg-[#151b2d]/90 hover:bg-[#23293c] p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-4 transition-all shadow-xl hover:shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden ${s.bg}`}
                      >
                        {isPending ? (
                          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        ) : connector.icon ? (
                          // EIP-6963 wallets supply their own icon, so the real
                          // brand mark is shown rather than an approximation.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={connector.icon} alt="" className="w-10 h-10 rounded-lg" />
                        ) : (
                          <span
                            className={`material-symbols-outlined text-4xl ${s.fg}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {s.icon}
                          </span>
                        )}
                      </div>
                      {/* text-xs with normal word breaking: at text-sm a
                          13-character name like "WalletConnect" overflowed the
                          card's ~97px content box and split mid-word. */}
                      <span className="font-headline font-bold text-xs text-white text-center leading-tight max-w-full px-0.5">
                        {isPending ? "Check your wallet…" : connector.name}
                      </span>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-primary text-sm">north_east</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-6 w-full rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-xs text-error relative z-20">
              {/^user rejected/i.test(error.message)
                ? "Connection request was rejected in your wallet."
                : error.message}
            </div>
          )}

          <div className="mt-10 pt-8 w-full border-t border-white/10 text-center relative z-20">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              By connecting your wallet, you agree to our{" "}
              <span className="text-primary hover:underline cursor-pointer">Terms of Service</span>.
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
  );

  return (
    <>
      <button
        onClick={openModal}
        className="bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed px-6 py-2.5 rounded-full font-headline font-bold shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:opacity-90 active:scale-95 transition-all whitespace-nowrap cursor-pointer z-50 relative"
      >
        {status === "pending" ? "Connecting..." : "Connect"}
      </button>

      {/* Portalled to body so no ancestor's backdrop-filter or transform can
          become the containing block for this fixed overlay. */}
      {isModalOpen && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
