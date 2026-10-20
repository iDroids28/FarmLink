import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Check, X } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../components/DemoBits.jsx";
import { Notice, formatDate, formatQty } from "../components/FormBits.jsx";
import { ProductImage, peso } from "../components/SupplyCard.jsx";
import SupplyFarmerModal from "../components/SupplyFarmerModal.jsx";
import { supplyApi } from "../api/supplyApi.js";

export default function AdminSupplyApprovals() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [profileFor, setProfileFor] = useState(null); // supply whose farmer is shown

  const load = useCallback(
    () => supplyApi.adminPending().then((d) => { setRows(d.supplies || []); setError(""); }).catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    const t = setInterval(load, 15000);
    return () => { window.removeEventListener("focus", load); clearInterval(t); };
  }, [load]);

  async function act(id, fn, okText) {
    if (busy) return;
    setBusy(id); setError(""); setNote("");
    try { await fn(); setNote(okText); } catch (e) { setError(e.message); }
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Supply Approvals" subtitle="Products submitted by farmers. Tap the farmer to see their information. Approve to publish a product to Supply Management and Find Supply, or reject it with a reason." />
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      {rows !== null && rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" message="New farmer submissions will appear here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(rows || []).map((s) => (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
              <ProductImage src={s.image} alt={s.product} type={s.supplyType} />
              <div className="space-y-1 p-4">
                <button type="button" onClick={() => setProfileFor(s)} className="mb-1 flex w-full items-center gap-2 rounded-lg text-left hover:bg-black/[0.03]" aria-label={`View farmer ${s.farmerName}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[12px] font-bold text-[#2E7D32]">
                    {(s.farmerName || "F").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[#16301F]">{s.farmerName || "Farmer"}</span>
                    <span className="block text-[11px] text-gray-500">Farmer · tap to view</span>
                  </span>
                </button>

                <h3 className="truncate text-[15.5px] font-semibold text-[#16301F]">{s.product}</h3>
                <p className="text-[12px] text-gray-500">{s.category}</p>
                <p className="text-[15px] font-bold text-[#16301F]">{peso(s.pricePerUnit)} <span className="text-[12px] font-medium text-gray-500">/ {s.unit}</span></p>
                <p className="text-[12.5px] text-gray-600">{formatQty(s.quantity)} {s.unit} · {s.location}</p>
                <p className="text-[12.5px] text-gray-600">{s.supplyType === "expected" ? "Harvest" : "On Hand since"} {formatDate(s.availabilityDate)}</p>
                {s.description && <p className="rounded-lg bg-gray-50 p-2 text-[12.5px] text-gray-700">{s.description}</p>}
                <div className="flex gap-2 pt-3">
                  <button type="button" disabled={busy === s.id} onClick={() => { setRejecting(s); setReason(""); }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60">
                    <X size={15} /> Reject
                  </button>
                  <button type="button" disabled={busy === s.id}
                    onClick={() => act(s.id, () => supplyApi.approve(s.id), `${s.product} approved. It is now in Supply Management and Find Supply.`)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#1B5E20] py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-60">
                    <Check size={15} /> Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {profileFor && <SupplyFarmerModal supply={profileFor} onClose={() => setProfileFor(null)} />}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setRejecting(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[15.5px] font-semibold text-[#16301F]">Reject {rejecting.product}?</h3>
            <p className="mb-3 text-[12.5px] text-gray-500">The farmer will be notified. You can add a reason (optional).</p>
            <textarea rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-[13px]" placeholder="e.g. Photo is unclear" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="flex-1 rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={() => { const s = rejecting; setRejecting(null); act(s.id, () => supplyApi.reject(s.id, reason), `${s.product} rejected.`); }}
                className="flex-1 rounded-lg bg-red-600 py-2 text-[13px] font-semibold text-white">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}