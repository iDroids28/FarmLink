import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import { Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import { requestRepository, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, requestKindLabel } from "../../repositories/requestRepository";
import { getUserMessage } from "../../api/farmlinkApi.js";

export default function MyRequests() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () =>
      requestRepository
        .mine()
        .then((d) => { setRows(d?.requests || []); setError(""); })
        .catch((e) => setError(getUserMessage(e))),
    []
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function cancel(id) {
    if (busyId) return;
    setBusyId(id);
    setError("");
    setNote("");
    try {
      await requestRepository.cancel(id);
      setNote("Request cancelled.");
    } catch (e) {
      setError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  const list = rows || [];
  const pendingCount = list.filter((r) => r.status === "pending_confirmation").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        subtitle="Pre-orders and supply requests you sent. They stay Pending confirmation until the farmer accepts. Then they become Pre-ordered."
      />
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      {pendingCount > 0 && (
        <p className="text-[13px] font-semibold text-[#16301F]">{pendingCount} waiting for the farmer</p>
      )}

      {rows !== null && list.length === 0 ? (
        <EmptyState icon={Send} title="No requests yet" message="Open Find Supply and tap Pre-order or Request Supply on a product." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <GlassCard key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-[#16301F]">{r.product}</p>
                  <p className="text-[12.5px] text-gray-500">{requestKindLabel(r)} · {r.location}</p>
                </div>
                <StatusBadge
                  label={REQUEST_STATUS_LABEL[r.status] || r.status}
                  tone={REQUEST_STATUS_TONE[r.status] || "gray"}
                />
              </div>
              <p className="mt-2 text-[13.5px] text-[#16301F]">
                <b>{formatQty(r.quantity)} {r.unit}</b> · needed {formatDate(r.neededDate)}
              </p>
              {r.notes && <p className="mt-1 text-[12.5px] text-gray-600">Your message: {r.notes}</p>}
              {r.status === "confirmed" && (
                <p className="mt-2 rounded-lg bg-green-50 p-2 text-[12.5px] text-green-800">
                  Accepted by the farmer. This is now pre-ordered.
                </p>
              )}
              {r.status === "pending_confirmation" && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => cancel(r.id)}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                  >
                    Cancel request
                  </button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}