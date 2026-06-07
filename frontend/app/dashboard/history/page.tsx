"use client";

import { useEffect, useState } from "react";
import { History, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import type { TransactionHistoryResponse } from "@/types";
import StatCard from "@/components/StatCard";
import TransactionRow from "@/components/TransactionRow";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function HistoryPage() {
  const [data,setData]=useState<TransactionHistoryResponse|null>(null); const [ld,setLd]=useState(true);
  const [pg,setPg]=useState(1); const [f,setF]=useState("all");
  useEffect(()=>{(async()=>{setLd(true);try{const r=await fetch(`/api/transaction/history?page=${pg}&limit=20`);if(r.ok)setData(await r.json())}catch{}finally{setLd(false)}})();},[pg]);
  const txns=data?.transactions||[]; const fl=txns.filter(t=>f==="all"?true:t.direction===f);
  const ts=txns.filter(t=>t.direction==="sent"&&t.status==="completed").reduce((s,t)=>s+parseFloat(t.amount),0);
  const tr=txns.filter(t=>t.direction==="received"&&t.status==="completed").reduce((s,t)=>s+parseFloat(t.amount),0);
  const cu=txns[0]?.currency||"BDT";

  return (<div className="max-w-4xl mx-auto space-y-6">
    {data&&<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard icon={Clock} label="Total" value={String(data.total)} variant="gold"/>
      <StatCard icon={ArrowUpRight} label="Total Sent" value={`${ts.toLocaleString(undefined,{minimumFractionDigits:2})} ${cu}`} variant="rose"/>
      <StatCard icon={ArrowDownLeft} label="Total Received" value={`${tr.toLocaleString(undefined,{minimumFractionDigits:2})} ${cu}`} variant="emerald"/>
    </div>}
    <div className="glass overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-500/5 rounded-xl flex items-center justify-center border border-red-500/10"><History className="w-5 h-5 text-red-400"/></div><div><h2 className="text-lg font-bold text-white">Transaction History</h2><p className="text-sm text-white/20">{data?.total||0} total</p></div></div>
        <div className="flex items-center bg-surface-3 rounded-xl p-1 border border-border">{["all","sent","received"].map(ff=>(<button key={ff} onClick={()=>setF(ff)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${f===ff?"bg-red-500/10 text-red-400":"text-white/60 hover:text-white/90"}`}>{ff}</button>))}</div>
      </div>
      {ld?<LoadingSkeleton variant="table" rows={5}/>:fl.length===0?<EmptyState icon={History} title="No transactions"/>:<div className="divide-y divide-border">{fl.map((t,i)=><TransactionRow key={t.transaction_id} transaction={t} index={i}/>)}</div>}
      {data&&data.pages>1&&(<div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface-2"><p className="text-sm text-white/15">Page {data.page} of {data.pages}</p><div className="flex gap-2"><button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} className="btn-ghost p-2.5 disabled:opacity-20"><ChevronLeft className="w-5 h-5"/></button><button onClick={()=>setPg(p=>Math.min(data.pages,p+1))} disabled={pg===data.pages} className="btn-ghost p-2.5 disabled:opacity-20"><ChevronRight className="w-5 h-5"/></button></div></div>)}
    </div>
  </div>);
}
