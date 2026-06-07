import { Loader2 } from "lucide-react";

export default function LoadingSkeleton({ variant="spinner", rows=5 }:{ variant?:"spinner"|"card"|"table"; rows?:number }) {
  if(variant==="spinner") return <div className="flex items-center justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-red-400" /></div>;
  if(variant==="card") return <div className="animate-pulse space-y-6"><div className="bg-surface-3 rounded-2xl h-56 border border-border" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-surface-3 rounded-2xl h-24 border border-border" /><div className="bg-surface-3 rounded-2xl h-24 border border-border" /></div></div>;
  if(variant==="table") return <div className="animate-pulse space-y-3 p-6">{Array.from({length:rows}).map((_,i)=><div key={i} className="flex items-center gap-4"><div className="w-10 h-10 bg-surface-4 rounded-xl" /><div className="flex-1 space-y-2"><div className="h-4 bg-surface-4 rounded w-1/3" /><div className="h-3 bg-surface-3 rounded w-1/4" /></div><div className="h-5 bg-surface-4 rounded w-20" /></div>)}</div>;
  return null;
}
