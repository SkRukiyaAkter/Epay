"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Wallet, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { BalanceResponse } from "@/types";

export default function SendMoneyPage() {
  const r=useRouter(); const [rec,setRec]=useState(""); const [amt,setAmt]=useState(""); const [ld,setLd]=useState(false);
  const [ok,setOk]=useState(false); const [st,setSt]=useState(-1); const [bal,setBal]=useState<BalanceResponse|null>(null);
  const [res,setRes]=useState<{transaction_id:string;sender_new_balance:string}|null>(null);
  useEffect(()=>{(async()=>{try{const r=await fetch("/api/account/balance"); if(r.ok)setBal(await r.json())}catch{}})();},[]);
  const an=parseFloat(amt)||0; const dr=bal?parseFloat(bal.daily_remaining):Infinity; const cb=bal?parseFloat(bal.balance):Infinity;

  const submit=async(e:React.FormEvent)=>{e.preventDefault(); if(!rec.trim()||!amt.trim()||isNaN(an)||an<=0){toast.error("Invalid");return} if(an>cb){toast.error("Insufficient balance");return} if(an>dr){toast.error("Daily limit exceeded");return}
    setLd(true);setSt(0);setTimeout(()=>setSt(1),400);setTimeout(()=>setSt(2),800);
    try{const csrf=document.cookie.split("; ").find(x=>x.startsWith("csrf-token="))?.split("=")[1]||""; const f=await fetch("/api/transaction",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:JSON.stringify({receiver_username:rec.trim(),amount:amt.trim(),currency:"BDT"})}); setSt(3); const d=await f.json();
      if(f.ok&&d.status==="completed"){setRes({transaction_id:d.transaction_id,sender_new_balance:d.sender_new_balance});setOk(true);toast.success("Completed!")}else toast.error(d.reason||"Failed")}
    catch{toast.error("Network error")}finally{setLd(false);setSt(-1)}
  };

  return (<div className="max-w-lg mx-auto"><AnimatePresence mode="wait">
    {ok?(
      <motion.div key="ok" initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}} className="glass p-8 text-center">
        <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring"}} className="w-20 h-20 bg-emerald-500/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/10"><CheckCircle2 className="w-10 h-10 text-emerald-400"/></motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Transfer Successful</h2><p className="text-white/25 mb-6">Encrypted and verified</p>
        <div className="bg-white/[0.02] rounded-xl p-5 mb-6 space-y-3 text-left border border-border"><div className="flex justify-between"><span className="text-sm text-white/25">ID</span><span className="text-sm font-mono text-white/50">{res?.transaction_id?.slice(0,8)}...</span></div><div className="flex justify-between"><span className="text-sm text-white/25">To</span><span className="text-sm font-semibold text-white">{rec}</span></div><div className="flex justify-between"><span className="text-sm text-white/25">Amount</span><span className="text-sm font-bold text-rose-400">&minus;{amt} BDT</span></div><div className="flex justify-between border-t border-border pt-3"><span className="text-sm text-white/25">New Balance</span><span className="text-sm font-bold text-gold-400">{res?.sender_new_balance} BDT</span></div></div>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:.98}} onClick={()=>{setOk(false);setRec("");setAmt("");r.refresh()}} className="btn-red w-full py-3.5 flex items-center justify-center gap-2"><Send className="w-5 h-5"/>Send Another</motion.button>
      </motion.div>
    ):(
      <motion.div key="form" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
        {bal&&<div className="glass p-5 mb-6"><div className="grid grid-cols-3 gap-4 text-center">{[["Balance",bal.balance,"text-white"],["Daily Limit",bal.daily_limit,"text-white"],["Remaining",bal.daily_remaining,parseFloat(bal.daily_remaining)<=0?"text-rose-400":"text-gold-400"]].map(([l,v,cl],i)=>(<div key={i}><p className="text-xs text-white/20 uppercase mb-1">{l}</p><p className={`text-xl font-bold ${cl}`}>{parseFloat(v as string).toLocaleString()}</p></div>))}</div></div>}
        <div className="glass p-8">
          <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 bg-red-500/5 rounded-2xl flex items-center justify-center border border-red-500/10"><Send className="w-6 h-6 text-red-400"/></div><div><h2 className="text-xl font-bold text-white">Send Money</h2><p className="text-sm text-white/25">AES-256-GCM encrypted transfer</p></div></div>
          <form onSubmit={submit} className="space-y-5">
            <div><label className="block text-sm font-semibold text-white/70 mb-2">Receiver</label><div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10"/><input type="text" value={rec} onChange={e=>setRec(e.target.value)} placeholder="e.g. bob" required disabled={ld} className="input-dark w-full pl-12 pr-4 py-3.5"/></div></div>
            <div><label className="block text-sm font-semibold text-white/70 mb-2">Amount</label><div className="relative"><Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10"/><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00" min="1" step="0.01" required disabled={ld} className={`input-dark w-full pl-12 pr-4 py-3.5 ${an>0&&an>cb?"border-rose-500/30 focus:ring-rose-500/20":""}`}/></div></div>
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:.98}} type="submit" disabled={ld||an>cb||an>dr||!rec.trim()||!amt.trim()} className="btn-red w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-30">{ld?<><Loader2 className="w-5 h-5 animate-spin"/>Encrypting...</>:<><Send className="w-5 h-5"/>Send Money Securely<ArrowRight className="w-5 h-5"/></>}</motion.button>
          </form>
        </div>
      </motion.div>
    )}
  </AnimatePresence></div>);
}
