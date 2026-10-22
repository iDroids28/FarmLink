import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, X, ChevronRight, Check } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import { ActionButton, Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import { useLoad, getUserMessage } from "../../api/farmlinkApi.js";
import { apiClient } from "../../services/api/apiClient";
import { matchRepository } from "../../repositories/matchRepository";
import { MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../../models/match/Match";
import { getLegacyRead, addLegacyRead } from "../../utils/legacyRead.js";

const time = (v) => (v ? new Date(v).getTime() || 0 : 0);
const kindLabel = (t) => (t === "expected" ? "Pre-order (expected harvest)" : "On-hand");
const tellBell = () => window.dispatchEvent(new Event("farmlink:notices-read"));

function MatchNoticeModal({ matchId, role, onClose, onChanged, onNavigate }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => matchRepository.getSummary(matchId).then((d) => setS(d)).catch((e) => setError(getUserMessage(e))),
    [matchId]
  );
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(fn, okText) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn(matchId);
      setNote(okText);
    } catch (e) {
      setError(getUserMessage(e));
    }
    await load();
    onChanged?.();
    setBusy(false);
  }

  const pending = s?.status === "pending_confirmation";
  const rows = s
    ? [
        ["Supply type", kindLabel(s.supplyType)],
        ["This match", `${formatQty(s.quantity)} ${s.unit} of ${s.product}`],
        ["Buyer requested (total)", `${formatQty(s.requestedQuantity)} ${s.unit}`],
        ["Confirmed", `${formatQty(s.confirmedQuantity)} ${s.unit}`],
        [s.isDemandOffer ? (role === "buyer" ? "Pending offer quantity" : "Offer awaiting buyer") : "Waiting for farmer", `${formatQty(s.pendingQuantity)} ${s.unit}`],
        ["Still needed after this match", `${formatQty(s.remainingQuantity)} ${s.unit}`],
        ["Needed by", formatDate(s.neededDate)],
        ["Available from", formatDate(s.availabilityDate)],
        ["Location", s.location],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Match"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15.5px] font-semibold text-[#16301F]">Match</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <Notice type="error">{error}</Notice>
          <Notice type="success">{note}</Notice>
        </div>

        {!s && !error && <p className="mt-4 text-[13px] text-gray-500">Loading…</p>}

        {s && (
          <div className="mt-3 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[18px] font-semibold text-[#16301F]">{s.product}</p>
              <StatusBadge label={MATCH_STATUS_LABEL[s.status] || s.status} tone={MATCH_STATUS_TONE[s.status] || "gray"} />
            </div>

            <dl className="space-y-2">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-500">{label}</dt>
                  <dd className="text-[13.5px] font-medium text-[#16301F]">{value || "—"}</dd>
                </div>
              ))}
            </dl>

            {pending && role === "farmer" && s.isDemandOffer && (
              <p className="rounded-xl bg-blue-50 p-3 text-[12.5px] text-blue-800">
                Your offer has been sent to the buyer. The buyer will review the product photo and decide whether to accept or decline. No action is needed from you yet.
              </p>
            )}

            {pending && role === "farmer" && !s.isDemandOffer && (
              <>
                <p className="rounded-xl bg-[#F1F8E9] p-3 text-[12.5px] text-[#33691E]">
                  If you accept, {formatQty(s.quantity)} {s.unit} is reserved for the buyer. If you decline, it goes back to the buyer's request.
                </p>
                <div className="flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">
                  <ActionButton variant="secondary" disabled={busy} onClick={() => act(matchRepository.decline, "Match declined.")}>
                    Decline
                  </ActionButton>
                  <ActionButton disabled={busy} onClick={() => act(matchRepository.confirm, "Match accepted.")}>
                    Accept
                  </ActionButton>
                </div>
              </>
            )}

            {pending && role === "buyer" && s.isDemandOffer && (
              <div className="space-y-3">
                <p className="rounded-xl bg-blue-50 p-3 text-[12.5px] text-blue-800">
                  A farmer submitted an offer for your demand. Open My Requests to review the product photo and choose Accept offer or Decline offer. Decisions for demand offers are only made there.
                </p>
                <div className="flex justify-end border-t border-black/5 pt-4">
                  <ActionButton onClick={() => { onClose(); onNavigate?.("my-requests"); }}>
                    Open My Requests <ChevronRight size={14} className="ml-1 inline" />
                  </ActionButton>
                </div>
              </div>
            )}

            {pending && role === "buyer" && !s.isDemandOffer && (
              <>
                <p className="rounded-xl bg-blue-50 p-3 text-[12.5px] text-blue-800">
                  Waiting for the farmer to accept or decline. You can cancel this match until the farmer answers.
                </p>
                <div className="flex justify-end border-t border-black/5 pt-4">
                  <ActionButton variant="secondary" disabled={busy} onClick={() => act(matchRepository.cancel, "Match cancelled.")}>
                    Cancel match
                  </ActionButton>
                </div>
              </>
            )}

            {!pending && (
              <p className="text-[12.5px] text-gray-500">
                {s.status === "confirmed" ? (s.isDemandOffer ? "You accepted this offer. Choose Pick Up or Delivery from Matches to finish the pre-order." : "This match is confirmed and pre-ordered.") : "This match is closed. No action is needed."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NoticeDetailModal({ n, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Notification"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15.5px] font-semibold text-[#16301F]">{n.title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-[12px] text-gray-500">{String(n.createdAt).slice(0, 10)}</p>
        <p className="mt-3 whitespace-pre-line text-[13.5px] text-[#16301F]">{n.message}</p>
        <div className="mt-5 flex justify-end">
          <ActionButton variant="secondary" onClick={onClose}>Close</ActionButton>
        </div>
      </div>
    </div>
  );
}

export default function Notifications({ user, intent, onNavigate }) {
  const role = user?.role;
  const uid = user?.id || user?._id;

  const legacy = useLoad("/notifications/mine");
  const [legacyRead, setLegacyRead] = useState(() => getLegacyRead(uid));

  const [fresh, setFresh] = useState(null);
  const [freshError, setFreshError] = useState("");
  const [openMatchId, setOpenMatchId] = useState(null);
  const [openNotice, setOpenNotice] = useState(null);

  const loadFresh = useCallback(
    () =>
      apiClient
        .get("/notifications/mine")
        .then((d) => setFresh(d?.notifications || []))
        .catch((err) => setFreshError(getUserMessage(err))),
    []
  );

  useEffect(() => {
    loadFresh();
    const timer = setInterval(loadFresh, 10000);
    return () => clearInterval(timer);
  }, [loadFresh]);

  useEffect(() => {
    if (typeof intent === "string" && intent.startsWith("match:")) {
      setOpenMatchId(intent.slice(6));
      onNavigate?.("notifications", null);
    }
  }, [intent, onNavigate]);

  const list = useMemo(() => {
    const old = (legacy.data?.notifications || []).map((n) => ({
      id: `old:${n.id}`, rawId: null, legacyId: String(n.id), title: n.title, message: n.message,
      createdAt: n.createdAt, matchId: null, requestId: null, type: "old",
      isNew: !legacyRead.has(String(n.id)),
    }));
    const added = (fresh || []).map((n) => ({
      id: `new:${n.id}`, rawId: n.id, legacyId: null, title: n.title, message: n.message,
      createdAt: n.createdAt, matchId: n.matchId || null, requestId: n.requestId || null, demandId: n.demandId || null,
      type: n.type, isNew: n.read === false,
    }));
    return [...old, ...added].sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }, [legacy.data, fresh, legacyRead]);

  const unreadCount = list.filter((n) => n.isNew).length;

  function markItemRead(n) {
    if (n.rawId) {
      setFresh((rows) => (rows || []).map((x) => (x.id === n.rawId ? { ...x, read: true } : x)));
      apiClient.post(`/notifications/${n.rawId}/read`).then(tellBell).catch(() => {});
    } else if (n.legacyId) {
      addLegacyRead(uid, [n.legacyId]);
      setLegacyRead(getLegacyRead(uid));
      tellBell();
    }
  }

  function markAllRead() {
    setFresh((rows) => (rows || []).map((n) => ({ ...n, read: true })));
    apiClient.post("/notifications/read-all").then(tellBell).catch(() => {});
    addLegacyRead(uid, (legacy.data?.notifications || []).map((n) => n.id));
    setLegacyRead(getLegacyRead(uid));
    tellBell();
  }

  const canOpenMatch = role === "farmer" || role === "buyer";
  const requestPage = role === "farmer" ? "requests" : "my-requests";

  function openItem(n) {
    if (n.isNew) markItemRead(n);
    if (n.demandId && role === "farmer") {
      onNavigate?.("business-requests");
      return;
    }
    if (n.requestId) {
      onNavigate?.(requestPage);
      return;
    }
    if (n.matchId && canOpenMatch) setOpenMatchId(n.matchId);
    else setOpenNotice(n);
  }

  const legacyLoading = legacy.loading && !legacy.data;
  const freshLoading = fresh === null && !freshError;
  const loading = legacyLoading || freshLoading;
  const error = legacy.error && freshError ? legacy.error : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification"
        subtitle="Open notifications for details. Offers farmers submit for your demands are accepted or declined from My Requests."
      />

      {unreadCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#16301F]">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
            unread
          </span>
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-200"
          >
            <Check size={14} /> Mark all as read
          </button>
        </div>
      )}

      <LoadNote loading={loading && list.length === 0} error={error} />
      {!loading && !error && list.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="You're all caught up." />
      ) : (
        <div className="space-y-3">
          {list.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className="block w-full rounded-2xl text-left transition hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
            >
              <GlassCard>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#16301F]">
                    {n.isNew && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" aria-label="Unread" />}
                    {n.title}
                  </h3>
                  <span className="shrink-0 text-[12px] text-gray-500">{String(n.createdAt).slice(0, 10)}</span>
                </div>
                <p className={"mt-1 text-[13px] " + (n.isNew ? "font-medium text-[#16301F]" : "text-gray-600")}>
                  {n.message}
                </p>
                <p className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-[#2E7D32]">
                  {n.demandId && role === "farmer"
                    ? "View Business Requests"
                    : n.requestId
                    ? role === "farmer" ? "View and respond" : "View request"
                    : n.matchId && canOpenMatch
                    ? role === "farmer" ? "View and respond" : "View match"
                    : "View details"}
                  <ChevronRight size={14} />
                </p>
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      {openMatchId && (
        <MatchNoticeModal matchId={openMatchId} role={role} onClose={() => setOpenMatchId(null)} onChanged={loadFresh} onNavigate={onNavigate} />
      )}
      {openNotice && <NoticeDetailModal n={openNotice} onClose={() => setOpenNotice(null)} />}
    </div>
  );
}