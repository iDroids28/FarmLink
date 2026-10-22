import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { PageHeader, DataTable, StatusBadge, LoadNote } from "../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../api/farmlinkApi.js";
import AdminBuyerProfileModal from "../components/AdminBuyerProfileModal.jsx";
import DemandRemovalDialog from "../components/DemandRemovalDialog.jsx";

const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" }) : "—";

export default function AdminRequirements() {
  const { data, loading, error, reload } = useLoad("/admin/requirements");
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

  const columns = [
    { key: "code", label: "Demand ID" },
    { key: "buyerName", label: "Buyer / Business", render: (r) => <div><p className="font-semibold text-[#16301F]">{r.buyerName}</p><p className="text-[11.5px] text-gray-500">{r.buyerEmail}</p></div> },
    { key: "product", label: "Product", render: (r) => <div><p className="font-semibold">{r.product}</p>{r.category && <p className="text-[11px] text-[#55815A]">{r.category}</p>}{r.adminRemovalReason && <p className="mt-1 text-[11px] text-amber-800">Removal reason: {r.adminRemovalReason}</p>}</div> },
    { key: "quantity", label: "Quantity", render: (r) => `${r.quantity} ${r.unit}` },
    { key: "neededDate", label: "Needed Date", render: (r) => dateLabel(r.neededDate) },
    { key: "location", label: "Location" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.adminRemovedAt ? "Removed by Admin" : r.status} /> },
    { key: "action", label: "Action", render: (r) => <div className="flex flex-wrap gap-2"><button type="button" disabled={!r.buyerId} onClick={() => setBuyerId(r.buyerId)} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"><Eye size={13} /> View Buyer</button>{r.canRemove && <button type="button" onClick={() => { setRemoveTarget(r); setRemoveError(""); }} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-100"><Trash2 size={13} /> Remove</button>}</div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Business Demand" subtitle="Review all demands posted by buyers, inspect buyer profiles, and remove invalid demands with a recorded reason." />
      <LoadNote loading={loading && !data} error={error} />
      {note && <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">{note}</p>}
      <GlassCard padding="p-0"><div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5"><h3 className="text-[14.5px] font-semibold text-[#16301F]">All Business Demands ({data?.requirements?.length ?? 0})</h3><button type="button" onClick={() => reload()} className="rounded-full border border-[#DCE7DC] px-3 py-1.5 text-[12px] font-semibold text-[#2E7D32] hover:bg-[#F4F7F3]">Refresh</button></div><div className="mt-3"><DataTable columns={columns} rows={data?.requirements || []} empty="No business demands have been posted yet." /></div></GlassCard>
      {buyerId && <AdminBuyerProfileModal buyerId={buyerId} onClose={() => setBuyerId("")} />}
      {removeTarget && <DemandRemovalDialog demand={removeTarget} busy={removeBusy} error={removeError} onClose={() => { if (!removeBusy) { setRemoveTarget(null); setRemoveError(""); } }} onConfirm={removeDemand} />}
    </div>
  );
}
