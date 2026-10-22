import { useState } from "react";
import GlassCard from "../components/GlassCard.jsx";
import RoleApplicationsPanel from "../components/RoleApplicationsPanel.jsx";
import { PageHeader, DataTable, LoadNote } from "../components/DemoBits.jsx";
import AdminBuyerProfileModal from "../components/AdminBuyerProfileModal.jsx";
import { useLoad } from "../api/farmlinkApi.js";

export default function AdminBuyers() {
  const { data, loading, error } = useLoad("/admin/buyers");
  const [selected, setSelected] = useState(null);
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "reqCount", label: "Requirements" },
    {
      key: "action", label: "Action",
      render: (b) => (
        <button type="button" onClick={() => setSelected(b.id)} className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200">
          View Profile
        </button>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Buyers / Business" subtitle="Review Business / Buyer applications and view approved buyers." />
      <LoadNote loading={loading && !data} error={error} />

      <RoleApplicationsPanel type="buyer" />

      <GlassCard padding="p-0">
        <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">Approved Buyers ({data?.buyers?.length ?? 0})</h3>
        <div className="mt-3">
          <DataTable columns={columns} rows={data?.buyers || []} empty="No buyers yet." />
        </div>
      </GlassCard>
      {selected && (
        <AdminBuyerProfileModal
          buyerId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}