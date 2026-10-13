import { useState } from "react";
import GlassCard from "../components/GlassCard.jsx";
import ApplicationsTable from "../components/ApplicationsTable.jsx";
import RoleApplicationsPanel from "../components/RoleApplicationsPanel.jsx";
import { PageHeader, DataTable, DetailCard, LoadNote } from "../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../api/farmlinkApi.js";

export default function AdminFarmers() {
  const apps = useLoad("/admin/applications");
  const farmers = useLoad("/admin/farmers");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  // Old-style seller applications are kept (no data is deleted). They are only
  // shown while any are still waiting, so they can be finished off.
  const legacyPending = (apps.data?.applications || []).filter((a) => a.status === "Pending");

  function review(id, decision) {
    setError("");
    api
      .patch(`/admin/applications/${id}`, { decision })
      .then(() => Promise.all([apps.reload(), farmers.reload()]))
      .catch((e) => setError(getUserMessage(e)));
  }

  const list = farmers.data?.farmers || [];
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "farmName", label: "Farm", render: (f) => f.farmName || "—" },
    { key: "products", label: "Products", render: (f) => f.products || "—" },
    {
      key: "action", label: "Action",
      render: (f) => (
        <button type="button" onClick={() => setSelected(f)} className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200">
          View Profile
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Farmers" subtitle="Review farmer applications and view approved farmers." />
      <LoadNote loading={farmers.loading && !farmers.data} error={apps.error || farmers.error || error} />

      <RoleApplicationsPanel type="farmer" />

      {legacyPending.length > 0 && (
        <GlassCard padding="p-0">
          <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">
            Earlier seller applications still pending ({legacyPending.length})
          </h3>
          <div className="mt-3">
            <ApplicationsTable apps={legacyPending} onReview={review} />
          </div>
        </GlassCard>
      )}

      <GlassCard padding="p-0">
        <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">Approved Farmers ({list.length})</h3>
        <div className="mt-3">
          <DataTable columns={columns} rows={list} empty="No approved farmers yet." />
        </div>
      </GlassCard>

      {selected && (
        <DetailCard
          title={`Farmer Profile: ${selected.name}`}
          onClose={() => setSelected(null)}
          rows={[
            ["Name", selected.name],
            ["Email", selected.email],
            ["Farm Name", selected.farmName],
            ["Location", selected.location],
            ["Contact", selected.contact],
            ["Farm Size (ha)", selected.farmSize],
            ["Products", selected.products],
          ]}
        />
      )}
    </div>
  );
}