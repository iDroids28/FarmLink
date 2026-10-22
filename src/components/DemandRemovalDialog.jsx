import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function DemandRemovalDialog({ demand, busy = false, error = "", onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  useEffect(() => { setReason(""); }, [demand?.id]);
  if (!demand) return null;
  const valid = reason.trim().length >= 5 && reason.trim().length <= 500;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-5" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()} role="dialog" aria-modal="true" aria-label="Remove business demand">
      <form onSubmit={(e) => { e.preventDefault(); if (valid && !busy) onConfirm?.(reason.trim()); }} className="w-full max-w-lg rounded-3xl border border-[#F0D5C9] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700"><AlertTriangle size={21} /></span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-[#16301F]">Remove demand?</h2><p className="mt-1 text-[12.5px] leading-5 text-gray-600">{demand.product || "This demand"} · {demand.quantity ?? ""} {demand.unit || ""}. This will cancel pending matches and release their reserved quantity. Confirmed pre-orders are protected.</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={18} /></button>
        </div>
        <label className="mt-5 block"><span className="mb-1.5 block text-[12.5px] font-semibold text-[#16301F]">Reason for removal <span className="text-red-600">*</span></span><textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={4} maxLength={500} required placeholder="Explain why this demand is being removed…" className="w-full resize-y rounded-xl border border-[#DCE7DC] px-3 py-2.5 text-[13px] text-[#16301F] outline-none focus:ring-2 focus:ring-[#4CAF50]"/><span className="mt-1 block text-[11px] text-gray-500">Enter at least 5 characters ({reason.trim().length}/500).</span></label>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-[12.5px] text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-[#DCE7DC] px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!valid || busy} className="rounded-full bg-red-700 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Removing…" : "Remove demand"}</button></div>
      </form>
    </div>
  );
}
