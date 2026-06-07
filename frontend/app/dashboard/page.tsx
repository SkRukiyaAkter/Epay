"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Send, History, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import type { BalanceResponse, Transaction } from "@/types";
import BalanceCard from "@/components/BalanceCard";
import StatCard from "@/components/StatCard";
import QuickActionCard from "@/components/QuickActionCard";
import TransactionRow from "@/components/TransactionRow";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function DashboardPage() {
  const [bal,setBal]=useState<BalanceResponse|null>(null); const [tx,setTx]=useState<Transaction[]>([]); const [ld,setLd]=useState(true);
  useEffect(()=>{(async()=>{try{const [b,h]=await Promise.all([fetch("/api/account/balance"),fetch("/api/transaction/history?page=1&limit=5")]); if(b.ok)setBal(await b.json()); if(h.ok){const d=await h.json();setTx(d.transactions||[])}}catch{}finally{setLd(false)}})();},[]);
  if(ld) return <LoadingSkeleton variant="card"/>;
  const ts=tx.filter(t=>t.direction==="sent"&&t.status==="completed").reduce((s,t)=>s+parseFloat(t.amount),0);
  const tr=tx.filter(t=>t.direction==="received"&&t.status==="completed").reduce((s,t)=>s+parseFloat(t.amount),0);
  const c=bal?.currency||"BDT";

  return (<div className="max-w-5xl mx-auto space-y-6">
    {bal&&<BalanceCard balance={bal.balance} currency={bal.currency} dailyLimit={bal.daily_limit} dailyUsed={bal.daily_used} dailyRemaining={bal.daily_remaining}/>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard icon={ArrowUpRight} label="Total Sent" value={`${ts.toLocaleString(undefined,{minimumFractionDigits:2})} ${c}`} variant="rose"/>
      <StatCard icon={ArrowDownLeft} label="Total Received" value={`${tr.toLocaleString(undefined,{minimumFractionDigits:2})} ${c}`} variant="emerald"/>
      <StatCard icon={Clock} label="Transactions" value={String(tx.length)} subValue="from recent history" variant="gold"/>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <QuickActionCard href="/dashboard/send" icon={Send} title="Send Money" description="AES-256-GCM encrypted transfer" variant="red"/>
      <QuickActionCard href="/dashboard/history" icon={History} title="Transaction History" description="View all past payments" variant="gold"/>
    </div>
    <div className="glass overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between"><div className="flex items-center gap-2"><Clock className="w-5 h-5 text-red-400"/><h3 className="font-semibold text-white">Recent Transactions</h3></div><motion.a whileHover={{x:3}} href="/dashboard/history" className="text-sm text-red-400 font-semibold">View all &rarr;</motion.a></div>
      {tx.length===0?<EmptyState icon={History} title="No transactions yet"/>:<div className="divide-y divide-border">{tx.map((t,i)=><TransactionRow key={t.transaction_id} transaction={t} index={i}/>)}</div>}
    </div>
  </div>);
}
