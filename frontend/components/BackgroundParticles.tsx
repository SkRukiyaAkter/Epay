"use client";

import { motion } from "framer-motion";

export default function BackgroundParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <motion.div className="absolute w-[700px] h-[700px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, rgba(245,158,11,0.03), transparent 70%)" }}
        animate={{ x: ["-5%","8%","-3%"], y: ["-8%","3%","-5%"], scale: [1,1.04,0.97,1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute w-[500px] h-[500px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(239,68,68,0.03), transparent 70%)" }}
        animate={{ x: ["8%","-5%","3%"], y: ["5%","-3%","8%"], scale: [0.97,1.03,1,0.97] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }} />
      <motion.div className="absolute w-[400px] h-[400px] rounded-full blur-[80px]"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.02), transparent 60%)" }}
        animate={{ x: ["40%","55%","35%"], y: ["55%","45%","65%"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 8 }} />

      {Array.from({ length: 35 }).map((_, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, width: `${2 + Math.random() * 3}px`, height: `${2 + Math.random() * 3}px`,
            background: i % 4 === 0 ? "rgba(251,191,36,0.35)" : i % 4 === 1 ? "rgba(239,68,68,0.25)" : i % 4 === 2 ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.12)",
            boxShadow: i % 4 === 0 ? "0 0 8px rgba(251,191,36,0.3)" : i % 4 === 1 ? "0 0 6px rgba(239,68,68,0.2)" : "none" }}
          animate={{ y: [0, -(25 + Math.random() * 60), 0], opacity: [0, 0.55, 0], scale: [0, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 6, repeat: Infinity, delay: Math.random() * 8 }} />
      ))}

      {[["15%","gold-400/12",200,0],["40%","gold-500/8",160,3],["65%","red-400/6",220,6],["80%","gold-300/5",140,9]].map(([top,color,width,delay],i) => (
        <motion.div key={i} className="absolute h-[1px] rounded-full" style={{ top: top as string, width: `${width}px`, left: "-10%", background: `linear-gradient(to right, transparent, ${color}, transparent)` }}
          animate={{ left: ["-10%","110%"] }} transition={{ duration: 6 + i, repeat: Infinity, ease: "linear", delay: Number(delay) }} />
      ))}

      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(239,68,68,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.08) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(circle at 50% 50%, black 25%, transparent 70%)" }} />
      <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(245,158,11,0.02), transparent)" }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
    </div>
  );
}
