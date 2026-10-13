import GlassCard from "../components/GlassCard.jsx";
import { PageHeader, DataTable, StatusBadge, LoadNote } from "../components/DemoBits.jsx";
import { useLoad } from "../api/farmlinkApi.js";

export default function AdminRequirements() {
  const { data, loading, error } = useLoad("/admin/requirements");
  const columns = [
    { key: "code", label: "ID" },
    { key: "buyerName", label: "Buyer" },
    { key: "product", label: "Product" },
    { key: "qty", label: "Quantity", render: (r) => `${r.quantity} ${r.unit}` },
    { key: "neededDate", label: "Needed Date" },
    { key: "location", label: "Location" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Requirements" subtitle="All product requirements posted by buyers." />
      <LoadNote loading={loading && !data} error={error} />
      <GlassCard padding="p-0">
        <DataTable columns={columns} rows={data?.requirements || []} empty="No requirements yet." />
      </GlassCard>
    </div>
  );
}