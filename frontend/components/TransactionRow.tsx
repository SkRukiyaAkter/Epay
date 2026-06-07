"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { Transaction } from "@/types";

export default function TransactionRow({ transaction:txn, index=0 }:{ transaction:Transaction; index?:number }) {
  const s=txn.direction==="sent"; const sc=txn.status==="completed"?"bg-emerald-500/5 text-emerald-400 border-emerald-500/10":txn.status==="failed"?"bg-rose-500/5 text-rose-400 border-rose-500/10":"bg-gold-500/5 text-gold-400 border-gold-500/10";
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.25,delay:index*0.03}} className="px-6 py-4 hover:bg-white/[0.01] transition-colors duration-200 group cursor-default">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 border ${s?"bg-rose-500/5 border-rose-500/10":"bg-gold-500/5 border-gold-500/10"}`}>{txn.status==="completed"?(s?<TrendingUp className="w-5 h-5 text-rose-400"/>:<TrendingDown className="w-5 h-5 text-gold-400"/>):<Clock className="w-5 h-5 text-gold-400"/>}</div>
          <div className="min-w-0"><p className="font-semibold text-white truncate">{s?"Sent to":"Received from"} <span className="text-red-400">{txn.counterparty_username}</span></p><div className="flex items-center gap-2 mt-1"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${sc}`}>{txn.status}</span><span className="text-xs text-white/40">{txn.completed_at?new Date(txn.completed_at).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Pending"}</span></div></div>
        </div>
        <div className="text-right flex-shrink-0 ml-4"><p className={`font-bold text-lg ${s?"text-rose-400":"text-gold-400"}`}>{s?"\u2212":"+"}{parseFloat(txn.amount).toLocaleString(undefined,{minimumFractionDigits:2})} <span className="text-sm font-medium text-white/40">{txn.currency}</span></p><p className="text-[11px] text-white/20 mt-0.5">{txn.transaction_id.slice(0,8)}...</p></div>
      </div>
    </motion.div>
  );
}
