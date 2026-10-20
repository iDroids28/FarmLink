import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import { ActionButton, Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import { requestRepository, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, requestKindLabel } from "../../repositories/requestRepository";
import { getUserMessage } from "../../api/farmlinkApi.js";

export default function IncomingRequests() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () =>
      requestRepository
        .incoming()
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

  async function act(id, fn, okText) {
    if (busyId) return;
    setBusyId(id);
    setError("");
    setNote("");
    try {
      await fn(id);
      setNote(okText);
    } catch (e) {
      setError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  const list = rows || [];
  const waiting = list.filter((r) => r.status === "pending_confirmation");
  const done = list.filter((r) => r.status !== "pending_confirmation");

  const renderCard = (r) => (
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
        Wants <b>{formatQty(r.quantity)} {r.unit}</b> · needed {formatDate(r.neededDate)}
      </p>
      {r.notes && (
        <p className="mt-1 rounded-lg bg-gray-50 p-2 text-[12.5px] text-gray-700">Buyer's message: {r.notes}</p>
      )}
      {r.status === "pending_confirmation" && (
        <>
          <p className="mt-3 rounded-xl bg-[#F1F8E9] p-3 text-[12.5px] text-[#33691E]">
            If you accept, {formatQty(r.quantity)} {r.unit} is reserved and pre-ordered for the buyer.
            If you decline, it stays in your available supply.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-black/5 pt-3">
            <ActionButton variant="secondary" disabled={busyId === r.id}
              onClick={() => act(r.id, requestRepository.decline, "Request declined.")}>
              Decline
            </ActionButton>
            <ActionButton disabled={busyId === r.id}
              onClick={() => act(r.id, requestRepository.accept, "Request accepted. It is now pre-ordered.")}>
              Accept
            </ActionButton>
          </div>
        </>
      )}
    </GlassCard>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Requests" subtitle="Buyers who asked for your supply. Accept to pre-order it, or decline." />
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      {rows !== null && list.length === 0 ? (
        <EmptyState icon={Inbox} title="No requests yet" message="When a buyer sends a pre-order or supply request, it shows here." />
      ) : (
        <>
          {waiting.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[14px] font-semibold text-[#16301F]">Waiting for your answer ({waiting.length})</h3>
              {waiting.map(renderCard)}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[14px] font-semibold text-[#16301F]">Answered</h3>
              {done.map(renderCard)}
            </div>
          )}
        </>
      )}
    </div>
  );
}