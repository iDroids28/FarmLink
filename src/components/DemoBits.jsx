export const inputCls =
  "w-full rounded-xl border border-[#DCE7DC] bg-white px-3 py-2.5 text-[13px] text-[#16301F] focus:outline-none focus:ring-2 focus:ring-[#4CAF50]";
export const primaryBtn =
  "rounded-full px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60";
export const primaryStyle = { background: "linear-gradient(90deg, #4CAF50, #2E7D32)" };

const COLORS = {
  Pending: "bg-blue-50 text-blue-700",
  "Partially Matched": "bg-yellow-100 text-yellow-800",
  Partial: "bg-yellow-100 text-yellow-800",
  "Fully Matched": "bg-green-100 text-green-800",
  Matched: "bg-green-100 text-green-800",
  Approved: "bg-green-100 text-green-800",
  Available: "bg-green-100 text-green-800",
  Balanced: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-600",
  Unmatched: "bg-red-100 text-red-700",
  Rejected: "bg-red-100 text-red-700",
  Shortage: "bg-red-100 text-red-700",
  Surplus: "bg-sky-100 text-sky-700",
};

export function StatusBadge({ status }) {
  return (
    <span className={"inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold " + (COLORS[status] || "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-[20px] font-semibold text-[#16301F]">{title}</h2>
        {subtitle && <p className="text-[13.5px] text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-[#16301F]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function DataTable({ columns, rows, empty = "Nothing here yet." }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="bg-[#F4F7F3] text-gray-600">
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">{empty}</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 align-middle text-[#16301F]">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DetailCard({ title, rows, onClose }) {
  return (
    <div className="rounded-2xl border border-[#DCE7DC] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14.5px] font-semibold text-[#16301F]">{title}</h3>
        <button type="button" onClick={onClose} className="text-[12.5px] font-medium text-[#2E7D32] hover:underline">Close</button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] text-gray-500">{k}</dt>
            <dd className="text-[13.5px] font-medium text-[#16301F]">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LoadNote({ loading, error }) {
  if (error) return <p className="text-[12.5px] text-red-600">{error}</p>;
  if (loading) return <p className="text-[12.5px] text-gray-500">Loading…</p>;
  return null;
}