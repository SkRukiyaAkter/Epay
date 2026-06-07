import type { LucideIcon } from "lucide-react";

export default function EmptyState({ icon:Icon, title, description }:{ icon:LucideIcon; title:string; description?:string }) {
  return (<div className="py-16 text-center"><div className="w-16 h-16 bg-white/[0.02] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border"><Icon className="w-8 h-8 text-white/10" /></div><p className="text-white/50 font-semibold mb-1">{title}</p>{description&&<p className="text-sm text-white/20 max-w-xs mx-auto">{description}</p>}</div>);
}
