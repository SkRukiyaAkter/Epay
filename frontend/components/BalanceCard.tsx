"use client";

import { motion } from "framer-motion";
import { Wallet, Shield } from "lucide-react";

interface Props { balance: string; currency: string; dailyLimit: string; dailyUsed: string; dailyRemaining: string; }

export default function BalanceCard({ balance, currency, dailyLimit, dailyUsed, dailyRemaining }: Props) {
  const pct = parseFloat(dailyLimit) > 0 ? (parseFloat(dailyUsed) / parseFloat(dailyLimit)) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br from-surface-1 via-red-950/30 to-surface-2 border border-red-500/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.06),transparent_60%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.03),transparent_50%)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-red-500/5 rounded-2xl flex items-center justify-center border border-red-500/10"><Wallet className="w-6 h-6 text-red-400" /></div>
              <div><p className="text-white/60 text-sm">Total Balance</p><p className="text-[10px] text-red-400/60 uppercase tracking-widest mt-0.5">Active Account</p></div>
            </div>
            <h2 className="text-5xl font-bold text-white tracking-tight">{parseFloat(balance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}<span className="text-2xl text-white/20 ml-2 font-medium">{currency}</span></h2>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-red-500/5 rounded-full border border-red-500/10"><Shield className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-400/70 font-semibold">SECURED</span></div>
        </div>
        <div className="grid grid-cols-3 gap-4 bg-white/[0.02] rounded-2xl p-5 border border-white/[0.03]">
          {[["Daily Limit",dailyLimit,"text-white"],["Used",dailyUsed,"text-gold-400"],["Remaining",dailyRemaining,"text-gold-400"]].map(([l,v,cl],i)=>(<div key={i}><p className="text-white/20 text-[11px] uppercase tracking-wider mb-1">{l}</p><p className={`text-lg font-semibold ${cl}`}>{parseFloat(v as string).toLocaleString()}</p></div>))}
        </div>
        <div className="mt-5"><div className="flex items-center justify-between text-[11px] mb-2"><span className="text-white/20 uppercase tracking-wider">Daily Usage</span><span className="text-white/40">{parseFloat(dailyUsed).toLocaleString()} / {parseFloat(dailyLimit).toLocaleString()}</span></div>
          <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${Math.min(pct,100)}%`}} transition={{duration:1.2,delay:0.3}} className={`h-full rounded-full ${pct>80?"bg-gradient-to-r from-rose-500 to-rose-400":pct>60?"bg-gradient-to-r from-gold-500 to-gold-400":"bg-gradient-to-r from-red-500 to-gold-400"}`} /></div>
        </div>
      </div>
    </motion.div>
  );
}
