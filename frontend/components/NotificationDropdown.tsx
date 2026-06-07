"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, TrendingDown, XCircle, ShieldAlert, Clock, CheckCheck, Loader2 } from "lucide-react";
import type { AppNotification } from "@/types";

const IC: Record<string,typeof TrendingDown> = { transaction_received:TrendingDown, transaction_failed:XCircle, account_suspended:ShieldAlert, daily_limit_warning:Clock };
const CL: Record<string,string> = { transaction_received:"text-emerald-400 bg-emerald-500/5 border-emerald-500/10", transaction_failed:"text-rose-400 bg-rose-500/5 border-rose-500/10", account_suspended:"text-amber-400 bg-amber-500/5 border-amber-500/10", daily_limit_warning:"text-amber-400 bg-amber-500/5 border-amber-500/10" };

export default function NotificationDropdown() {
  const [unread,setUnread]=useState(0); const [list,setList]=useState<AppNotification[]>([]); const [open,setOpen]=useState(false); const [ld,setLd]=useState(false); const ref=useRef<HTMLDivElement>(null); const poll=useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchUnread=async()=>{try{const r=await fetch("/api/notification/unread-count");if(r.ok)setUnread((await r.json()).unread_count||0)}catch{}};
  const fetchList=async()=>{setLd(true);try{const r=await fetch("/api/notification/list?limit=10");if(r.ok)setList((await r.json()).notifications||[])}catch{}finally{setLd(false)}};
  useEffect(()=>{fetchUnread();poll.current=setInterval(fetchUnread,30000);return()=>{if(poll.current)clearInterval(poll.current)}},[]);
  useEffect(()=>{if(open)fetchList()},[open]);
  useEffect(()=>{const fn=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};if(open)document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn)},[open]);
  const markAll=async()=>{await fetch("/api/notification/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mark_all:true})});setList(p=>p.map(n=>({...n,is_read:true})));setUnread(0)};
  const markOne=async(n:AppNotification)=>{if(n.is_read)return;await fetch("/api/notification/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({notification_id:n.id})});setList(p=>p.map(x=>x.id===n.id?{...x,is_read:true}:x));setUnread(c=>Math.max(0,c-1))};

  return (<div ref={ref} className="relative">
    <button onClick={()=>setOpen(!open)} className="p-2.5 rounded-xl hover:bg-white/[0.04] relative transition-colors"><Bell className="w-5 h-5 text-white/25" />{unread>0&&<motion.span initial={{scale:0}} animate={{scale:1}} className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow-[0_0_10px_rgba(239,68,68,0.5)]">{unread>99?"99+":unread}</motion.span>}</button>
    <AnimatePresence>{open&&(<motion.div initial={{opacity:0,y:8,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:.96}} transition={{duration:.2}} className="absolute right-0 mt-3 w-80 bg-surface-2 border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border"><h3 className="font-semibold text-white">Notifications</h3>{unread>0&&<button onClick={markAll} className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300"><CheckCheck className="w-3.5 h-3.5"/>Mark all read</button>}</div>
      <div className="max-h-80 overflow-y-auto">{ld?<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-red-400"/></div>:list.length===0?<div className="py-12 text-center"><Bell className="w-8 h-8 mx-auto mb-2 text-white/8"/><p className="text-sm text-white/20">No notifications</p></div>:list.map(n=>{const I=IC[n.type]||Bell;const c=CL[n.type]||"";return(<button key={n.id} onClick={()=>markOne(n)} className={`w-full text-left px-5 py-3.5 hover:bg-white/[0.02] transition-colors flex items-start gap-3 border-b border-border ${!n.is_read?"bg-red-500/[0.02]":""}`}><div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${c}`}><I className="w-4 h-4"/></div><div className="min-w-0"><p className={`text-sm truncate ${!n.is_read?"font-semibold text-white":"font-medium text-white/50"}`}>{n.title}</p><p className="text-xs text-white/20 mt-0.5 line-clamp-2">{n.message}</p><p className="text-[11px] text-white/10 mt-1">{new Date(n.created_at).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p></div>{!n.is_read&&<span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5 shadow-[0_0_6px_rgba(239,68,68,0.5)]"/>}</button>)})}</div>
    </motion.div>)}</AnimatePresence>
  </div>);
}
