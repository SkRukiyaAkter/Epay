"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, LayoutDashboard, Send, History, LogOut, Menu, X, User, UserCircle, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import NotificationDropdown from "./NotificationDropdown";
import BackgroundParticles from "./BackgroundParticles";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/send", label: "Send Money", icon: Send },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/simulate", label: "Simulator", icon: FlaskConical },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

export default function DashboardShell({ username, children }: { username: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false); const p = usePathname(); const r = useRouter();
  const logout = async () => { try { await fetch("/api/auth/logout", { method: "POST" }); toast.success("Logged out"); r.push("/login"); r.refresh(); } catch { toast.error("Logout failed"); } };

  return (
    <div className="min-h-screen bg-surface flex relative overflow-hidden">
      <BackgroundParticles />
      <aside className="hidden lg:flex flex-col w-64 bg-surface-1/90 backdrop-blur-xl border-r border-border fixed h-full z-30">
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/15"><Shield className="w-5 h-5 text-white" /></div>
          <span className="text-xl font-bold text-white tracking-tight">E-<span className="text-red-500">Pay</span></span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(item => { const I = item.icon; const act = p === item.href;
            return (<Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${act ? "bg-red-600/10 text-red-400 border border-red-500/15" : "text-white/30 hover:text-white/70 hover:bg-white/[0.02]"}`}><I className={`w-5 h-5 ${act ? "text-red-400" : "text-white/15"}`} />{item.label}</Link>);
          })}
        </nav>
        <div className="p-3 border-t border-border"><button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-white/20 hover:text-red-400 hover:bg-red-500/5 transition-all"><LogOut className="w-5 h-5" />Sign out</button></div>
      </aside>

      <AnimatePresence>{open && (<>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
        <motion.aside initial={{x:-280}} animate={{x:0}} exit={{x:-280}} transition={{type:"spring",damping:25,stiffness:200}} className="fixed left-0 top-0 h-full w-72 bg-surface-1 z-50 lg:hidden flex flex-col border-r border-border">
          <div className="p-6 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-500 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div><span className="text-xl font-bold text-white">E-<span className="text-red-500">Pay</span></span></div><button onClick={()=>setOpen(false)} className="p-2 rounded-lg hover:bg-white/[0.04] text-white/20"><X className="w-5 h-5" /></button></div>
          <nav className="flex-1 px-3 py-4 space-y-1">{nav.map(item => { const I=item.icon; const act=p===item.href; return (<Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${act?"bg-red-600/10 text-red-400 border border-red-500/15":"text-white/30 hover:text-white/70 hover:bg-white/[0.02]"}`}><I className="w-5 h-5" />{item.label}</Link>); })}</nav>
          <div className="p-3 border-t border-border"><button onClick={()=>{setOpen(false);logout()}} className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-white/20 hover:text-red-400 hover:bg-red-500/5"><LogOut className="w-5 h-5" />Sign out</button></div>
        </motion.aside>
      </>)}</AnimatePresence>

      <div className="flex-1 lg:ml-64 relative z-10">
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4"><button onClick={()=>setOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04] text-white/30"><Menu className="w-5 h-5" /></button><h1 className="text-lg font-semibold text-white">{nav.find(n=>n.href===p)?.label||"Dashboard"}</h1></div>
            <div className="flex items-center gap-3"><NotificationDropdown /><div className="flex items-center gap-2 pl-3 border-l border-border"><div className="w-8 h-8 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/10"><User className="w-4 h-4 text-red-400" /></div><span className="text-sm font-medium text-white/50 hidden sm:block">{username}</span></div></div>
          </div>
        </header>
        <main className="p-6"><motion.div key={p} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.25}}>{children}</motion.div></main>
      </div>
    </div>
  );
}
