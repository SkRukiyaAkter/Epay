"use client";

import { motion } from "framer-motion";
import { DivideIcon as LucideIcon } from "lucide-react";

interface Props { icon: LucideIcon; label: string; value: string; subValue?: string; variant?: "red"|"gold"|"rose"|"emerald"; }
const v: Record<string,{bg:string;text:string;border:string}> = { red:{bg:"bg-red-500/5",text:"text-red-400",border:"border-red-500/10"}, gold:{bg:"bg-gold-500/5",text:"text-gold-400",border:"border-gold-500/10"}, rose:{bg:"bg-rose-500/5",text:"text-rose-400",border:"border-rose-500/10"}, emerald:{bg:"bg-emerald-500/5",text:"text-emerald-400",border:"border-emerald-500/10"} };

export default function StatCard({ icon:Icon, label, value, subValue, variant="gold" }: Props) {
  const c = v[variant];
  return (
    <motion.div whileHover={{y:-2}} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.35}}
      className="card p-5 group hover:border-white/[0.08] transition-all duration-300">
      <div className="flex items-center gap-3 mb-3"><div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center border ${c.border}`}><Icon className={`w-5 h-5 ${c.text}`} /></div><p className="text-sm text-white/80">{label}</p></div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subValue && <p className="text-xs text-white/50 mt-1">{subValue}</p>}
    </motion.div>
  );
}
