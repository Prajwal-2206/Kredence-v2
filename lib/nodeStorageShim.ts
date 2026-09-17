/**
 * Side-effect module: import it before any wallet library.
 *
 * Node 22.4+ ships a global `localStorage`, and Node 25 exposes it even with no
 * backing file — as an object whose methods are missing. Browser libraries
 * feature-detect storage with `typeof localStorage !== "undefined"`, which that
 * stub passes, so RainbowKit's `getRecentWalletIds()` calls `.getItem` during
 * SSR and takes down every page with:
 *
 *   TypeError: localStorage.getItem is not a function
 *
 * Deleting the global restores the assumption server code is written against —
 * that no storage exists outside the browser. This lives in module scope rather
 * than `instrumentation.ts` because `register()` does not run in the workers
 * `next build` spawns to prerender pages, and those crash too.
 */
const globals = globalThis as { window?: unknown; localStorage?: unknown };

// Never touch a real browser Storage — only the broken server-side stub.
if (typeof globals.window === "undefined" && globals.localStorage) {
  const storage = globals.localStorage as Partial<Storage>;
  if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    delete globals.localStorage;
  }
}

export {};
