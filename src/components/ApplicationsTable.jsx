import { DataTable, StatusBadge } from "./DemoBits.jsx";

export default function ApplicationsTable({ apps, onReview, onView }) {
  const columns = [
    { key: "name", label: "Name" },
    { key: "farmName", label: "Farm Name" },
    { key: "location", label: "Location" },
    { key: "products", label: "Products" },
    { key: "status", label: "Status", render: (a) => <StatusBadge status={a.status} /> },
    {
      key: "action",
      label: "Action",
      render: (a) => (
        <div className="flex flex-wrap gap-2">
          {onView && (
            <button type="button" onClick={() => onView(a)} className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200">
              View
            </button>
          )}
          {a.status === "Pending" && onReview && (
            <>
              <button type="button" onClick={() => onReview(a.id, "approve")} className="rounded-md bg-[#2E7D32] px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90">
                Accept
              </button>
              <button type="button" onClick={() => onReview(a.id, "reject")} className="rounded-md bg-[#D32F2F] px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90">
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} rows={apps} empty="No applications yet." />;
}