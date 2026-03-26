"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function SideNavBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const address = searchParams?.get("address");
  const qs = address ? `?address=${address}` : "";

  return (
    <aside className="hidden lg:flex flex-col py-8 gap-4 h-[calc(100vh-72px)] fixed left-0 top-0 bg-slate-950/60 backdrop-blur-2xl border-r border-white/5 shadow-2xl shadow-black/40 z-40 mt-[72px] w-64">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
          </div>
          <div>
            <div className="font-headline text-primary text-sm uppercase tracking-widest">Kredence ID</div>
            <div className="text-xs text-tertiary/40">Verified Member</div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-1 flex-1">
        <Link 
          href={`/dashboard${qs}`} 
          className={`flex items-center gap-4 px-6 py-3 transition-all duration-200 ${pathname === '/dashboard' ? 'text-primary bg-white/5 border-r-2 border-primary' : 'text-tertiary/40 hover:bg-white/10 hover:text-primary'} group`}
        >
          <span className="material-symbols-outlined">grid_view</span>
          <span className="font-headline text-sm uppercase tracking-widest">Dashboard</span>
        </Link>
        <Link 
          href={`/dashboard/reputation${qs}`} 
          className={`flex items-center gap-4 px-6 py-3 transition-all duration-200 ${pathname.includes('/reputation') ? 'text-primary bg-white/5 border-r-2 border-primary' : 'text-tertiary/40 hover:bg-white/10 hover:text-primary'} group`}
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: pathname.includes('/reputation') ? "'FILL' 1" : "'FILL' 0"}}>description</span>
          <span className="font-headline text-sm uppercase tracking-widest">Reputation</span>
        </Link>
        <Link 
          href={`/dashboard/governance${qs}`} 
          className={`flex items-center gap-4 px-6 py-3 transition-all duration-200 ${pathname.includes('/governance') ? 'text-primary bg-white/5 border-r-2 border-primary' : 'text-tertiary/40 hover:bg-white/10 hover:text-primary'} group`}
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: pathname.includes('/governance') ? "'FILL' 1" : "'FILL' 0"}}>account_balance</span>
          <span className="font-headline text-sm uppercase tracking-widest">Governance</span>
        </Link>
        <Link 
          href={`#settings`} 
          className="flex items-center gap-4 px-6 py-3 transition-all duration-200 text-tertiary/40 hover:bg-white/10 hover:text-primary group"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-headline text-sm uppercase tracking-widest">Settings</span>
        </Link>
      </div>

      <div className="px-6 mt-auto">
        <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-primary font-medium hover:bg-white/10 transition-all text-sm font-headline tracking-widest uppercase cursor-pointer">
          Share Profile
        </button>
      </div>
    </aside>
  );
}
