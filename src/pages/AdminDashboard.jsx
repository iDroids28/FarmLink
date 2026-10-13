import { useCallback, useEffect, useState } from "react";
import { Users, Sprout, Store, UserCheck } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { DataTable, StatusBadge, LoadNote } from "../components/DemoBits.jsx";
import { fmtDate } from "../components/RoleApplicationParts.jsx";
import { roleApplicationApi, errorMessage } from "../api/roleApplicationApi.js";
import { API_URL } from "../AuthShared";

// Same base derivation roleApplicationApi.js uses: API_URL minus "/auth".
// => GET /api/admin/stats (NOT the /api/farmlink prefix of the old client).
const ADMIN_BASE = API_URL.replace(/\/auth\/?$/, "") + "/admin";

async function loadStats() {
  let res;
  try {
    res = await fetch(`${ADMIN_BASE}/stats`, { credentials: "include" });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.");
  return data;
}

const TYPE_LABEL = { farmer: "Farmer", buyer: "Business / Buyer" };

export default function AdminDashboard({ user, onNavigate }) {
  // Pending applications come from the NEW role-application system, the same
  // endpoint the Farmers / Buyers pages use:
  //   GET /api/role-applications/admin/applications?type=...&status=pending
  const [pending, setPending] = useState(null); // { farmer: [], buyer: [] }
  const [loadError, setLoadError] = useState("");
  // Account totals come from GET /api/admin/stats (users.total / farmer / buyer).
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");

  const loadApps = useCallback(
    () =>
      Promise.all([
        roleApplicationApi.adminList({ type: "farmer", status: "pending" }),
        roleApplicationApi.adminList({ type: "buyer", status: "pending" }),
      ])
        .then(([f, b]) => {
          setPending({ farmer: f.applications || [], buyer: b.applications || [] });
          setLoadError("");
        })
        .catch((e) => setLoadError(errorMessage(e))),
    []
  );

  const loadTotals = useCallback(
    () =>
      loadStats()
        .then((d) => {
          setStats(d);
          setStatsError("");
        })
        .catch((e) => setStatsError(errorMessage(e))),
    []
  );

  const load = useCallback(() => Promise.all([loadApps(), loadTotals()]), [loadApps, loadTotals]);

  // Load on open, and again whenever the admin returns to this tab.
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const rows = pending
    ? [...pending.farmer, ...pending.buyer].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];
  const pendingCount = pending ? rows.length : undefined;
  const pendingSub = pending ? `${pending.farmer.length} Farmer · ${pending.buyer.length} Buyer` : "";

  const cards = [
    { label: "Total Users", value: stats?.users?.total, icon: Users },
    { label: "Farmers", value: stats?.users?.farmer, icon: Sprout },
    { label: "Buyers", value: stats?.users?.buyer, icon: Store },
    { label: "Pending Applications", value: pendingCount, sub: pendingSub, icon: UserCheck },
  ];
  const name = (user?.name || user?.email || "there").split("@")[0];

  const columns = [
    {
      key: "applicant",
      label: "Applicant",
      render: (a) => (a.type === "farmer" ? a.fullName : a.businessName) || "—",
    },
    { key: "type", label: "Type", render: (a) => TYPE_LABEL[a.type] || a.type },
    { key: "email", label: "Account Email", render: (a) => a.account?.email || "—" },
    { key: "createdAt", label: "Submitted", render: (a) => fmtDate(a.createdAt) },
    { key: "status", label: "Status", render: (a) => <StatusBadge status={a.statusLabel} /> },
    {
      key: "action",
      label: "Action",
      render: (a) => (
        <button
          type="button"
          onClick={() => onNavigate?.(a.type === "farmer" ? "farmers" : "buyers")}
          className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[20px] font-semibold text-[#16301F]">Welcome back, {name}</h2>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-white"
            style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
          >
            Admin
          </span>
        </div>
        <p className="text-[13.5px] text-gray-500">An overview of users and applications.</p>
      </div>

      <LoadNote loading={(!pending || !stats) && !loadError && !statsError} error={loadError || statsError} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon }) => (
          <GlassCard key={label}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-gray-500">{label}</span>
              <Icon size={16} className="text-[#4CAF50]" />
            </div>
            <p className="mt-2 text-[24px] font-bold text-[#16301F]">{value ?? "—"}</p>
            {sub && <p className="text-[12px] text-gray-500">{sub}</p>}
          </GlassCard>
        ))}
      </div>

      <GlassCard padding="p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-[14.5px] font-semibold text-[#16301F]">Pending Applications</h3>
          <div className="flex gap-4">
            <button type="button" onClick={() => onNavigate?.("farmers")} className="text-[12.5px] font-medium text-[#2E7D32] hover:underline">
              View Farmers
            </button>
            <button type="button" onClick={() => onNavigate?.("buyers")} className="text-[12.5px] font-medium text-[#2E7D32] hover:underline">
              View Buyers
            </button>
          </div>
        </div>
        <div className="mt-3">
          <DataTable columns={columns} rows={rows} empty="No pending applications." />
        </div>
      </GlassCard>
    </div>
  );
}