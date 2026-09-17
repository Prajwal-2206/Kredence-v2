"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { WalletConnect } from "./WalletConnect";
import SettingsPanel from "./SettingsPanel";

const LINKS = [
  { href: "/", label: "Landing" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/reputation", label: "Reputation" },
  { href: "/dashboard/governance", label: "Governance" },
];

export function TopNavBar() {
  return (
    <Suspense fallback={<TopNavBarShell />}>
      <TopNavBarContent />
    </Suspense>
  );
}

function navClass(isActive: boolean) {
  return `font-headline tracking-tight text-sm uppercase transition-all duration-300 ${
    isActive
      ? "text-[#dbfcff] border-b-2 border-[#00f0ff] pb-1"
      : "text-[#f4f6ff]/60 hover:text-[#dbfcff]"
  }`;
}

/** Renders during the Suspense boundary: links without the address query. */
function TopNavBarShell() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
      <div className="flex justify-between items-center px-8 py-4 w-full max-w-none">
        <Link
          href="/"
          className="text-2xl font-bold bg-gradient-to-r from-[#dbfcff] to-[#ddb7ff] bg-clip-text text-transparent font-headline tracking-tight"
        >
          Kredence v2
        </Link>
        <WalletConnect />
      </div>
    </nav>
  );
}

function TopNavBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { address: connectedAddress } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  const address = searchParams?.get("address");

  /**
   * Carry the searched address across navigation.
   *
   * Without this, tapping "Reputation" dropped `?address=` and the page fell
   * back to the connected wallet — or, with nothing connected, to "Identity
   * Required". On desktop the sidebar hid the bug because its own links append
   * the query; below `lg` the sidebar is not rendered at all, so this nav was
   * the only way to move between views.
   */
  const qs = address ? `?address=${address}` : "";
  const hrefFor = (href: string) => (href === "/" ? href : `${href}${qs}`);

  const currentAddress = address || connectedAddress || null;

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
        <div className="flex justify-between items-center gap-4 px-4 sm:px-8 py-4 w-full max-w-none">
          <div className="flex items-center gap-12 min-w-0">
            <Link
              href={hrefFor("/dashboard")}
              className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#dbfcff] to-[#ddb7ff] bg-clip-text text-transparent font-headline tracking-tight whitespace-nowrap"
            >
              Kredence v2
            </Link>
            <div className="hidden md:flex items-center gap-8">
              {LINKS.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (pathname.startsWith(link.href) && link.href !== "/");
                return (
                  <Link key={link.href} href={hrefFor(link.href)} className={navClass(isActive)}>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Below `lg` the sidebar is gone, so this is the only way to reach
                saved wallets, sharing, and — under md — the nav links at all. */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu and settings"
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-[#dbfcff] hover:bg-white/10 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>
            <WalletConnect />
          </div>
        </div>
      </nav>

      <SettingsPanel
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentAddress={currentAddress}
        showNav
      />
    </>
  );
}
