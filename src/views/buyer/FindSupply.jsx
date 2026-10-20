import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, X, PackageSearch, Sprout, CalendarDays, Package, MapPin, Truck, Store } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";
import { peso } from "../../components/SupplyCard.jsx";
import SupplyFarmerModal from "../../components/SupplyFarmerModal.jsx";
import ReviewsModal, { Stars } from "../../components/ReviewsModal.jsx";
import { PageHeader, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { formatDate, formatQty } from "../../components/FormBits.jsx";
import { supplyApi } from "../../api/supplyApi.js";
import { deliveryFee, feeText, DELIVERY_RATES } from "../../utils/deliveryFee.js";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const isExpected = (s) => s.supplyType === "expected";
const typeLabel = (s) => (isExpected(s) ? "Expected Harvest" : "On Hand");
const inStock = (s) => Number(s.availableQuantity) > 0;
const grayBtn = "rounded-md bg-gray-100 px-3 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200";

/* ---------- Product photo with stock badge ---------- */
function Photo({ src, alt, s }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const ok = inStock(s);
  return (
    <div className="relative h-44 w-full overflow-hidden bg-[#E8F5E9]">
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} className={"h-full w-full object-cover " + (ok ? "" : "opacity-60")} />
      ) : (
        <div className="flex h-full items-center justify-center text-[#2E7D32]"><Sprout size={40} /></div>
      )}
      <span className={"absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold " + (ok ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
        {ok ? `Available · ${formatQty(s.availableQuantity)} ${s.unit}` : "Out of Stock"}
      </span>
    </div>
  );
}

/* ---------- One product card ---------- */
function ProductCard({ s, onProfile, onOrder, onReviews }) {
  const expected = isExpected(s);
  const ok = inStock(s);
  const count = s.rating?.count || 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <Photo src={s.image} alt={s.product} s={s} />
      <div className="p-3.5">
        <button type="button" onClick={onProfile} className="flex w-full items-center gap-2 text-left" aria-label={`View farmer ${s.farmerName}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F5E9] text-[12px] font-bold text-[#2E7D32]">
            {(s.farmerName || "F").trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold text-[#16301F]">{s.farmerName || "Farmer"}</span>
            <span className="block text-[11px] text-gray-500">Farmer · tap to view</span>
          </span>
        </button>

        <h3 className="mt-2.5 truncate text-[15.5px] font-bold text-[#16301F]">{s.product}</h3>
        {s.category && <p className="text-[12px] text-gray-500">{s.category}</p>}
        <button type="button" onClick={onReviews} className="mt-1 flex items-center gap-1.5 text-left text-[12px] text-gray-600 hover:underline" title="See ratings and messages from buyers">
          <Stars value={s.rating?.avg} />
          <span>{count > 0 ? `${s.rating.avg} (${count})` : "No ratings yet"}</span>
        </button>
        <p className="mt-1.5 text-[15.5px] font-bold text-[#16301F]">
          {peso(s.pricePerUnit)} <span className="text-[12.5px] font-semibold text-gray-600">/ {s.unit}</span>
        </p>

        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
          <div>
            {expected ? <CalendarDays size={13} className="mb-0.5 text-[#2E7D32]" /> : <Package size={13} className="mb-0.5 text-[#2E7D32]" />}
            {typeLabel(s)}
            <p className="text-[12px] font-semibold text-[#16301F]">
              {expected ? formatDate(s.availabilityDate) : `${formatQty(s.availableQuantity)} ${s.unit}`}
            </p>
          </div>
          <div>
            <MapPin size={13} className="mb-0.5 text-[#2E7D32]" />Location
            <p className="text-[12px] font-semibold text-[#16301F]">{s.location}</p>
          </div>
        </div>

        {s.description && <p className="mt-2 line-clamp-2 text-[12px] text-gray-600">{s.description}</p>}

        <button
          type="button"
          onClick={onOrder}
          disabled={!ok}
          className={primaryBtn + " mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"}
          style={ok ? primaryStyle : { background: "#9CA3AF" }}
        >
          {ok ? "Pre-order" : "Out of Stock"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Pre-order form pop-up (Pick Up or Delivery, with fee) ---------- */
function OrderModal({ supply, onClose, onDone, onNavigate }) {
  const [form, setForm] = useState({ quantity: "", neededDate: "", notes: "", fulfillment: "pickup", deliveryAddress: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const max = Number(supply.availableQuantity ?? 0);
  const half = Math.round((max / 2) * 100) / 100;
  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const qtyNum = Number(form.quantity);
  const fee = deliveryFee(qtyNum, form.fulfillment);
  const subtotal = qtyNum > 0 ? qtyNum * Number(supply.pricePerUnit || 0) : 0;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return setError("Enter a quantity greater than 0.");
    if (qty > max) return setError(`Only ${formatQty(max)} ${supply.unit} is available.`);
    if (!form.neededDate) return setError("Select the date you need it.");
    if (form.neededDate < todayStr()) return setError("Date cannot be in the past.");
    if (form.fulfillment === "delivery" && form.deliveryAddress.trim().length < 5) return setError("Enter the delivery address.");
    setBusy(true);
    try {
      await supplyApi.createOrder({
        supplyId: supply.id,
        quantity: qty,
        neededDate: form.neededDate,
        notes: form.notes.trim(),
        fulfillment: form.fulfillment,
        deliveryAddress: form.fulfillment === "delivery" ? form.deliveryAddress.trim() : "",
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
    ["Type", typeLabel(supply)],
    ["Available", `${formatQty(max)} ${supply.unit}`],
    ["Price", `${peso(supply.pricePerUnit)} / ${supply.unit}`],
    ["Location", supply.location],
    [isExpected(supply) ? "Expected harvest" : "Available since", formatDate(supply.availabilityDate)],
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
      role="dialog" aria-modal="true" aria-label="Pre-order"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold text-[#16301F]">Pre-order: {supply.product}</h3>
            <p className="text-[12.5px] text-gray-500">{typeLabel(supply)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-semibold text-[#16301F]">{v || "—"}</dd>
            </div>
          ))}
        </dl>

        <div className="my-4 h-px bg-black/5" />

        {success ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">
              Submitted! Your quantity is reserved and the farmer was notified. When the farmer accepts, you can track it in <b>My Pre Orders</b>.
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
            <Field label={`Quantity (${supply.unit})`} required>
              <input
                type="number" min="0" max={max} step="any"
                value={form.quantity} onChange={up("quantity")}
                placeholder={`Up to ${formatQty(max)}`} className={inputCls}
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, quantity: String(half) }))}
                  className="rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-200">
                  Half ({formatQty(half)})
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, quantity: String(max) }))}
                  className="rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-200">
                  All ({formatQty(max)})
                </button>
              </div>
            </Field>

            <Field label="Pick Up or Delivery" required>
              <div className="flex gap-2">
                {choice("pickup", "Pick Up", Store)}
                {choice("delivery", "Delivery", Truck)}
              </div>
              {form.fulfillment === "pickup" ? (
                <p className="mt-2 text-[12px] text-gray-500">You collect the products at: <b>{supply.location}</b></p>
              ) : (
                <textarea rows={2} maxLength={200} value={form.deliveryAddress} onChange={up("deliveryAddress")}
                  className={inputCls + " mt-2"} placeholder="Delivery address (street, barangay, city)" />
              )}

              <div className="mt-2 rounded-xl bg-[#F1F8E9] p-3 text-[12.5px] text-[#33691E]">
                {form.fulfillment === "delivery" ? (
                  <>
                    <p className="font-semibold">Delivery fee: {qtyNum > 0 ? feeText(fee) : "enter the quantity"}</p>
                    <p className="mt-1 text-[11.5px]">{DELIVERY_RATES.map(([a, b]) => `${a} = ${b}`).join(" · ")}</p>
                  </>
                ) : (
                  <p className="font-semibold">Pick Up: Free</p>
                )}
                {qtyNum > 0 && (
                  <p className="mt-1">
                    Products {peso(subtotal)} + Delivery {feeText(fee)} = <b>{peso(subtotal + fee)}</b>
                  </p>
                )}
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
              {busy ? "Sending..." : "Submit Pre-order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- The page ---------- */
export default function FindSupply({ onNavigate }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [order, setOrder] = useState(null);
  const [profileFor, setProfileFor] = useState(null);
  const [reviewsFor, setReviewsFor] = useState(null);

  const load = useCallback(
    () => supplyApi.available()
      .then((d) => { setItems(d.supplies || []); setError(""); })
      .catch((e) => setError(e.message)),
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items || []).filter(
      (s) =>
        (type === "all" || s.supplyType === type) &&
        (!needle || `${s.product} ${s.category || ""} ${s.location} ${s.farmerName || ""}`.toLowerCase().includes(needle))
    );
  }, [items, q, type]);

  const TYPES = [["all", "All"], ["onhand", "On Hand"], ["expected", "Expected Harvest"]];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Supply"
        subtitle="Discover fresh and local agricultural products from verified farmers. Tap the farmer to see who they are, then Pre-order."
      />
      <LoadNote loading={items === null && !error} error={error} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, farmer, or location..." className={inputCls + " !pl-9"} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setType(id)}
              className={"rounded-full px-3 py-1 text-[12px] font-medium " + (type === id ? "bg-[#2E7D32] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {items !== null && shown.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No supply found" message="No approved product matches your search yet. Try another search." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <ProductCard key={s.id} s={s} onProfile={() => setProfileFor(s)} onOrder={() => setOrder(s)} onReviews={() => setReviewsFor(s)} />
          ))}
        </div>
      )}

      {profileFor && (
        <SupplyFarmerModal
          supply={profileFor}
          onClose={() => setProfileFor(null)}
          onOrder={(product) => { setProfileFor(null); setOrder(product); }}
        />
      )}
      {reviewsFor && <ReviewsModal supply={reviewsFor} onClose={() => setReviewsFor(null)} />}
      {order && <OrderModal supply={order} onClose={() => setOrder(null)} onDone={load} onNavigate={onNavigate} />}
    </div>
  );
}