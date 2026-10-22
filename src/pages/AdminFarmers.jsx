import { useState } from "react";
import { UserRound, X, ZoomIn } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import ApplicationsTable from "../components/ApplicationsTable.jsx";
import RoleApplicationsPanel from "../components/RoleApplicationsPanel.jsx";
import { PageHeader, DataTable, LoadNote } from "../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../api/farmlinkApi.js";

export default function AdminFarmers() {
  const apps = useLoad("/admin/applications");
  const farmers = useLoad("/admin/farmers");
  const [selected, setSelected] = useState(null);
  const [photoExpanded, setPhotoExpanded] = useState(false);
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
  const closeSelected = () => {
    setSelected(null);
    setPhotoExpanded(false);
  };
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "farmName", label: "Farm", render: (f) => f.farmName || "—" },
    { key: "products", label: "Products", render: (f) => f.products || "—" },
    {
      key: "action", label: "Action",
      render: (f) => (
        <button type="button" onClick={() => { setPhotoExpanded(false); setSelected(f); }} className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && closeSelected()}
          role="dialog"
          aria-modal="true"
          aria-label="Farmer profile"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start gap-4 border-b border-black/5 p-5">
              <button
                type="button"
                onClick={() => selected.photo && setPhotoExpanded(true)}
                disabled={!selected.photo}
                title={selected.photo ? "Click to enlarge profile photo" : "No profile photo uploaded"}
                className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E8F5E9] text-[#2E7D32] disabled:cursor-default"
              >
                {selected.photo ? (
                  <img src={selected.photo} alt={`${selected.name || "Farmer"} profile`} className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={32} aria-label="No profile photo" />
                )}
                {selected.photo && <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100"><ZoomIn size={20} /></span>}
              </button>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2E7D32]">Farmer profile</p>
                <h3 className="mt-1 break-words text-[18px] font-bold leading-tight text-[#16301F]">{selected.name || "Farmer"}</h3>
                <p className="mt-1 break-words text-[13px] text-gray-500">{selected.email || "—"}</p>
                {selected.photo && <p className="mt-2 text-[11px] text-gray-400">Click the photo to enlarge</p>}
              </div>
              <button type="button" onClick={closeSelected} aria-label="Close farmer profile" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-gray-500">Name</dt>
                <dd className="break-words text-[13.5px] font-medium text-[#16301F]">{selected.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-gray-500">Email</dt>
                <dd className="break-words text-[13.5px] font-medium text-[#16301F]">{selected.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-gray-500">Role</dt>
                <dd className="text-[13.5px] font-medium text-[#16301F]">Farmer</dd>
              </div>
              <div>
                <dt className="text-[12px] text-gray-500">Verification</dt>
                <dd className="text-[13.5px] font-medium text-[#16301F]">Approved</dd>
              </div>
            </dl>
            <div className="border-t border-black/5 p-4">
              <button type="button" onClick={closeSelected} className="w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {photoExpanded && selected?.photo && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded farmer profile photo"
          onMouseDown={(e) => e.target === e.currentTarget && setPhotoExpanded(false)}
        >
          <button type="button" onClick={() => setPhotoExpanded(false)} aria-label="Close enlarged photo" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X size={22} /></button>
          <img src={selected.photo} alt={`${selected.name || "Farmer"} profile enlarged`} className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
}