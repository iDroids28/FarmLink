import GlassCard from "../components/GlassCard.jsx";
import { PageHeader, DataTable, LoadNote } from "../components/DemoBits.jsx";
import { useLoad } from "../api/farmlinkApi.js";

export default function AdminSupply() {
  const { data, loading, error } = useLoad("/admin/supplies");
  const columns = [
    { key: "code", label: "ID" },
    { key: "farmerName", label: "Farmer" },
    { key: "product", label: "Product" },
    { key: "qty", label: "Quantity", render: (s) => `${s.quantity} ${s.unit}` },
    { key: "availableDate", label: "Available Date" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Supply Management" subtitle="All supply listed by farmers." />
      <LoadNote loading={loading && !data} error={error} />
      <GlassCard padding="p-0">
        <DataTable columns={columns} rows={data?.supplies || []} empty="No supply listed yet." />
      </GlassCard>
    </div>
  );
}