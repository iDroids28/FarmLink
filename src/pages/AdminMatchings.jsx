import GlassCard from "../components/GlassCard.jsx";
import MatchesTable from "../components/MatchesTable.jsx";
import { PageHeader, DataTable, StatusBadge, LoadNote } from "../components/DemoBits.jsx";
import { useLoad } from "../api/farmlinkApi.js";

export default function AdminMatchings() {
  const { data, loading, error } = useLoad("/admin/matchings");

  const columns = [
    { key: "product", label: "Product" },
    { key: "demand", label: "Total Demand (open)" },
    { key: "supply", label: "Total Supply" },
    { key: "result", label: "Result", render: (b) => <StatusBadge status={b.result} /> },
    { key: "diff", label: "Difference", render: (b) => (b.diff ? `${b.diff} kg` : "—") },
  ];

  return (
    <div className="space-y-6">
      <LoadNote loading={loading && !data} error={error} />
      <MatchesTable rows={data?.rows || []} showBuyer showFarmer subtitle="Buyers matched with farmers." />
      <div className="space-y-3">
        <PageHeader title="Shortage & Surplus" subtitle="Demand compared with supply per product." />
        <GlassCard padding="p-0">
          <DataTable columns={columns} rows={data?.balance || []} empty="No data yet." />
        </GlassCard>
      </div>
    </div>
  );
}