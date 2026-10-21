import { useCallback, useEffect, useState } from "react";
import { Handshake, Truck, Store, X, Sprout, Camera } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";
import MatchesTable from "../../components/MatchesTable.jsx";
import { PageHeader, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import { peso } from "../../components/SupplyCard.jsx";
import useMatchViewModel from "../../viewmodels/useMatchViewModel";
import { matchRepository } from "../../repositories/matchRepository";
import { MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../../models/match/Match";
import { getUserMessage } from "../../api/farmlinkApi.js";
import { matchOrderApi } from "../../api/matchOrderApi.js";
import { deliveryFee, feeText, DELIVERY_RATES } from "../../utils/deliveryFee.js";

const STEP_LABEL = {
  accepted: "Accepted",
  preparing: "Preparing",
  packed: "Packed",
  ready_pickup: "Ready for Pickup",
  collected: "Collected",
  completed: "Completed",
  ready_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

const grayBtn = "rounded-md bg-gray-100 px-3 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200";
const isExpected = (m) => m.supplyType === "expected";
const typeLabel = (m) => (isExpected(m) ? "Expected Harvest" : "On Hand");

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function defaultNeeded(m) {
  const n = m.neededDate ? String(m.neededDate).slice(0, 10) : "";
  return n && n >= todayStr() ? n : todayStr();
}

/* Photo at the left of each match: the private offer photo when one exists,
   otherwise the product listing photo. The API authorizes the matched buyer only. */
function MatchThumb({ m }) {
  const [photo, setPhoto] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setPhoto("");
    setFailed(false);
    if (m.hasPhoto) {
      matchOrderApi.photo(m.id)
        .then((d) => { if (alive && d?.image) setPhoto(d.image); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [m.id, m.hasPhoto]);

  const src = photo || m.image;
  return (
    <span
      className={"flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#E8F5E9] text-[#2E7D32] " + (photo ? "ring-2 ring-green-500" : "")}
      title={photo ? "Photo from the farmer" : undefined}
    >
      {src && !failed ? (
        <img src={src} alt={m.product} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <Sprout size={22} />
      )}
    </span>
  );
}

/* ---------- Details of a confirmed match (with the farmer's photo) + the pre-order form ---------- */
function MatchDetails({ m, onClose, onDone, onNavigate }) {
  const [form, setForm] = useState({
    fulfillment: "pickup",
    deliveryAddress: "",
    neededDate: defaultNeeded(m),
    notes: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [farmerPhoto, setFarmerPhoto] = useState("");

  // The product photo attached to the offer or saved for a general-supply match.
  useEffect(() => {
    let alive = true;
    if (m.hasPhoto) {
      matchOrderApi.photo(m.id)
        .then((d) => { if (alive && d?.image) setFarmerPhoto(d.image); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [m.id, m.hasPhoto]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fee = deliveryFee(m.quantity, form.fulfillment);
  const subtotal = Number(m.quantity) * Number(m.pricePerUnit || 0);
  const shownPhoto = farmerPhoto || m.image;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!form.neededDate) return setError("Select the date you need it.");
    if (form.neededDate < todayStr()) return setError("Date cannot be in the past.");
    if (form.fulfillment === "delivery" && form.deliveryAddress.trim().length < 5) return setError("Enter the delivery address.");
    setBusy(true);
    try {
      await matchOrderApi.preorder(m.id, {
        fulfillment: form.fulfillment,
        deliveryAddress: form.fulfillment === "delivery" ? form.deliveryAddress.trim() : "",
        neededDate: form.neededDate,
        notes: form.notes.trim(),
      });
      setSuccess(true);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ["Farmer", m.farmerName],
    ["Supply type", typeLabel(m)],
    ["Confirmed quantity", `${formatQty(m.quantity)} ${m.unit}`],
    ["Price", `${peso(m.pricePerUnit)} / ${m.unit}`],
    ["Products", peso(subtotal)],
    ["Location", m.location],
    [isExpected(m) ? "Expected harvest" : "Available from", isExpected(m) ? formatDate(m.availabilityDate) : "Available now"],
    ["You requested (total)", `${formatQty(m.requestedQuantity)} ${m.unit}`],
    ["You need it by", formatDate(m.neededDate)],
  ];

  const choice = (id, label, Icon) => (
    <button
      key={id}
      type="button"
      onClick={() => setForm((f) => ({ ...f, fulfillment: id }))}
      className={"flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-semibold " +
        (form.fulfillment === id ? "border-[#1B5E20] bg-[#1B5E20] text-white" : "border-gray-200 bg-white text-gray-700")}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Confirmed match"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="relative h-48 w-full overflow-hidden bg-[#E8F5E9]">
          {shownPhoto && !failed ? (
            <img src={shownPhoto} alt={m.product} onError={() => setFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#2E7D32]"><Sprout size={38} /></div>
          )}
          {farmerPhoto && (
            <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white">
              <Camera size={12} /> Photo from the farmer
            </span>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><X size={16} /></button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-bold text-[#16301F]">{m.product}</h3>
              {m.category && <p className="text-[12.5px] text-gray-500">{m.category}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-800">Farmer confirmed</span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{k}</dt>
                <dd className="break-words font-semibold text-[#16301F]">{v || "—"}</dd>
              </div>
            ))}
          </dl>

          <div className="h-px bg-black/5" />

          {success ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">
                Pre-ordered! The farmer was notified. Track every step in <b>My Pre Orders</b>.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className={grayBtn + " flex-1"}>Close</button>
                <button type="button" onClick={() => { onClose(); onNavigate?.("my-preorders"); }} className={primaryBtn + " flex-1"} style={primaryStyle}>
                  Open My Pre Orders
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3" noValidate>
              <Field label="Pick Up or Delivery" required>
                <div className="flex gap-2">
                  {choice("pickup", "Pick Up", Store)}
                  {choice("delivery", "Delivery", Truck)}
                </div>
                {form.fulfillment === "pickup" ? (
                  <p className="mt-2 text-[12px] text-gray-500">You collect the products at: <b>{m.location}</b></p>
                ) : (
                  <textarea rows={2} maxLength={200} value={form.deliveryAddress} onChange={up("deliveryAddress")}
                    className={inputCls + " mt-2"} placeholder="Delivery address (street, barangay, city)" />
                )}

                <div className="mt-2 rounded-xl bg-[#F1F8E9] p-3 text-[12.5px] text-[#33691E]">
                  {form.fulfillment === "delivery" ? (
                    <>
                      <p className="font-semibold">Delivery fee: {feeText(fee)}</p>
                      <p className="mt-1 text-[11.5px]">{DELIVERY_RATES.map(([a, b]) => `${a} = ${b}`).join(" · ")}</p>
                    </>
                  ) : (
                    <p className="font-semibold">Pick Up: Free</p>
                  )}
                  <p className="mt-1">
                    Products {peso(subtotal)} + Delivery {feeText(fee)} = <b>{peso(subtotal + fee)}</b>
                  </p>
                </div>
              </Field>

              <Field label="Date Needed" required>
                <input type="date" min={todayStr()} value={form.neededDate} onChange={up("neededDate")} className={inputCls} />
              </Field>
              <Field label="Message to Farmer (Optional)">
                <textarea rows={3} maxLength={300} value={form.notes} onChange={up("notes")} className={inputCls}
                  placeholder="Questions, special requests, etc." />
              </Field>
              {error && <p className="rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
              <button type="submit" disabled={busy} className={primaryBtn + " w-full"} style={primaryStyle}>
                {busy ? "Sending..." : "Pre-order"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- The page ---------- */
// Buyers cannot accept or decline (that is the farmer's job). A pending match can be
// cancelled. When the farmer confirms, View details shows the farmer's photo of the
// products and lets the buyer pre-order (Pick Up or Delivery), then track it in My Pre Orders.
export default function BuyerMatches({ onNavigate }) {
  const vm = useMatchViewModel(); // only used if the new list cannot be loaded
  const { load: loadVm } = vm;

  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(
    () => matchOrderApi.mine()
      .then((d) => { setRows(d.matches || []); setError(""); setFallback(false); })
      .catch((e) => { setError(e.message); setFallback(true); }),
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

  useEffect(() => {
    if (fallback) loadVm();
  }, [fallback, loadVm]);

  async function cancel(m) {
    if (busyId || !window.confirm(`Cancel the match for ${m.product}?`)) return;
    setBusyId(m.id);
    setActionError("");
    setNote("");
    try {
      await matchRepository.cancel(m.id);
      setNote("Match cancelled.");
    } catch (e) {
      setActionError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  // Old table, kept as a safety net if the new list cannot be read.
  if (fallback) {
    return (
      <div className="space-y-4">
        <Notice type="error">{error}</Notice>
        <LoadNote loading={vm.loading && vm.matches.length === 0} error="" />
        <Notice type="error">{vm.error}</Notice>
        <Notice type="success">{vm.success}</Notice>
        <MatchesTable
          rows={vm.matches}
          dateKey="availabilityDate"
          dateLabel="Available From"
          subtitle="Your requirements matched with farmers' supply. Farmers accept or decline each match. While a match is pending you can cancel it."
          onCancel={vm.cancel}
          busy={vm.submitting}
        />
      </div>
    );
  }

  const detail = detailId ? (rows || []).find((m) => m.id === detailId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matches"
        subtitle="Your requirements matched with farmers' supply. When a farmer confirms, tap View details to see the farmer's photo of the products, choose Pick Up or Delivery and pre-order. Track it in My Pre Orders."
      />
      <LoadNote loading={rows === null && !error} error="" />
      <Notice type="error">{actionError}</Notice>
      <Notice type="success">{note}</Notice>

      {rows !== null && rows.length === 0 ? (
        <EmptyState icon={Handshake} title="No matches yet" message="When your requirements match a farmer's supply, they show here." />
      ) : (
        <div className="space-y-3">
          {(rows || []).map((m) => {
            const confirmed = m.status === "confirmed";
            const pending = m.status === "pending_confirmation";
            return (
              <div key={m.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <MatchThumb m={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-bold text-[#16301F]">{m.product}</p>
                    <p className="text-[12.5px] text-gray-500">
                      {formatQty(m.quantity)} {m.unit} of your {formatQty(m.requestedQuantity)} {m.unit} · {m.farmerName}
                    </p>
                    <p className="text-[12.5px] text-gray-500">
                      <span className="font-semibold text-[#2E7D32]">{typeLabel(m)}</span> · {m.location}
                      {isExpected(m) && m.availabilityDate ? ` · harvest ${formatDate(m.availabilityDate)}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusBadge label={MATCH_STATUS_LABEL[m.status] || m.status} tone={MATCH_STATUS_TONE[m.status] || "gray"} />

                    {pending && (
                      <button type="button" disabled={busyId === m.id} onClick={() => cancel(m)} className={grayBtn + " disabled:opacity-60"}>
                        Cancel match
                      </button>
                    )}

                    {confirmed && m.hasPhoto && !m.order && (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-800">
                        <Camera size={12} /> Farmer's photo
                      </span>
                    )}

                    {confirmed && !m.order && (
                      <button
                        type="button"
                        onClick={() => setDetailId(m.id)}
                        className="rounded-md bg-[#1B5E20] px-3 py-2 text-[13px] font-semibold text-white hover:brightness-110"
                      >
                        View details
                      </button>
                    )}

                    {confirmed && m.order && (
                      <>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11.5px] font-semibold text-blue-800">
                          Pre-ordered · {STEP_LABEL[m.order.orderStatus] || "Accepted"}
                        </span>
                        <button type="button" onClick={() => onNavigate?.("my-preorders")} className={grayBtn}>
                          Track order
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && <MatchDetails m={detail} onClose={() => setDetailId(null)} onDone={load} onNavigate={onNavigate} />}
    </div>
  );
}