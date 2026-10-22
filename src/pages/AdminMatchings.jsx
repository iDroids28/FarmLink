import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { PageHeader, DataTable, StatusBadge, LoadNote } from "../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../api/farmlinkApi.js";
import AdminBuyerProfileModal from "../components/AdminBuyerProfileModal.jsx";
import DemandRemovalDialog from "../components/DemandRemovalDialog.jsx";

const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" }) : "—";
const matchStatus = (status) => ({ pending_confirmation: "Pending Confirmation", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" }[status] || status || "—");
const demandStatus = (status) => ({ open: "Open", potential_match: "Potential Match", pending_confirmation: "Pending Confirmation", partially_matched: "Partially Matched", matched: "Matched", completed: "Completed", cancelled: "Cancelled", expired: "Expired" }[status] || status || "—");

export default function AdminMatchings() {
  const { data, loading, error, reload } = useLoad("/admin/matchings");
  const [buyerId, setBuyerId] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [note, setNote] = useState("");

  async function removeDemand(reason) {
    if (!removeTarget || removeBusy) return;
    setRemoveBusy(true); setRemoveError(""); setNote("");
    try {
      await api.post(`/admin/requirements/${removeTarget.id}/remove`, { reason });
      setNote(`Demand ${removeTarget.code || removeTarget.product} was removed. The buyer was notified.`);
      setRemoveTarget(null);
      await reload();
    } catch (e) {
      setRemoveError(getUserMessage(e));
    } finally { setRemoveBusy(false); }
  }

  const matchColumns = [
    { key: "code", label: "Match ID" },
    { key: "product", label: "Product", render: (r) => <div><p className="font-semibold">{r.product}</p><p className="text-[11.5px] text-gray-500">{r.quantity} {r.unit}</p></div> },
    { key: "buyerName", label: "Buyer" },
    { key: "farmerName", label: "Farmer" },
    { key: "location", label: "Location" },
    { key: "neededDate", label: "Needed Date", render: (r) => dateLabel(r.neededDate) },
    { key: "status", label: "Match Status", render: (r) => <StatusBadge status={matchStatus(r.status)} /> },
    { key: "demandStatus", label: "Demand Status", render: (r) => <StatusBadge status={demandStatus(r.demandStatus)} /> },
    { key: "action", label: "Action", render: (r) => <div className="flex flex-wrap gap-2"><button type="button" disabled={!r.buyerId} onClick={() => setBuyerId(r.buyerId)} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"><Eye size={13} /> View Buyer</button>{r.canRemoveDemand && <button type="button" onClick={() => { setRemoveTarget({ id: r.demandId, code: `DEM-${String(r.demandId).slice(-5).toUpperCase()}`, product: r.product, quantity: r.quantity, unit: r.unit }); setRemoveError(""); }} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-100"><Trash2 size={13} /> Remove Demand</button>}</div> },
  ];
  const balanceColumns = [
    { key: "product", label: "Product" },
    { key: "unit", label: "Unit" },
    { key: "demand", label: "Remaining Demand", render: (r) => `${r.demand} ${r.unit}` },
    { key: "supply", label: "Available Supply", render: (r) => `${r.supply} ${r.unit}` },
    { key: "result", label: "Result", render: (r) => <StatusBadge status={r.result} /> },
    { key: "diff", label: "Difference", render: (r) => `${r.diff} ${r.unit}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Matching" subtitle="All product matches across buyer demands and farmer supply offers." action={<button type="button" onClick={() => reload()} className="rounded-full border border-[#DCE7DC] px-3 py-1.5 text-[12px] font-semibold text-[#2E7D32] hover:bg-[#F4F7F3]">Refresh</button>} />
      <LoadNote loading={loading && !data} error={error} />
      {note && <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">{note}</p>}
      <GlassCard padding="p-0"><div className="px-5 pt-5"><h3 className="text-[14.5px] font-semibold text-[#16301F]">All Matches ({data?.matches?.length ?? data?.rows?.length ?? 0})</h3><p className="mt-1 text-[12px] text-gray-500">Includes pending, confirmed, declined, and cancelled match records.</p></div><div className="mt-3"><DataTable columns={matchColumns} rows={data?.matches || data?.rows || []} empty="No match records yet." /></div></GlassCard>
      <div className="space-y-3"><PageHeader title="Shortage & Surplus" subtitle="Remaining demand compared with available approved supply for each product and unit."/><GlassCard padding="p-0"><DataTable columns={balanceColumns} rows={data?.balance || []} empty="No demand or available supply to compare yet."/></GlassCard></div>
      {buyerId && <AdminBuyerProfileModal buyerId={buyerId} onClose={() => setBuyerId("")} />}
      {removeTarget && <DemandRemovalDialog demand={removeTarget} busy={removeBusy} error={removeError} onClose={() => { if (!removeBusy) { setRemoveTarget(null); setRemoveError(""); } }} onConfirm={removeDemand} />}
    </div>
  );
}
