"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, User, Wallet, Lock, Shield, Key, CheckCircle2, Loader2, Copy, XCircle, ChevronDown, Gauge, Timer, Fingerprint } from "lucide-react";
import { toast } from "sonner";

interface Enc { step_1_message_m: string; step_2_k1_hex: string; step_3_f1_b64: string; step_4_aes_key_hex: string; step_4_nonce: string; step_4_hkdf_info: string; step_5_iv_hex: string; step_5_aad: string; step_5_ciphertext_hex: string; step_5_auth_tag_hex: string; encrypted_payload_b64: string; declared_t_version: number; t_current_hex: string; timing_ms: number; }
interface Dec { step_4_iv_hex: string; step_5_decryption_success: boolean; step_6_plaintext: string; step_7_hmac_match: boolean; step_7_hmac_f2_computed_hex: string; timing_ms: number; }

const eSteps = [{ id: "m", icon: User, label: "Message M", desc: "JSON payload with sender, receiver, amount, nonce" }, { id: "k1", icon: Fingerprint, label: "K1 Derivation", desc: "HMAC-SHA256(activation_code, NID_hash || browser_fp_hash)" }, { id: "f1", icon: Key, label: "HMAC F1", desc: "F1 = HMAC-SHA256(K1, M) — integrity seal" }, { id: "aes", icon: Lock, label: "AES Key Derivation", desc: "HKDF-SHA256(K2 || session_secret || T, nonce, info)" }, { id: "enc", icon: Shield, label: "AES-256-GCM Encrypt", desc: "IV(12B) || AES-GCM(M||F1, AAD) || AuthTag(16B)" }, { id: "tls", icon: Shield, label: "TLS 1.3 Transport", desc: "Payload wrapped in TLS 1.3 record over HTTPS" }];
const dSteps = [{ id: "dec", icon: Shield, label: "TLS 1.3 Termination", desc: "Nginx terminates TLS, passes decrypted HTTP to Flask" }, { id: "aesd", icon: Lock, label: "AES-GCM Decrypt", desc: "Decrypt with same HKDF key, verify GCM auth tag" }, { id: "hmacv", icon: Key, label: "HMAC Verification", desc: "F2 = HMAC(K1, M). Compare F1 == F2 (constant-time)" }];

const cp = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };
const d = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SimulatePage() {
  const [rec, setRec] = useState(""); const [amt, setAmt] = useState("");
  const [loading, setLoading] = useState(false); const [enc, setEnc] = useState<Enc | null>(null);
  const [dec, setDec] = useState<Dec | null>(null); const [es, setEs] = useState(-1);
  const [ds, setDs] = useState(-1); const [ex, setEx] = useState<string | null>(null);

  const run = async () => { if (!rec.trim() || !amt.trim() || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) { toast.error("Invalid input"); return; }
    setLoading(true); setEnc(null); setDec(null); setEs(-1); setDs(-1);
    try { for (let i = 0; i < 6; i++) { setEs(i); await d(400); }
      const er = await fetch("/api/simulate/encrypt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiver_username: rec.trim(), amount: amt.trim(), currency: "BDT" }) });
      const ed = await er.json(); if (!er.ok) throw new Error(ed.error); setEnc(ed); await d(500);
      for (let i = 0; i < 3; i++) { setDs(i); await d(400); }
      const dr = await fetch("/api/simulate/decrypt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encrypted_payload: ed.encrypted_payload_b64, declared_t_version: ed.declared_t_version, nonce: ed.step_4_nonce }) });
      const dd = await dr.json(); if (!dr.ok) throw new Error(dd.error); setDec(dd); setDs(3);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const total = enc && dec ? (enc.timing_ms + dec.timing_ms).toFixed(1) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center"><FlaskConical className="w-6 h-6 text-red-600" /></div><div><h2 className="text-xl font-bold text-gray-900">Crypto Simulator</h2><p className="text-sm text-gray-500">See how TLS, AES-256-GCM, and HMAC-SHA256 protect your transaction</p></div></div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="e.g. bob" disabled={loading} className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all disabled:opacity-50" /></div>
          <div className="flex-1 relative"><Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount" step="0.01" min="1" disabled={loading} className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all disabled:opacity-50" /></div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={run} disabled={loading} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-red-200">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FlaskConical className="w-5 h-5" />}{loading ? "Running..." : "Simulate"}</motion.button>
        </div>
        {total && <div className="mt-4 flex items-center gap-4 text-sm border-t border-gray-100 pt-4"><div className="flex items-center gap-1.5 text-gray-500"><Timer className="w-4 h-4" />Encrypt: {enc?.timing_ms}ms</div><div className="flex items-center gap-1.5 text-gray-500"><Timer className="w-4 h-4" />Decrypt: {dec?.timing_ms}ms</div><div className="flex items-center gap-1.5 text-red-600 font-semibold"><Gauge className="w-4 h-4" />Total: {total}ms</div></div>}
      </motion.div>

      {(loading || enc) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[{ steps: eSteps, step: es, prefix: "enc", side: "Browser", icon: Lock } as const,
            { steps: dSteps, step: ds, prefix: "dec", side: "Server", icon: Shield } as const].map((col) => (
            <div key={col.prefix} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><col.icon className="w-4 h-4" /> {col.side} Side</h3>
              {col.steps.map((step, i) => {
                const done = col.prefix === "enc" ? !!enc : !!dec;
                const active = (col.prefix === "enc" ? !enc : !dec) && col.step === i;
                const open = ex === `${col.prefix}-${step.id}`;
                return (
                  <motion.div key={step.id} initial={{ opacity: 0, x: col.prefix === "enc" ? -20 : 20 }} animate={{ opacity: col.step >= i ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1 }}
                    className={`bg-white rounded-xl border transition-all ${done ? "border-emerald-200 bg-emerald-50/30" : active ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}>
                    <button onClick={() => setEx(open ? null : `${col.prefix}-${step.id}`)} className="w-full p-4 flex items-center gap-3 text-left">
                      {done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" /> : active ? <Loader2 className="w-5 h-5 animate-spin text-red-500 flex-shrink-0" /> : <step.icon className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                      <div><p className={`text-sm font-semibold ${done ? "text-emerald-700" : active ? "text-red-700" : "text-gray-400"}`}>{step.label}</p><p className="text-xs text-gray-400 mt-0.5">{step.desc}</p></div>
                      <ChevronDown className={`w-4 h-4 ml-auto text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>{open && (col.prefix === "enc" ? enc : dec) && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-100"><div className="p-4 space-y-2">
                        {col.prefix === "enc" ? <>
                          {step.id === "m" && <Hex l="Message M (JSON)" v={(enc as Enc).step_1_message_m} />}
                          {step.id === "k1" && <Hex l="K1 (HMAC Key)" v={(enc as Enc).step_2_k1_hex} />}
                          {step.id === "f1" && <><Hex l="F1 (base64)" v={(enc as Enc).step_3_f1_b64} /><p className="text-xs text-gray-400">HMAC-SHA256(K1, serialize(M))</p></>}
                          {step.id === "aes" && <><Hex l="AES-256 Key (HKDF)" v={(enc as Enc).step_4_aes_key_hex} /><p className="text-xs text-gray-400">IKM: K2 || sec || T / Info: "epayment-transaction-v1"</p></>}
                          {step.id === "enc" && <><Hex l="IV (96-bit)" v={(enc as Enc).step_5_iv_hex} /><Hex l="Ciphertext + Auth Tag" v={(enc as Enc).step_5_ciphertext_hex} long /></>}
                          {step.id === "tls" && <div className="bg-gray-900 rounded-lg p-3"><p className="text-xs text-gray-500 mb-2">TLS 1.3 Record</p><div className="border border-dashed border-red-500/20 rounded p-2"><p className="text-xs text-red-400 font-mono break-all">{(enc as Enc).encrypted_payload_b64.slice(0, 120)}...</p></div></div>}
                        </> : <>
                          {step.id === "dec" && <div className="bg-gray-900 rounded-lg p-3"><p className="text-xs text-gray-500 mb-2">TLS terminated at Nginx</p><div className="border border-dashed border-gray-600 rounded p-2"><p className="text-xs text-gray-400 font-mono break-all">{enc?.encrypted_payload_b64.slice(0, 120)}...</p></div></div>}
                          {step.id === "aesd" && <><div className="flex items-center gap-2">{(dec as Dec).step_5_decryption_success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}<span className={`text-sm font-semibold ${(dec as Dec).step_5_decryption_success ? "text-emerald-600" : "text-rose-600"}`}>GCM Auth: {(dec as Dec).step_5_decryption_success ? "VERIFIED" : "FAILED"}</span></div><Hex l="Plaintext" v={(dec as Dec).step_6_plaintext.slice(0, 200)} /></>}
                          {step.id === "hmacv" && <><div className="flex items-center gap-2 mb-3">{(dec as Dec).step_7_hmac_match ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}<span className={`font-bold ${(dec as Dec).step_7_hmac_match ? "text-emerald-600" : "text-rose-600"}`}>HMAC: {(dec as Dec).step_7_hmac_match ? "MATCH" : "MISMATCH"}</span></div><Hex l="F2 (server computed)" v={(dec as Dec).step_7_hmac_f2_computed_hex} /><p className="text-xs text-gray-400">F2 = HMAC(K1, M) / compare_digest = {String((dec as Dec).step_7_hmac_match)}</p></>}
                        </>}
                      </div></motion.div>
                    )}</AnimatePresence>
                  </motion.div>
                );
              })}
              {col.prefix === "dec" && dec?.step_7_hmac_match && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" /><p className="font-bold text-emerald-700">Transaction Verified</p><p className="text-xs text-emerald-600 mt-1">All 4 layers passed: TLS + GCM + HMAC + Replay</p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Hex({ l, v, long }: { l: string; v: string; long?: boolean }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1"><p className="text-[10px] text-gray-500 uppercase">{l}</p><button onClick={() => cp(v)} className="text-gray-500 hover:text-gray-300"><Copy className="w-3 h-3" /></button></div>
      <p className="text-xs text-emerald-400 font-mono break-all">{v.length > 150 && !long ? v.slice(0, 150) + "..." : v}</p>
    </div>
  );
}
