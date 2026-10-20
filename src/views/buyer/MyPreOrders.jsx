import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag, Truck, Store, Check, Sprout, Star, X, Camera } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";
import { Stars } from "../../components/ReviewsModal.jsx";
import { OrderThumb, useOrderPhoto } from "../../components/OrderPhoto.jsx";
import { PageHeader, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { Notice, formatDate, formatQty } from "../../components/FormBits.jsx";
import { peso } from "../../components/SupplyCard.jsx";
import { supplyApi } from "../../api/supplyApi.js";
import { orderPhotoApi } from "../../api/orderPhotoApi.js";
import { feeText } from "../../utils/deliveryFee.js";

const FILTERS = [
  ["all", "All orders"],
  ["waiting", "Waiting for farmer"],
  ["active", "In progress"],
  ["done", "Completed"],
  ["closed", "Declined / Cancelled"],
];

const isDone = (o) => o.status === "confirmed" && o.currentStep === o.steps.length - 1;

function stateOf(o) {
  if (o.status === "pending_confirmation") return { key: "waiting", label: "Waiting for farmer", cls: "bg-amber-100 text-amber-800" };
  if (o.status === "declined") return { key: "closed", label: "Declined", cls: "bg-red-100 text-red-700" };
  if (o.status === "cancelled") return { key: "closed", label: "Cancelled", cls: "bg-gray-100 text-gray-600" };
  const label = o.steps[o.currentStep]?.label || "Accepted";
  return isDone(o)
    ? { key: "done", label, cls: "bg-green-100 text-green-800" }
    : { key: "active", label, cls: "bg-blue-100 text-blue-800" };
}

export function Tracker({ o }) {
  return (
    <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {o.steps.map((s, i) => {
        const done = i <= o.currentStep;
        const current = i === o.currentStep;
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className={"flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold " +
              (done ? "bg-[#2E7D32] text-white" : "bg-gray-200 text-gray-500")}>
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className={"text-[12px] " + (current ? "font-bold text-[#16301F]" : done ? "text-[#2E7D32]" : "text-gray-400")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Details of a completed order: product, total, rate and message ---------- */
function OrderDetails({ o, hasPhoto, onClose, onRated }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const farmerPhoto = useOrderPhoto(o.id, hasPhoto);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const delivery = o.fulfillment === "delivery";
  const productsTotal = Number(o.quantity) * Number(o.pricePerUnit || 0);
  const label = (id) => o.steps.find((s) => s.id === id)?.label || id;
  const shownPhoto = farmerPhoto || o.image;

  const rows = [
    ["Farmer", o.farmerName],
    ["Quantity", `${formatQty(o.quantity)} ${o.unit}`],
    ["Price", `${peso(o.pricePerUnit)} / ${o.unit}`],
    ["Products", peso(productsTotal)],
    [delivery ? "Delivery fee" : "Pick Up", feeText(o.deliveryFee)],
    ["Total paid", peso(productsTotal + Number(o.deliveryFee || 0))],
    [delivery ? "Delivered to" : "Picked up at", delivery ? o.deliveryAddress : o.location],
    ["Ordered on", formatDate(o.createdAt)],
  ];

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (rating < 1) return setError("Tap the stars to choose a rating.");
    setBusy(true);
    try {
      await supplyApi.rateOrder(o.id, rating, message.trim());
      setNote("Thank you! Your rating was sent to the farmer.");
      await onRated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const shownStars = hover || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Order details"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="relative h-44 w-full overflow-hidden bg-[#E8F5E9]">
          {shownPhoto && !failed ? (
            <img src={shownPhoto} alt={o.product} onError={() => setFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#2E7D32]"><Sprout size={40} /></div>
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
              <h3 className="truncate text-[17px] font-bold text-[#16301F]">{o.product}</h3>
              {o.category && <p className="text-[12.5px] text-gray-500">{o.category}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-800">{o.steps[o.currentStep]?.label}</span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{k}</dt>
                <dd className="break-words font-semibold text-[#16301F]">{v || "—"}</dd>
              </div>
            ))}
          </dl>

          {o.history?.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="mb-1 text-[12px] font-semibold text-[#16301F]">Order history</p>
              <ul className="space-y-0.5">
                {o.history.map((h, i) => (
                  <li key={i} className="flex justify-between gap-2 text-[12px] text-gray-600">
                    <span>{label(h.status)}</span>
                    <span className="text-gray-400">{formatDate(h.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-black/5 pt-3">
            {o.review ? (
              <div>
                <p className="text-[13px] font-semibold text-[#16301F]">Your rating</p>
                <Stars value={o.review.rating} size={20} />
                {o.review.message ? (
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 p-2 text-[13px] text-gray-700">{o.review.message}</p>
                ) : (
                  <p className="mt-1 text-[12.5px] italic text-gray-400">No message</p>
                )}
                <Notice type="success">{note}</Notice>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3" noValidate>
                <p className="text-[13px] font-semibold text-[#16301F]">Rate this product</p>
                <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} aria-label={`${i} star${i > 1 ? "s" : ""}`}>
                      <Star size={30} className={shownStars >= i ? "text-amber-400" : "text-gray-300"} fill={shownStars >= i ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a message for the farmer and other buyers (optional)"
                  className={inputCls}
                />
                {error && <p className="rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
                <button type="submit" disabled={busy} className={primaryBtn + " w-full"} style={primaryStyle}>
                  {busy ? "Sending..." : "Submit rating"}
                </button>
              </form>
            )}
          </div>

          <button type="button" onClick={onClose} className="w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function MyPreOrders({ onNavigate }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [photoIds, setPhotoIds] = useState(() => new Set()); // orders that have the farmer's photo

  const load = useCallback(
    () => supplyApi.myOrders().then((d) => { setRows(d.orders || []); setError(""); }).catch((e) => setError(e.message)),
    []
  );
  const loadPhotos = useCallback(
    () => orderPhotoApi.mine().then((d) => setPhotoIds(new Set(d?.orders || []))).catch(() => {}),
    []
  );

  useEffect(() => {
    const all = () => { load(); loadPhotos(); };
    all();
    const t = setInterval(all, 10000);
    window.addEventListener("focus", all);
    return () => { clearInterval(t); window.removeEventListener("focus", all); };
  }, [load, loadPhotos]);

  const shown = useMemo(
    () => (rows || []).filter((o) => filter === "all" || stateOf(o).key === filter),
    [rows, filter]
  );
  const detail = detailId ? (rows || []).find((o) => o.id === detailId) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="My Pre Orders" subtitle="Track your pre-orders from the moment the farmer accepts until you receive your products. The farmer's photo of the products shows on the left." />
      <LoadNote loading={rows === null && !error} error={error} />

      <div className="max-w-xs">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputCls} aria-label="Filter by order status">
          {FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      {rows !== null && shown.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No pre-orders" message="Pre-order a product in Find Supply and it will show here." />
      ) : (
        <div className="space-y-4">
          {shown.map((o) => {
            const st = stateOf(o);
            const delivery = o.fulfillment === "delivery";
            const hasPhoto = photoIds.has(o.id);
            return (
              <div key={o.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <OrderThumb orderId={o.id} hasPhoto={hasPhoto} fallback={o.image} alt={o.product} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15.5px] font-bold text-[#16301F]">{o.product}</p>
                        <p className="text-[12.5px] text-gray-500">
                          {formatQty(o.quantity)} {o.unit} · {peso(o.pricePerUnit)} / {o.unit} · from {o.farmerName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {hasPhoto && (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-800">
                            <Camera size={12} /> Farmer's photo
                          </span>
                        )}
                        <span className={"rounded-full px-2.5 py-1 text-[11.5px] font-semibold " + st.cls}>{st.label}</span>
                        {isDone(o) && (
                          <button
                            type="button"
                            onClick={() => setDetailId(o.id)}
                            className="rounded-full bg-[#1B5E20] px-3 py-1 text-[11.5px] font-semibold text-white hover:brightness-110"
                          >
                            View details
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#16301F]">
                      {delivery ? <Truck size={14} className="text-[#2E7D32]" /> : <Store size={14} className="text-[#2E7D32]" />}
                      <b>{delivery ? `Delivery · ${feeText(o.deliveryFee)}` : "Pick Up · Free"}</b>
                      <span className="text-gray-500">· {delivery ? o.deliveryAddress : `at ${o.location}`}</span>
                    </p>
                    {o.notes && <p className="mt-1 rounded-lg bg-gray-50 p-2 text-[12.5px] text-gray-700">Your message: {o.notes}</p>}
                    {isDone(o) && (
                      <p className="mt-1 flex items-center gap-1.5 text-[12.5px]">
                        {o.review ? (
                          <><Stars value={o.review.rating} /> <span className="text-gray-500">You rated this product</span></>
                        ) : (
                          <button type="button" onClick={() => setDetailId(o.id)} className="font-semibold text-amber-700 hover:underline">
                            Rate this product
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {o.status === "confirmed" && <Tracker o={o} />}
                {o.status === "pending_confirmation" && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[12.5px] text-amber-800">
                    Your quantity is reserved. Waiting for the farmer to accept.{" "}
                    <button type="button" onClick={() => onNavigate?.("my-requests")} className="font-semibold underline">Cancel it in My Requests</button>
                  </p>
                )}
                {(o.status === "declined" || o.status === "cancelled") && (
                  <p className="mt-3 text-[12.5px] text-gray-500">This pre-order is closed. The quantity went back to the farmer's supply.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detail && <OrderDetails o={detail} hasPhoto={photoIds.has(detail.id)} onClose={() => setDetailId(null)} onRated={load} />}
    </div>
  );
}