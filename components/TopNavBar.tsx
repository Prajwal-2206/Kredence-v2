"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "./WalletConnect";

export function TopNavBar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Landing" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/reputation", label: "Reputation" },
    { href: "/dashboard/governance", label: "Governance" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
      <div className="flex justify-between items-center px-8 py-4 w-full max-w-none">
        <div className="flex items-center gap-12">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-[#dbfcff] to-[#ddb7ff] bg-clip-text text-transparent font-headline tracking-tight">Kredence v2</Link>
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => {
              const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== "/");
              return (
                <Link 
                  key={link.href}
                  href={link.href}
                  className={`font-headline tracking-tight text-sm uppercase transition-all duration-300 ${
                    isActive 
                      ? "text-[#dbfcff] border-b-2 border-[#00f0ff] pb-1" 
                      : "text-[#f4f6ff]/60 hover:text-[#dbfcff]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}
