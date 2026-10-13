import { useState, useMemo, useEffect } from "react";
import { Search, MapPin, X, PackageSearch, Sprout } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../../api/farmlinkApi.js";

const CATS = ["All", "Vegetables", "Fruits", "Grains", "Root Crops", "Livestock & Poultry", "Others"];
const HIDDEN_STATUS = ["Removed", "Sold Out", "Closed", "Inactive"];
const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SupplyDetails({ supply, isMine, onClose, onDone }) {
  const [form, setForm] = useState({ quantity: "", neededDate: "", notes: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const qty = Number(form.quantity);
  const total = Number.isFinite(qty) && qty > 0 ? qty * supply.price : 0;

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a whole number quantity.");
    if (qty > supply.quantity) return setError(`Only ${supply.quantity} ${supply.unit} available.`);
    if (!form.neededDate) return setError("Select the date you need it.");
    if (form.neededDate < todayStr()) return setError("Date cannot be in the past.");

    setBusy(true);
    api
      .post("/preorders", {
        supplyId: supply.id,
        quantity: qty,
        neededDate: form.neededDate,
        notes: form.notes.trim(),
      })
      .then(() => { setSuccess(true); onDone?.(); })
      .catch((err) => setError(getUserMessage(err)))
      .finally(() => setBusy(false));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Supply details"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold text-[#16301F]">{supply.product}</h3>
            <p className="text-[12.5px] text-gray-500">{supply.category}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-gray-500">Price</dt><dd className="font-semibold text-[#16301F]">{peso(supply.price)} / {supply.unit}</dd>
          <dt className="text-gray-500">Available</dt><dd className="font-semibold text-[#16301F]">{supply.quantity} {supply.unit}</dd>
          <dt className="text-gray-500">Farmer</dt><dd className="font-semibold text-[#16301F]">{supply.farmerName}</dd>
          <dt className="text-gray-500">Location</dt><dd className="font-semibold text-[#16301F]">{supply.location}</dd>
          <dt className="text-gray-500">Ready on</dt><dd className="font-semibold text-[#16301F]">{supply.availableDate}</dd>
        </dl>
        {supply.description && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-[13px] text-gray-600">{supply.description}</p>}

        <div className="my-4 h-px bg-black/5" />

        {isMine ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">
              This is your own product. Other buyers can pre-order it here. You can manage it in <b>My Supply</b>.
            </p>
            <button type="button" onClick={onClose} className={primaryBtn + " w-full"} style={primaryStyle}>Close</button>
          </div>
        ) : success ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">
              Pre-order sent! The farmer will review it. Track it in <b>My Request</b>.
            </p>
            <button type="button" onClick={onClose} className={primaryBtn + " w-full"} style={primaryStyle}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <h4 className="text-[14px] font-semibold text-[#16301F]">Pre-order this product</h4>
            <Field label={`Quantity (${supply.unit})`} required>
              <input type="number" min="1" max={supply.quantity} step="1" value={form.quantity} onChange={up("quantity")} placeholder="Enter quantity" className={inputCls} />
            </Field>
            <Field label="Date Needed" required>
              <input type="date" min={todayStr()} value={form.neededDate} onChange={up("neededDate")} className={inputCls} />
            </Field>
            <Field label="Note to Farmer (Optional)">
              <textarea rows={2} maxLength={300} value={form.notes} onChange={up("notes")} className={inputCls} placeholder="Delivery or pickup details" />
            </Field>
            <p className="text-[13px] text-gray-600">Estimated total: <b className="text-[#16301F]">{peso(total)}</b></p>
            {error && <p className="rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn + " w-full"} style={primaryStyle}>
              {busy ? "Sending..." : "Send Pre-order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function FindSupply({ user }) {
  const avail = useLoad("/supplies/available");
  // Approved farmers also load their own products, so what they post in
  // My Supply always shows here even if the server list leaves them out.
  const own = useLoad("/supplies/mine");
  const isFarmer = user?.role === "farmer";
  const { loading, error } = avail;
  const reloadAvail = avail.reload;
  const reloadOwn = own.reload;

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [selected, setSelected] = useState(null);

  // Refresh every 15 seconds so newly posted products appear without a page refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      reloadAvail();
      if (isFarmer) reloadOwn();
    }, 15000);
    return () => clearInterval(timer);
  }, [reloadAvail, reloadOwn, isFarmer]);

  const isMine = (s) => !!s.mine || (user?.id != null && s.farmerId != null && String(s.farmerId) === String(user.id));

  // All products from all farmers, plus (for farmers) their own posts.
  const supplies = useMemo(() => {
    const list = [...(avail.data?.supplies || [])];
    if (isFarmer) {
      const ids = new Set(list.map((s) => String(s.id)));
      for (const s of own.data?.supplies || []) {
        const visible = !HIDDEN_STATUS.includes(s.status) && Number(s.quantity) > 0;
        if (visible && !ids.has(String(s.id))) {
          list.push({ ...s, mine: true, farmerName: s.farmerName || user?.name || "You" });
        }
      }
    }
    return list;
  }, [avail.data, own.data, isFarmer, user?.name]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return supplies.filter(
      (s) =>
        (cat === "All" || s.category === cat) &&
        (!needle || `${s.product} ${s.farmerName} ${s.location}`.toLowerCase().includes(needle))
    );
  }, [supplies, q, cat]);

  function refreshAll() {
    reloadAvail();
    if (isFarmer) reloadOwn();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Find Supply" subtitle="Browse all products posted by farmers. Open one to see details and pre-order." />
      <LoadNote loading={loading && !avail.data} error={error} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, farmer or location" className={inputCls + " !pl-9"} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)}
              className={"rounded-full px-3 py-1 text-[12px] font-medium " + (cat === c ? "bg-[#2E7D32] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {!loading && shown.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No supply found" message="No farmer has posted a matching product yet. Try another search." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <GlassCard key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15.5px] font-semibold text-[#16301F]">{s.product}</h3>
                  <p className="text-[12px] text-gray-500">{s.category}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]"><Sprout size={17} /></span>
              </div>
              <p className="mt-3 text-[20px] font-bold text-[#2E7D32]">{peso(s.price)} <span className="text-[12px] font-medium text-gray-500">/ {s.unit}</span></p>
              <p className="mt-1 text-[13px] text-gray-600">{s.quantity} {s.unit} available</p>
              <p className="mt-1 flex items-center gap-1 text-[12.5px] text-gray-500"><MapPin size={13} /> {s.location}</p>
              <p className="mt-1 text-[12.5px] text-gray-500">
                by {s.farmerName}
                {isMine(s) && <span className="ml-2 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[11px] font-semibold text-[#2E7D32]">Your product</span>}
              </p>
              <button type="button" onClick={() => setSelected(s)} className={primaryBtn + " mt-4 w-full"} style={primaryStyle}>
                View Details
              </button>
            </GlassCard>
          ))}
        </div>
      )}

      {selected && (
        <SupplyDetails
          supply={selected}
          isMine={isMine(selected)}
          onClose={() => setSelected(null)}
          onDone={refreshAll}
        />
      )}
    </div>
  );
}