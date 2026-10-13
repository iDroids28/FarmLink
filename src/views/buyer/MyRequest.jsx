import { useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import { StatusBadge, DataTable, PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../../api/farmlinkApi.js";

const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

// My Request shows BOTH:
//  1) the requirements created from My Requirements > Create New Requirement
//  2) the pre-orders sent to farmers from Find Supply
export default function MyRequests() {
  const reqs = useLoad("/requirements/mine");
  const pre = useLoad("/preorders/mine");
  const [listError, setListError] = useState("");

  const requirements = reqs.data?.requirements || [];
  const preorders = pre.data?.preorders || [];

  function cancel(id) {
    setListError("");
    api.patch(`/preorders/${id}/cancel`).then(pre.reload).catch((err) => setListError(getUserMessage(err)));
  }

  const reqColumns = [
    { key: "code", label: "ID", render: (r) => r.code || `#${r.id}` },
    { key: "product", label: "Product", render: (r) => <span className="font-medium">{r.product}</span> },
    { key: "quantity", label: "Qty", render: (r) => `${r.quantity} ${r.unit}` },
    { key: "neededDate", label: "Needed" },
    { key: "matched", label: "Matched", render: (r) => r.matched ?? 0 },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const preColumns = [
    { key: "code", label: "ID" },
    { key: "product", label: "Product", render: (r) => (<div><p className="font-medium">{r.product}</p><p className="text-[11.5px] text-gray-500">Farmer: {r.farmerName}</p></div>) },
    { key: "quantity", label: "Qty", render: (r) => `${r.quantity} ${r.unit}` },
    { key: "total", label: "Total", render: (r) => peso(r.total) },
    { key: "neededDate", label: "Needed" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "action", label: "Action", render: (r) =>
      r.status === "Pending" ? (
        <button type="button" onClick={() => cancel(r.id)} className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200">Cancel</button>
      ) : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Request" subtitle="Your product requirements and your pre-orders to farmers." />
      <LoadNote loading={(reqs.loading && !reqs.data) || (pre.loading && !pre.data)} error={reqs.error || pre.error} />
      {listError && <p className="text-[12.5px] text-red-600">{listError}</p>}

      <GlassCard padding="p-0">
        <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">Product requirements ({requirements.length})</h3>
        <div className="mt-3">
          <DataTable columns={reqColumns} rows={requirements} empty="No requirements yet. Create one from My Requirements." />
        </div>
      </GlassCard>

      <GlassCard padding="p-0">
        <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">Pre-orders ({preorders.length})</h3>
        <div className="mt-3">
          <DataTable columns={preColumns} rows={preorders} empty="No pre-orders yet. Open Find Supply and pre-order a product." />
        </div>
      </GlassCard>
    </div>
  );
}