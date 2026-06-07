"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Shield, Key, Clock, Activity, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import LoadingSkeleton from "@/components/LoadingSkeleton";

interface P { username:string; account_status:string; balance:string; currency:string; daily_limit:string; daily_remaining:string; device_status:string; registered_at:string|null; last_used_at:string|null; }

export default function ProfilePage() {
  const [p,setP]=useState<P|null>(null); const [ld,setLd]=useState(true);
  useEffect(()=>{(async()=>{try{const [b,d]=await Promise.all([fetch("/api/account/balance"),fetch("/api/device/status")]);const bd=b.ok?await b.json():{};const dd=d.ok?await d.json():{};setP({username:"",account_status:dd.is_active!==false?"Active":"Suspended",balance:bd.balance||"0.00",currency:bd.currency||"BDT",daily_limit:bd.daily_limit||"0.00",daily_remaining:bd.daily_remaining||"0.00",device_status:dd.is_active?"Verified":"Requires verification",registered_at:dd.registered_at||null,last_used_at:dd.last_used_at||null})}catch{toast.error("Failed")}finally{setLd(false)}})();},[]);
  if(ld) return <LoadingSkeleton variant="spinner"/>; if(!p) return null;

  return (<div className="max-w-2xl mx-auto space-y-6">
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="glass p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/15"><User className="w-8 h-8 text-white"/></div>
        <div><h2 className="text-2xl font-bold text-white">{p.username||"You"}</h2><div className="flex items-center gap-2 mt-1"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${p.account_status==="Active"?"bg-emerald-500/5 text-emerald-400 border-emerald-500/10":"bg-rose-500/5 text-rose-400 border-rose-500/10"}`}>{p.account_status}</span><span className="text-xs text-white/20">{p.currency}</span></div></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/10"><p className="text-xs text-red-400 mb-1 flex items-center gap-1.5"><Key className="w-3.5 h-3.5"/>Device</p><p className="text-lg font-bold text-white">{p.device_status}</p></div>
        <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10"><p className="text-xs text-emerald-400 mb-1 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5"/>Balance</p><p className="text-lg font-bold text-white">{parseFloat(p.balance).toLocaleString()} {p.currency}</p></div>
      </div>
      <div className="space-y-4">{[["Daily Limit",`${parseFloat(p.daily_limit).toLocaleString()} ${p.currency}`],["Remaining",`${parseFloat(p.daily_remaining).toLocaleString()} ${p.currency}`,"text-gold-400"],["Registered",p.registered_at?new Date(p.registered_at).toLocaleDateString():"N/A"],["Last Active",p.last_used_at?new Date(p.last_used_at).toLocaleString():"N/A"]].map(([l,v,cl],i)=>(<div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-b-0"><span className="text-sm text-white/30">{l}</span><span className={`text-sm font-semibold ${(cl as string)||"text-white"}`}>{v}</span></div>))}</div>
    </motion.div>
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:.1}} className="glass p-5 flex items-start gap-3 border-amber-500/10"><AlertCircle className="w-5 h-5 text-amber-400/60 mt-0.5"/><div><p className="text-sm font-semibold text-amber-400/80 mb-1">Security Notice</p><p className="text-xs text-amber-400/40">AES-256-GCM + HMAC-SHA256 + rolling timestamp keys for replay prevention.</p></div></motion.div>
  </div>);
}
