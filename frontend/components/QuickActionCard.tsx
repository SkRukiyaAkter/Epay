"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props { href:string; icon:LucideIcon; title:string; description:string; variant?:"red"|"gold"|"rose"|"emerald"; }
const v: Record<string,{bg:string;text:string}> = { red:{bg:"bg-red-500/5",text:"text-red-400"}, gold:{bg:"bg-gold-500/5",text:"text-gold-400"}, rose:{bg:"bg-rose-500/5",text:"text-rose-400"}, emerald:{bg:"bg-emerald-500/5",text:"text-emerald-400"} };

export default function QuickActionCard({ href, icon:Icon, title, description, variant="red" }: Props) {
  const c = v[variant];
  return (
    <Link href={href}><motion.div whileHover={{scale:1.02,y:-3}} whileTap={{scale:0.98}} className="card p-6 cursor-pointer flex items-center gap-4 group hover:border-white/[0.08] transition-all duration-300">
      <div className={`w-12 h-12 ${c.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}><Icon className={`w-6 h-6 ${c.text}`} /></div>
      <div className="flex-1"><h3 className="font-semibold text-white">{title}</h3><p className="text-sm text-white/50">{description}</p></div>
      <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-white/30 group-hover:translate-x-1 transition-all duration-300" />
    </motion.div></Link>
  );
}
