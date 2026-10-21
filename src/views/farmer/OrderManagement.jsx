import { useCallback, useEffect, useMemo, useState } from "react";
import { PackageCheck, Truck, Store, Camera } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";
import { Stars } from "../../components/ReviewsModal.jsx";
import { OrderThumb } from "../../components/OrderPhoto.jsx";
import { PageHeader, LoadNote, inputCls } from "../../components/DemoBits.jsx";
import { Notice, formatDate, formatQty } from "../../components/FormBits.jsx";
import { peso } from "../../components/SupplyCard.jsx";
import { supplyApi } from "../../api/supplyApi.js";
import { orderPhotoApi } from "../../api/orderPhotoApi.js";
import { feeText } from "../../utils/deliveryFee.js";
import { Tracker } from "../buyer/MyPreOrders.jsx";

const isDone = (o) => o.currentStep === o.steps.length - 1;

export default function OrderManagement({ onNavigate }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState({}); // orderId -> chosen next step
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState("active");
  const [photoIds, setPhotoIds] = useState(() => new Set()); // orders that have my photo of the products

  const load = useCallback(
    () => supplyApi.incomingOrders().then((d) => { setRows(d.orders || []); setError(""); }).catch((e) => setError(e.message)),
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
    () => (rows || []).filter((o) => (filter === "all" ? true : filter === "done" ? isDone(o) : !isDone(o))),
    [rows, filter]
  );

  async function update(o) {
    const status = pick[o.id];
    if (!status || busy) return;
    setBusy(o.id); setError(""); setNote("");
    try {
      await supplyApi.setOrderStatus(o.id, status);
      const label = o.steps.find((s) => s.id === status)?.label || status;
      setNote(`${o.product}: ${label}. The buyer was notified.`);
      setPick((p) => ({ ...p, [o.id]: "" }));
    } catch (e) { setError(e.message); }
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Order Management" subtitle="Orders you accepted. Move each order through its steps and the buyer is notified every time. The photo you attached to the match shows on the left." />
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xs flex-1">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputCls} aria-label="Filter orders">
            <option value="active">In progress</option>
            <option value="done">Completed</option>
            <option value="all">All orders</option>
          </select>
        </div>
        <button type="button" onClick={() => onNavigate?.("requests")} className="text-[13px] font-semibold text-[#2E7D32] hover:underline">
          New pre-orders waiting? Open Requests
        </button>
      </div>

      {rows !== null && shown.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No orders here" message="Accept a pre-order in Requests and it will appear here." />
      ) : (
        <div className="space-y-4">
          {shown.map((o) => {
            const delivery = o.fulfillment === "delivery";
            const next = o.steps.slice(o.currentStep + 1);
            const productsTotal = Number(o.quantity) * Number(o.pricePerUnit || 0);
            const hasPhoto = photoIds.has(o.id);
            return (
              <div key={o.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <OrderThumb orderId={o.id} hasPhoto={hasPhoto} fallback={o.image} alt={o.product} tip="Photo you sent to the buyer" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15.5px] font-bold text-[#16301F]">{o.product}</p>
                        <p className="text-[12.5px] text-gray-500">
                          {formatQty(o.quantity)} {o.unit} · {peso(o.pricePerUnit)} / {o.unit} · buyer {o.buyerName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {hasPhoto && (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-800">
                            <Camera size={12} /> Photo you sent
                          </span>
                        )}
                        <span className={"rounded-full px-2.5 py-1 text-[11.5px] font-semibold " + (isDone(o) ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>
                          {o.steps[o.currentStep]?.label || "Accepted"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#16301F]">
                      {delivery ? <Truck size={14} className="text-[#2E7D32]" /> : <Store size={14} className="text-[#2E7D32]" />}
                      <b>{delivery ? "Delivery" : "Pick Up"}</b>
                      <span className="text-gray-500">· {delivery ? o.deliveryAddress : `buyer collects at ${o.location}`}</span>
                    </p>
                    <p className="text-[12.5px] text-gray-600">
                      Products {peso(productsTotal)} · {delivery ? `Delivery fee ${feeText(o.deliveryFee)}` : "Pick Up free"} ·{" "}
                      <b className="text-[#16301F]">Total {peso(productsTotal + Number(o.deliveryFee || 0))}</b>
                    </p>
                    <p className="text-[12.5px] text-gray-500">Needed by {formatDate(o.neededDate)}</p>
                    {o.notes && <p className="mt-1 rounded-lg bg-gray-50 p-2 text-[12.5px] text-gray-700">Buyer's message: {o.notes}</p>}
                  </div>
                </div>

                <Tracker o={o} />

                {isDone(o) ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12.5px] font-semibold text-green-700">This order is {delivery ? "delivered" : "completed"}.</p>
                    {o.review && (
                      <div className="rounded-xl bg-amber-50 p-3">
                        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#16301F]">
                          {o.buyerName} rated the product <Stars value={o.review.rating} />
                        </p>
                        {o.review.message && <p className="mt-1 whitespace-pre-line text-[12.5px] text-gray-700">{o.review.message}</p>}
                      </div>
                    )}
                    {o.farmerReview && (
                      <div className="rounded-xl bg-green-50 p-3">
                        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#16301F]">
                          {o.buyerName} rated your farmer profile <Stars value={o.farmerReview.rating} />
                        </p>
                        {o.farmerReview.message && <p className="mt-1 whitespace-pre-line text-[12.5px] text-gray-700">{o.farmerReview.message}</p>}
                      </div>
                    )}
                    {!o.review && !o.farmerReview && <p className="text-[12px] text-gray-400">The buyer has not submitted ratings yet.</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                    <select
                      value={pick[o.id] || ""}
                      onChange={(e) => setPick((p) => ({ ...p, [o.id]: e.target.value }))}
                      className={inputCls + " !w-auto min-w-[220px]"}
                      aria-label="Order status"
                    >
                      <option value="">Update order status…</option>
                      {next.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={!pick[o.id] || busy === o.id}
                      onClick={() => update(o)}
                      className="rounded-lg bg-[#1B5E20] px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      {busy === o.id ? "Saving..." : pick[o.id] === "ready_pickup" ? "Update & notify buyer" : "Update status"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}