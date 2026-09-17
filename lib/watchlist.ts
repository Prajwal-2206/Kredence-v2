/**
 * Watchlist + score cache, persisted in localStorage.
 *
 * Everything here is browser-only and defensive: localStorage throws in private
 * windows and can hold whatever a previous version of the app (or the user)
 * left behind, so every read re-validates the shape and falls back to empty
 * rather than crashing the page.
 */

const WATCHLIST_KEY = "kredence.watchlist.v1";
const SCORE_CACHE_KEY = "kredence.scoreCache.v1";

/** Fires on the window whenever either store changes, so open panels re-read. */
export const WATCHLIST_EVENT = "kredence:watchlist";

export interface WatchedWallet {
  /** Checksum-agnostic: always stored lowercase, compared lowercase. */
  address: string;
  /** User-supplied nickname. Empty string means "show the address". */
  label: string;
  /** ms epoch — used for stable ordering, newest first. */
  addedAt: number;
}

export interface ScoreSnapshot {
  score: number;
  walletAgeDays: number;
  /** ms epoch when this snapshot was taken. */
  at: number;
}

export type ScoreCache = Record<string, ScoreSnapshot>;

export const isAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value.trim());

export const normalizeAddress = (value: string): string => value.trim().toLowerCase();

/** "0xd8dA…6045" */
export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  } catch {
    // Quota exceeded or storage blocked — the in-memory UI still works for
    // this session, it just won't survive a reload. Not worth interrupting.
  }
}

/**
 * Both stores concatenated, exactly as serialized.
 *
 * useSyncExternalStore compares snapshots by identity, so it needs something
 * referentially stable — a string that only changes when the data actually
 * changed, rather than freshly-parsed objects.
 */
export function readRawStores(): string {
  if (typeof window === "undefined") return "";
  try {
    return `${window.localStorage.getItem(WATCHLIST_KEY) ?? ""}|${window.localStorage.getItem(SCORE_CACHE_KEY) ?? ""}`;
  } catch {
    return "";
  }
}

export function getWatchlist(): WatchedWallet[] {
  const raw = read<unknown>(WATCHLIST_KEY, []);
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((w): w is WatchedWallet =>
      !!w &&
      typeof w === "object" &&
      typeof (w as WatchedWallet).address === "string" &&
      isAddress((w as WatchedWallet).address)
    )
    .map((w) => ({
      address: normalizeAddress(w.address),
      label: typeof w.label === "string" ? w.label : "",
      addedAt: typeof w.addedAt === "number" ? w.addedAt : 0,
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function isWatched(address: string | null | undefined): boolean {
  if (!address) return false;
  const target = normalizeAddress(address);
  return getWatchlist().some((w) => w.address === target);
}

/** Adds, or renames in place if the address is already saved. */
export function addToWatchlist(address: string, label = ""): WatchedWallet[] {
  if (!isAddress(address)) return getWatchlist();

  const target = normalizeAddress(address);
  const existing = getWatchlist();
  const prior = existing.find((w) => w.address === target);

  const next: WatchedWallet[] = [
    { address: target, label: label.trim(), addedAt: prior?.addedAt ?? Date.now() },
    ...existing.filter((w) => w.address !== target),
  ].sort((a, b) => b.addedAt - a.addedAt);

  write(WATCHLIST_KEY, next);
  return next;
}

export function removeFromWatchlist(address: string): WatchedWallet[] {
  const target = normalizeAddress(address);
  const next = getWatchlist().filter((w) => w.address !== target);
  write(WATCHLIST_KEY, next);
  return next;
}

export function getScoreCache(): ScoreCache {
  const raw = read<unknown>(SCORE_CACHE_KEY, {});
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: ScoreCache = {};
  for (const [address, snap] of Object.entries(raw as Record<string, unknown>)) {
    const s = snap as ScoreSnapshot;
    if (!s || typeof s !== "object") continue;
    if (typeof s.score !== "number" || typeof s.walletAgeDays !== "number") continue;
    out[normalizeAddress(address)] = {
      score: s.score,
      walletAgeDays: s.walletAgeDays,
      at: typeof s.at === "number" ? s.at : 0,
    };
  }
  return out;
}

/**
 * Records a score for an address. Called whenever the dashboard successfully
 * loads one, watched or not — so adding a wallet you already looked at shows
 * its score straight away instead of a dash.
 */
export function cacheScore(address: string, score: number, walletAgeDays: number): void {
  if (!isAddress(address)) return;

  const cache = getScoreCache();
  cache[normalizeAddress(address)] = { score, walletAgeDays, at: Date.now() };

  // Keep the cache from growing without bound: newest 50 entries survive.
  const trimmed = Object.entries(cache)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, 50);

  write(SCORE_CACHE_KEY, Object.fromEntries(trimmed));
}

/** "2 years", "5 months", "12 days" — age rendered for a compact row. */
export function formatAge(days: number): string {
  if (days >= 730) return `${Math.floor(days / 365)}y`;
  if (days >= 60) return `${Math.floor(days / 30)}mo`;
  return `${days}d`;
}
