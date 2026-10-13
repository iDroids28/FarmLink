import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { DataTable, StatusBadge, LoadNote, inputCls } from "./DemoBits.jsx";
import { ApplicationDetails, fmtDate } from "./RoleApplicationParts.jsx";
import { roleApplicationApi, errorMessage } from "../api/roleApplicationApi.js";

const FILTERS = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["", "All"],
];

export default function RoleApplicationsPanel({ type }) {
  const label = type === "farmer" ? "Farmer" : "Business / Buyer";
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(
    () =>
      roleApplicationApi
        .adminList({ type, status })
        .then((d) => {
          setRows(d.applications);
          setLoadError("");
        })
        .catch((e) => setLoadError(errorMessage(e))),
    [type, status]
  );
  useEffect(() => {
    load();
  }, [load]);

  const selected = rows?.find((r) => r.id === selectedId) || null;

  function open(row) {
    setSelectedId(row.id);
    setReason("");
    setMsg("");
  }

  async function review(decision) {
    if (!selected || busy) return;
    setBusy(true);
    setMsg("");
    try {
      await roleApplicationApi.adminReview(selected.id, decision, reason);
      setSelectedId(null);
      setReason("");
      await load();
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirmApprove(false);
    }
  }

  const columns = [
    {
      key: "applicant",
      label: type === "farmer" ? "Applicant" : "Business",
      render: (a) => (type === "farmer" ? a.fullName : a.businessName) || "—",
    },
    { key: "email", label: "Account Email", render: (a) => a.account?.email || "—" },
    { key: "createdAt", label: "Submitted", render: (a) => fmtDate(a.createdAt) },
    { key: "status", label: "Status", render: (a) => <StatusBadge status={a.statusLabel} /> },
    {
      key: "action",
      label: "Action",
      render: (a) => (
        <button
          type="button"
          onClick={() => open(a)}
          className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200"
        >
          {a.status === "pending" ? "Review" : "View"}
        </button>
      ),
    },
  ];

  return (
    <GlassCard padding="p-0">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <h3 className="text-[14.5px] font-semibold text-[#16301F]">{label} Applications</h3>
        <div className="ml-auto flex flex-wrap gap-1">
          {FILTERS.map(([value, text]) => (
            <button
              key={text}
              type="button"
              onClick={() => {
                setStatus(value);
                setSelectedId(null);
              }}
              className={
                "rounded-full px-3 py-1 text-[12px] font-semibold " +
                (status === value ? "bg-[#2E7D32] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <LoadNote loading={rows === null && !loadError} error={loadError} />
        <DataTable columns={columns} rows={rows || []} empty={`No ${label.toLowerCase()} applications.`} />
      </div>

      {selected && (
        <div className="border-t border-[#E4EEE4] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-[14px] font-semibold text-[#16301F]">
              {label} application
              {selected.account ? ` — ${selected.account.name} (${selected.account.email})` : ""}
            </h4>
            <StatusBadge status={selected.statusLabel} />
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="ml-auto rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
          </div>

          <div className="mt-4">
            <ApplicationDetails application={selected} />
          </div>

          {selected.status !== "pending" && (
            <p className="mt-4 text-[13px] text-gray-600">
              {selected.status === "approved" ? "Approved" : "Rejected"} on {fmtDate(selected.reviewedAt)}.
              {selected.status === "rejected" && selected.rejectionReason && (
                <span className="text-red-600"> Reason: {selected.rejectionReason}</span>
              )}
            </p>
          )}

          {selected.status === "pending" && (
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor={`reject-reason-${type}`} className="mb-1 block text-[12.5px] font-semibold text-[#16301F]">
                  Rejection reason (required only when rejecting)
                </label>
                <textarea
                  id={`reject-reason-${type}`}
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputCls}
                  placeholder="Explain why the application was not approved."
                />
              </div>
              {msg && <p className="text-[12.5px] text-red-600">{msg}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmApprove(true)}
                  className="rounded-md bg-[#2E7D32] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy || reason.trim().length < 5}
                  onClick={() => review("reject")}
                  className="rounded-md bg-[#D32F2F] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmApprove}
        title={`Approve this application? The account will become a ${type === "farmer" ? "Farmer" : "Buyer"} account.`}
        cancelLabel="Cancel"
        confirmLabel="Approve"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => review("approve")}
      />
    </GlassCard>
  );
}