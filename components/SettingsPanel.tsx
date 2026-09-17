"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  WATCHLIST_EVENT,
  addToWatchlist,
  formatAge,
  getScoreCache,
  getWatchlist,
  isAddress,
  normalizeAddress,
  readRawStores,
  removeFromWatchlist,
  shortenAddress,
} from "@/lib/watchlist";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Address currently being viewed, if any. */
  currentAddress: string | null;
  /**
   * Show the view links. The mobile menu sets this because below `lg` the
   * sidebar is not rendered and under `md` the top nav links are hidden too,
   * leaving no other way to move between Dashboard, Reputation and Governance.
   */
  showNav?: boolean;
}

const VIEWS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid_view" },
  { href: "/dashboard/reputation", label: "Reputation", icon: "description" },
  { href: "/dashboard/governance", label: "Governance", icon: "account_balance" },
];

/**
 * Subscribes to the localStorage-backed watchlist.
 *
 * The snapshot is the raw serialized string rather than parsed objects:
 * useSyncExternalStore compares snapshots by identity, and `getWatchlist()`
 * builds a fresh array every call, which would loop forever. A string is
 * stable when nothing changed, so parsing happens once per actual change.
 */
function useWatchlistStore() {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(WATCHLIST_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Server render has no localStorage, so it starts from the empty snapshot
  // and React re-reads on the client after hydration.
  const raw = useSyncExternalStore(subscribe, readRawStores, () => "");

  return useMemo(
    () => ({ wallets: getWatchlist(), scores: getScoreCache() }),
    // `raw` is the change signal; the getters read localStorage themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw]
  );
}

export default function SettingsPanel({
  open,
  onClose,
  currentAddress,
  showNav = false,
}: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <SettingsDrawer onClose={onClose} currentAddress={currentAddress} showNav={showNav} />
      )}
    </AnimatePresence>
  );
}

/**
 * Only mounted while the panel is open, so every draft field starts empty on
 * each open without needing an effect to clear it.
 */
function SettingsDrawer({
  onClose,
  currentAddress,
  showNav,
}: {
  onClose: () => void;
  currentAddress: string | null;
  showNav: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { wallets, scores } = useWatchlistStore();

  const [draftAddress, setDraftAddress] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const currentIsSaved =
    !!currentAddress && wallets.some((w) => w.address === normalizeAddress(currentAddress));

  /** Whichever dashboard view is open — swapping wallets shouldn't move you. */
  const basePath = pathname.startsWith("/dashboard") ? pathname : "/dashboard";

  const handleAdd = (address: string, label: string) => {
    if (!isAddress(address)) {
      setAddError("That doesn't look like an Ethereum address (0x + 40 hex characters).");
      return;
    }
    setAddError(null);
    addToWatchlist(address, label);
    setDraftAddress("");
    setDraftLabel("");
  };

  const handleOpen = (address: string) => {
    router.push(basePath + "?address=" + address);
    onClose();
  };

  const commitRename = (address: string) => {
    addToWatchlist(address, editLabel);
    setEditing(null);
  };

  const handleCopy = async () => {
    if (!currentAddress) return;
    const link = window.location.origin + basePath + "?address=" + currentAddress;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside secure contexts and in some browsers.
      // Fall back to a prompt so the link is still copyable by hand.
      window.prompt("Copy this profile link:", link);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        aria-hidden="true"
      />

      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        role="dialog"
        aria-modal="true"
        aria-label={showNav ? "Menu" : "Settings"}
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-black/60 z-[61] flex flex-col"
      >
        <header className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">{showNav ? "menu" : "settings"}</span>
            <h2 className="font-headline text-sm uppercase tracking-widest text-primary">
              {showNav ? "Menu" : "Settings"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={showNav ? "Close menu" : "Close settings"}
            className="text-tertiary/40 hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* ── Views (mobile only) ─────────────────────────────── */}
          {showNav && (
            <section>
              <h3 className="font-headline text-xs uppercase tracking-widest text-white mb-4">Go To</h3>
              <ul className="space-y-2">
                {VIEWS.map((v) => {
                  const isActive =
                    v.href === "/dashboard" ? pathname === v.href : pathname.startsWith(v.href);
                  return (
                    <li key={v.href}>
                      <Link
                        href={currentAddress ? `${v.href}?address=${currentAddress}` : v.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                          isActive
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-white/5 bg-white/5 text-tertiary/60 hover:bg-white/10 hover:text-primary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">{v.icon}</span>
                        <span className="font-headline text-sm uppercase tracking-widest">{v.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ── Saved wallets ───────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-headline text-xs uppercase tracking-widest text-white">Saved Wallets</h3>
              <span className="text-[10px] uppercase tracking-tighter text-on-surface-variant">
                {wallets.length} saved
              </span>
            </div>

            {currentAddress && !currentIsSaved && (
              <button
                onClick={() => handleAdd(currentAddress, "")}
                className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">bookmark_add</span>
                Save {shortenAddress(currentAddress)}
              </button>
            )}

            {wallets.length === 0 ? (
              <p className="text-xs text-tertiary/40 leading-relaxed py-2">
                No wallets saved yet. Save the one you&apos;re viewing, or paste an address below to keep
                it one click away.
              </p>
            ) : (
              <ul className="space-y-2">
                {wallets.map((w) => {
                  const snap = scores[w.address];
                  const isCurrent =
                    !!currentAddress && normalizeAddress(currentAddress) === w.address;

                  return (
                    <li
                      key={w.address}
                      className={`group rounded-2xl border transition-all ${
                        isCurrent
                          ? "border-primary/40 bg-primary/10"
                          : "border-white/5 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {editing === w.address ? (
                        <div className="p-3 flex items-center gap-2">
                          <input
                            autoFocus
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(w.address);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            placeholder="Nickname"
                            maxLength={32}
                            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-tertiary/30 focus:outline-none focus:border-primary/50"
                          />
                          <button
                            onClick={() => commitRename(w.address)}
                            aria-label="Save nickname"
                            className="text-primary hover:text-white transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-lg">check</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => handleOpen(w.address)}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <p className="text-sm text-white font-medium truncate">
                              {w.label || shortenAddress(w.address)}
                            </p>
                            <p className="text-[11px] text-on-surface-variant font-mono truncate">
                              {w.label ? shortenAddress(w.address) : " "}
                            </p>
                          </button>

                          <div className="text-right shrink-0">
                            {snap ? (
                              <>
                                <p className="text-primary font-headline font-bold text-sm leading-tight">
                                  {snap.score}
                                </p>
                                <p className="text-[10px] text-on-surface-variant">
                                  {formatAge(snap.walletAgeDays)}
                                </p>
                              </>
                            ) : (
                              <p
                                className="text-tertiary/30 text-sm"
                                title="Open this wallet to load its score"
                              >
                                —
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditing(w.address);
                                setEditLabel(w.label);
                              }}
                              aria-label={`Rename ${w.label || shortenAddress(w.address)}`}
                              className="p-1 text-tertiary/40 hover:text-primary transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              onClick={() => removeFromWatchlist(w.address)}
                              aria-label={`Remove ${w.label || shortenAddress(w.address)}`}
                              className="p-1 text-tertiary/40 hover:text-error transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 space-y-2">
              <input
                value={draftAddress}
                onChange={(e) => {
                  setDraftAddress(e.target.value);
                  setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd(draftAddress, draftLabel);
                }}
                placeholder="0x…"
                spellCheck={false}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-tertiary/30 placeholder:font-body focus:outline-none focus:border-primary/50 transition-colors"
              />
              <div className="flex gap-2">
                <input
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd(draftAddress, draftLabel);
                  }}
                  placeholder="Nickname (optional)"
                  maxLength={32}
                  className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-tertiary/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={() => handleAdd(draftAddress, draftLabel)}
                  disabled={!draftAddress.trim()}
                  className="px-4 rounded-xl bg-white/5 border border-white/10 text-primary text-sm font-medium hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Add
                </button>
              </div>
              {addError && <p className="text-xs text-error">{addError}</p>}
            </div>
          </section>

          {/* ── Share ───────────────────────────────────────────── */}
          <section>
            <h3 className="font-headline text-xs uppercase tracking-widest text-white mb-4">
              Share Profile
            </h3>
            {currentAddress ? (
              <>
                <div className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                    Link
                  </p>
                  <p className="text-xs text-tertiary/60 font-mono break-all">
                    {basePath}?address={shortenAddress(currentAddress)}
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-primary font-medium hover:bg-white/10 transition-all text-sm font-headline tracking-widest uppercase cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {copied ? "check" : "link"}
                  </span>
                  {copied ? "Copied" : "Copy Profile Link"}
                </button>
              </>
            ) : (
              <p className="text-xs text-tertiary/40 leading-relaxed">
                Connect a wallet or search an address first — there&apos;s no profile to share yet.
              </p>
            )}
          </section>

          {/* ── Storage note ────────────────────────────────────── */}
          <section className="pt-2 border-t border-white/5">
            <p className="text-[11px] text-tertiary/30 leading-relaxed">
              Saved wallets live in this browser only. They are never sent to a server, and clearing your
              site data removes them.
            </p>
          </section>
        </div>
      </motion.aside>
    </>
  );
}
