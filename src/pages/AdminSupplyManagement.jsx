import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../components/DemoBits.jsx";
import { Notice, formatDate, formatQty } from "../components/FormBits.jsx";
import { ProductImage, peso } from "../components/SupplyCard.jsx";
import SupplyFarmerModal from "../components/SupplyFarmerModal.jsx";
import { supplyApi } from "../api/supplyApi.js";

// "Live" is now "Approved".
const STATUS = { available: "Approved", reserved: "Reserved", cancelled: "Removed", fulfilled: "Completed" };

export default function AdminSupplyManagement() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [profileFor, setProfileFor] = useState(null); // supply whose farmer is shown

  const load = useCallback(
    () => supplyApi.adminManaged().then((d) => { setRows(d.supplies || []); setError(""); }).catch((e) => setError(e.message)),
    []
  );
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (rows || []).filter((s) => !n || `${s.product} ${s.farmerName} ${s.location} ${s.category || ""}`.toLowerCase().includes(n));
  }, [rows, q]);

  async function remove(s) {
    if (busy || !window.confirm(`Remove ${s.product} from the marketplace?`)) return;
    setBusy(s.id); setError(""); setNote("");
    try { await supplyApi.remove(s.id); setNote(`${s.product} removed.`); } catch (e) { setError(e.message); }
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Supply Management" subtitle="All approved products. These are the listings buyers see in Find Supply. Tap the farmer to see their information." />
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, farmer or location"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-[13px]" />
      </div>

      {rows !== null && shown.length === 0 ? (
        <EmptyState icon={Package} title="No approved supply" message="Approve products in Supply Approvals and they will show here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
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

                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-[15.5px] font-semibold text-[#16301F]">{s.product}</h3>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">{STATUS[s.status] || s.status}</span>
                </div>
                <p className="text-[12px] text-gray-500">{s.category}</p>
                <p className="text-[15px] font-bold text-[#16301F]">{peso(s.pricePerUnit)} <span className="text-[12px] font-medium text-gray-500">/ {s.unit}</span></p>
                <p className="text-[12.5px] text-gray-600">{formatQty(s.availableQuantity)} {s.unit} available · Reserved {formatQty(s.reservedQuantity)}</p>
                <p className="text-[12.5px] text-gray-600">{s.location} · {formatDate(s.availabilityDate)}</p>
                {s.status === "available" && (
                  <button type="button" disabled={busy === s.id || s.reservedQuantity > 0} onClick={() => remove(s)}
                    title={s.reservedQuantity > 0 ? "Has reservations" : ""}
                    className="mt-3 w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                    Remove from marketplace
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {profileFor && <SupplyFarmerModal supply={profileFor} onClose={() => setProfileFor(null)} />}
    </div>
  );
}