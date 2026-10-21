import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Pencil, Eye, UploadCloud, X, Info, Trash2, Sprout, CheckCircle2, CalendarDays, MapPin, Package, Save, Star, ZoomIn } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";
import { LoadNote, inputCls } from "../../components/DemoBits.jsx";
import { Notice, formatDate, formatQty } from "../../components/FormBits.jsx";
import { Avatar, CategoryLine, Pagination, peso } from "../../components/SupplyCard.jsx";
import LocationPicker from "../../components/LocationPicker.jsx";
import ReviewsModal, { Stars } from "../../components/ReviewsModal.jsx";
import { supplyApi, fileToDataUrl } from "../../api/supplyApi.js";

const CATEGORIES = [
  "Vegetables", "Fruits", "Rice", "Corn & Grains", "Root Crops", "Legumes & Beans",
  "Herbs & Spices", "Mushrooms", "Coconut Products", "Coffee & Cacao", "Sugarcane",
  "Dairy & Milk", "Eggs", "Livestock", "Poultry", "Meat", "Fish & Seafood",
  "Honey & Bee Products", "Seeds & Seedlings", "Flowers & Ornamental Plants",
  "Fiber Crops", "Farm By-products", "Other Farm Products",
];
const UNITS = ["kg", "ton", "sack", "crate", "piece", "bundle", "ml", "liter", "gal", "bottle", "tray", "dozen"];
const EMPTY = { product: "", category: "", pricePerUnit: "", unit: "kg", supplyType: "onhand", quantity: "", location: "", availabilityDate: "", expiresAt: "", description: "", image: "" };
const PAGE_SIZE = 8;

// Pending (amber), Available with count (green), Out of Stock (red), Rejected (red).
function stockInfo(s) {
  const a = s.approvalStatus || "approved";
  const expiryKey = s.expiresAt ? dateKeyForSupply(s.expiresAt) : (s.createdAt ? addDaysISO(dateKeyForSupply(s.createdAt), 4) : "");
  if (s.status === "expired" || (s.supplyType === "onhand" && expiryKey && expiryKey < todayLocal() && Number(s.reservedQuantity || 0) <= 0)) {
    return { key: "expired", label: "Expired", cls: "bg-gray-100 text-gray-700" };
  }
  if (a === "pending") return { key: "pending", label: "Pending approval", cls: "bg-amber-100 text-amber-800" };
  if (a === "rejected") return { key: "rejected", label: "Rejected", cls: "bg-red-100 text-red-700" };
  if (Number(s.availableQuantity) > 0) {
    return { key: "available", label: `Available · ${formatQty(s.availableQuantity)} ${s.unit}`, cls: "bg-green-100 text-green-800" };
  }
  return { key: "out", label: "Out of Stock", cls: "bg-red-100 text-red-700" };
}

// Today's date on the farmer's own device (not UTC), as YYYY-MM-DD.
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateKeyForSupply(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}
function addDaysISO(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function Label({ children, required }) {
  return <label className="mb-1 block text-[12.5px] font-semibold text-[#16301F]">{children}{required && <span className="text-red-500"> *</span>}</label>;
}
function Title({ children, sub }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[22px] font-bold text-[#16301F]"><Sprout size={22} className="text-[#2E7D32]" /> {children}</h2>
      <p className="text-[12.5px] text-gray-500">{sub}</p>
    </div>
  );
}

function Photo({ src, alt, children, onDoubleClick }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <div
      className={"relative h-40 w-full overflow-hidden bg-[#E8F5E9] " + (src ? "cursor-zoom-in" : "")}
      onDoubleClick={src ? onDoubleClick : undefined}
      title={src ? "Double-click to enlarge the product image" : undefined}
    >
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[#2E7D32]"><Sprout size={40} /></div>
      )}
      {src && <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white"><ZoomIn size={12} /> Double-click to zoom</div>}
      {children}
    </div>
  );
}

function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [src, onClose]);
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Product image preview" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button type="button" onClick={onClose} aria-label="Close image preview" className="absolute right-4 top-4 rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25"><X size={22} /></button>
      <img src={src} alt={alt || "Enlarged product"} className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" />
    </div>
  );
}

// Clickable rating on the right of the farmer's name: opens every buyer's message.
function RatingChip({ rating, onClick }) {
  const n = rating?.count || 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title="See ratings and messages from buyers"
      className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-100"
    >
      <Star size={13} fill="currentColor" /> {n > 0 ? `${rating.avg} (${n})` : "No ratings"}
    </button>
  );
}

/* ---------------- Add / Edit product page ---------------- */
function ProductForm({ initial, onBack, onSaved }) {
  const editing = Boolean(initial?.id);
  const [f, setF] = useState(() => {
    const today = todayLocal();
    const maxExpiry = addDaysISO(today, 4);
    const storedExpiry = dateInputValue(initial?.expiresAt);
    const expiresAt = storedExpiry && storedExpiry >= today && storedExpiry <= maxExpiry ? storedExpiry : maxExpiry;
    return initial ? {
      product: initial.product || "", category: CATEGORIES.includes(initial.category) ? initial.category : "", pricePerUnit: String(initial.pricePerUnit ?? ""),
      unit: UNITS.includes(initial.unit) ? initial.unit : "kg", supplyType: initial.supplyType || "onhand", quantity: String(initial.quantity ?? ""),
      location: initial.location || "", availabilityDate: dateInputValue(initial.availabilityDate), expiresAt,
      description: initial.description || "", image: initial.image || "",
    } : { ...EMPTY, expiresAt };
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoomImage, setZoomImage] = useState("");
  const fileRef = useRef(null);
  const expected = f.supplyType === "expected";
  const today = todayLocal();
  const maxOnHandExpiry = addDaysISO(today, 4);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function pick(file) {
    if (!file) return;
    try { setError(""); const url = await fileToDataUrl(file); setF((x) => ({ ...x, image: url })); }
    catch (e) { setError(e.message); }
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!/^\p{L}{2,60}$/u.test(f.product)) return setError("Product name must contain letters only, with no spaces, numbers, or symbols.");
    if (!CATEGORIES.includes(f.category)) return setError("Select a valid farm-product category.");
    if (!(Number(f.pricePerUnit) > 0)) return setError("Enter a price greater than 0.");
    if (!Number.isFinite(Number(f.quantity)) || Number(f.quantity) < 10) return setError(`Minimum quantity is 10 ${f.unit}.`);
    if (!UNITS.includes(f.unit)) return setError("Select a valid unit.");
    if (!f.location) return setError("Select a location.");
    if (expected && (!f.availabilityDate || f.availabilityDate < today)) return setError("Select a harvest date (today or later).");
    if (!expected && (!f.expiresAt || f.expiresAt < today || f.expiresAt > maxOnHandExpiry)) return setError("Choose an expiry date from today up to 4 days from today.");
    if (!f.image) return setError("Upload a product image.");
    setBusy(true);
    try {
      const body = { ...f, availabilityDate: expected ? f.availabilityDate : today, expiresAt: expected ? "" : f.expiresAt, image: f.image === initial?.image ? undefined : f.image };
      if (editing) await supplyApi.update(initial.id, body); else await supplyApi.create(body);
      onSaved(editing ? "Product updated. It is waiting for admin approval again." : "Product uploaded. It is Pending approval and will appear to buyers once the admin approves it.");
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function remove() {
    if (busy || !window.confirm(`Delete ${initial.product}? This cannot be undone.`)) return;
    setError("");
    setBusy(true);
    try {
      await supplyApi.cancel(initial.id);
      onSaved("Product deleted.");
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#D8E8D4] bg-gradient-to-r from-[#F2FAF0] to-white px-5 py-4 shadow-sm sm:px-6">
        <Title sub="Share fresh, quality farm products with buyers. Keep the product name simple and the quantity and expiry accurate.">{editing ? "Edit Product" : "Add Product"}</Title>
      </div>

      <form onSubmit={submit} noValidate className="rounded-2xl border border-[#E0EAE0] bg-white p-5 shadow-[0_10px_30px_rgba(22,48,31,0.05)] sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold text-[#16301F]">Product Information</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label required>Product Name</Label><input value={f.product} onChange={(e) => setF((x) => ({ ...x, product: e.target.value.replace(/[^\p{L}]/gu, "").slice(0, 60) }))} maxLength={60} autoComplete="off" placeholder="e.g. Mango" className={inputCls} aria-describedby="product-name-help" /><p id="product-name-help" className="mt-1 text-[11px] text-gray-500">Letters only. Spaces, numbers, and symbols are not allowed.</p></div>
              <div><Label required>Category</Label>
                <select value={f.category} onChange={set("category")} className={inputCls}><option value="">Select category</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><Label required>Price per Unit</Label>
                <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
                  <span className="text-[14px] text-gray-500">₱</span>
                  <input type="number" min="0" step="any" value={f.pricePerUnit} onChange={set("pricePerUnit")} placeholder="0.00" className="w-full bg-transparent px-2 py-2.5 text-[14px] outline-none" />
                </div></div>
              <div><Label required>Unit / Price Basis</Label>
                <select value={f.unit} onChange={set("unit")} className={inputCls}>{UNITS.map((u) => <option key={u} value={u}>per {u}</option>)}</select></div>
            </div>

            <div><Label required>Supply Type</Label>
              <div className="flex gap-2">
                {[["onhand", "On Hand", CheckCircle2], ["expected", "Expected Harvest", Sprout]].map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setF((x) => ({ ...x, supplyType: id, expiresAt: id === "onhand" ? (x.expiresAt && x.expiresAt >= today && x.expiresAt <= maxOnHandExpiry ? x.expiresAt : maxOnHandExpiry) : x.expiresAt }))}
                    className={"flex items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-semibold transition " + (f.supplyType === id ? "border-[#1B5E20] bg-[#1B5E20] text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-[#9CC89A]")}>
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label required>Quantity</Label>
                <div className="flex gap-2">
                  <input type="number" min="10" step="any" value={f.quantity} onChange={set("quantity")} placeholder="Minimum 10" className={inputCls} />
                  <span className="inline-flex min-w-20 items-center justify-center rounded-xl border border-[#DCE8D8] bg-[#F4F9F2] px-3 text-sm font-semibold text-[#2E7D32]">{f.unit}</span>
                </div><p className="mt-1 text-[11.5px] text-gray-500">Minimum quantity: 10 {f.unit}.</p></div>
              <div><Label required>Location</Label><LocationPicker value={f.location} onChange={(v) => setF((x) => ({ ...x, location: v }))} /></div>
              <div><Label required>{expected ? "Harvest Date" : "Expiry Date"}</Label>
                <div className="relative">
                  <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" min={today} max={expected ? undefined : maxOnHandExpiry} value={expected ? f.availabilityDate : f.expiresAt} onChange={expected ? set("availabilityDate") : set("expiresAt")} className={inputCls + " !pl-9"} />
                </div>
                <p className="mt-1 text-[11.5px] text-gray-500">{expected ? "Pick when your harvest will be ready." : "On Hand listings can expire today or within the next 4 days."}</p></div>
            </div>

            <div><Label>Description</Label>
              <textarea rows={4} maxLength={200} value={f.description} onChange={set("description")} placeholder="Tell buyers more about your product... (optional)" className={inputCls} />
              <p className="text-right text-[11px] text-gray-400">{f.description.length}/200</p></div>
          </div>

          <div className="space-y-3">
            <Label required>Product Image</Label>
            <button type="button" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
              className="flex h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#2E7D32]">
              <UploadCloud size={32} className="text-[#2E7D32]" />
              <span className="mt-2 text-[13px] font-semibold text-[#16301F]">Click to upload image</span>
              <span className="text-[11.5px]">or drag and drop</span>
              <span className="text-[11px] text-gray-400">(JPG, PNG, WEBP · Max 5MB)</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

            <Label>Image Preview</Label>
            <div className={"relative h-40 overflow-hidden rounded-xl bg-[#E8F5E9] " + (f.image ? "cursor-zoom-in" : "")} onDoubleClick={f.image ? () => setZoomImage(f.image) : undefined} title={f.image ? "Double-click to enlarge the product image" : undefined}>
              {f.image ? (
                <>
                  <img src={f.image} alt="Preview" className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">Double-click to zoom</span>
                  <button type="button" aria-label="Remove image" onClick={() => setF((x) => ({ ...x, image: "" }))} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X size={14} /></button>
                </>
              ) : <div className="flex h-full items-center justify-center text-[12px] text-gray-400">No image yet</div>}
            </div>

            <div className="rounded-xl bg-[#F1F8E9] p-3 text-[12px] text-[#33691E]">
              <p className="mb-1 flex items-center gap-1.5 font-semibold"><Info size={13} /> Tips for a great listing</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Use a clear and high-quality photo.</li><li>Be specific with your product detail.</li>
                <li>Keep your quantity and harvest date updated.</li><li>This helps buyers find and trust your supply.</li>
              </ul>
            </div>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            {editing && (
              <button type="button" onClick={remove} disabled={busy}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
                <Trash2 size={15} /> Delete Product
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="rounded-lg border border-gray-200 bg-white px-8 py-2.5 text-[13px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#1B5E20] px-6 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-60">
              <Save size={15} /> {busy ? "Saving..." : editing ? "Save Changes" : "Upload Product"}
            </button>
          </div>
        </div>
      </form>
      <ImageLightbox src={zoomImage} alt={f.product || "Product image preview"} onClose={() => setZoomImage("")} />
    </div>
  );
}

/* ---------------- Details pop-up ---------------- */
function Details({ s, farmer, onClose, onReviews, onImageZoom }) {
  const a = stockInfo(s);
  const n = s.rating?.count || 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <Photo src={s.image} alt={s.product} onDoubleClick={() => onImageZoom?.(s.image)} />
        <div className="space-y-2 p-5 text-[13px] text-gray-700">
          <div className="flex items-start justify-between gap-2"><h3 className="text-[17px] font-semibold text-[#16301F]">{s.product}</h3><span className={"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " + a.cls}>{a.label}</span></div>
          <p>{s.category} · {peso(s.pricePerUnit)} / {s.unit}</p>
          <p>{s.supplyType === "expected" ? "Expected Harvest" : "On Hand"}</p>
          <p>Available {formatQty(s.availableQuantity)} {s.unit} · Total {formatQty(s.quantity)} · Reserved {formatQty(s.reservedQuantity)}</p>
          <p>{s.location} · {s.supplyType === "expected" ? "Harvest" : "Since"} {formatDate(s.availabilityDate)}</p>
          {s.supplyType === "onhand" && s.expiresAt && <p>Expiry date: {formatDate(s.expiresAt)}</p>}
          <p className="text-gray-500">Posted by {farmer}</p>
          <button type="button" onClick={onReviews} className="flex w-full items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-left hover:bg-amber-100">
            <Stars value={s.rating?.avg} size={16} />
            <span className="text-[12.5px] font-semibold text-[#16301F]">{n > 0 ? `${s.rating.avg} · ${n} review${n === 1 ? "" : "s"}` : "No reviews yet"}</span>
            <span className="ml-auto text-[12px] font-semibold text-amber-700">See messages</span>
          </button>
          {s.description && <p className="rounded-lg bg-gray-50 p-2">{s.description}</p>}
          {a.key === "pending" && <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Waiting for admin approval. Buyers cannot see it yet.</p>}
          {a.key === "rejected" && <p className="rounded-lg bg-red-50 p-2 text-red-700">Rejected{s.rejectionReason ? `: ${s.rejectionReason}` : "."} Edit and upload again.</p>}
          {a.key === "out" && <p className="rounded-lg bg-red-50 p-2 text-red-700">All of this product is reserved by buyers. Track the orders in Order Management.</p>}
          <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg bg-gray-100 py-2 font-semibold">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- The page ---------------- */
export default function MySupply({ intent, onNavigate, user }) {
  const farmer = user?.name || "Farmer";
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [prod, setProd] = useState("all");
  const [status, setStatus] = useState("all");
  const [supplyType, setSupplyType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [zoomImage, setZoomImage] = useState("");
  const [reviewsFor, setReviewsFor] = useState(null);
  const [busy, setBusy] = useState(null);

  // Deleted (cancelled) products are hidden.
  const load = useCallback(
    () => supplyApi.mine()
      .then((d) => { setRows((d.supplies || []).filter((s) => s.status !== "cancelled")); setError(""); })
      .catch((e) => setError(e.message)),
    []
  );
  useEffect(() => { load(); const t = setInterval(load, 15000); window.addEventListener("focus", load); return () => { clearInterval(t); window.removeEventListener("focus", load); }; }, [load]);
  useEffect(() => {
    if (intent === "create") {
      setNote("");
      setForm({});
      return;
    }
    if (["active", "onhand", "expected"].includes(intent)) {
      setStatus("active");
      setSupplyType(intent === "onhand" ? "onhand" : intent === "expected" ? "expected" : "all");
      setPage(1);
    } else {
      setStatus("all");
      setSupplyType("all");
      setPage(1);
    }
  }, [intent]);
  useEffect(() => { setPage(1); }, [q, prod, status, supplyType, sort]);

  const names = useMemo(() => [...new Set((rows || []).map((s) => s.product))].sort(), [rows]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = (rows || []).filter((s) =>
      (prod === "all" || s.product === prod) &&
      (status === "all" || (status === "active" ? s.status === "available" : stockInfo(s).key === status)) &&
      (supplyType === "all" || s.supplyType === supplyType) &&
      (!n || `${s.product} ${s.location} ${s.category || ""}`.toLowerCase().includes(n)));
    list.sort((a, b) => sort === "name" ? a.product.localeCompare(b.product) : sort === "oldest" ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }, [rows, q, prod, status, supplyType, sort]);
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function closeForm() { setForm(null); onNavigate?.("supply", null); }
  async function cancel(s) {
    if (busy || !window.confirm(`Delete ${s.product}?`)) return;
    setBusy(s.id); setError("");
    try { await supplyApi.cancel(s.id); setNote("Product deleted."); } catch (e) { setError(e.message); }
    await load(); setBusy(null);
  }

  if (form) return <ProductForm initial={form.id ? form : null} onBack={closeForm} onSaved={(msg) => { setNote(msg); closeForm(); load(); }} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Title sub="Manage your product listings and keep track of your available supplies.">My Supply</Title>
        <button type="button" onClick={() => setForm({})} className="flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110"><Plus size={16} /> Add Product</button>
      </div>
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_150px_150px_160px_140px]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products..." className={inputCls + " !pl-9"} /></div>
        <select value={prod} onChange={(e) => setProd(e.target.value)} className={inputCls}><option value="all">All Products</option>{names.map((n) => <option key={n}>{n}</option>)}</select>
        <select value={supplyType} onChange={(e) => setSupplyType(e.target.value)} className={inputCls} aria-label="Filter by supply type">
          <option value="all">All Supply Types</option><option value="onhand">On Hand</option><option value="expected">Expected</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} aria-label="Filter by supply status">
          <option value="all">All Status</option><option value="active">Active Supply</option><option value="pending">Pending approval</option><option value="available">Available</option><option value="out">Out of Stock</option><option value="expired">Expired</option><option value="rejected">Rejected</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputCls}>
          <option value="newest">Sort by: Newest</option><option value="oldest">Sort by: Oldest</option><option value="name">Sort by: Name</option></select>
      </div>

      {rows !== null && shown.length === 0 ? (
        <EmptyState icon={Plus} title="No products yet" message="Tap Add Product (or the + button at the top) to post your first product." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pageRows.map((s) => {
            const a = stockInfo(s);
            const locked = !["available", "expired"].includes(s.status) || s.reservedQuantity > 0;
            const expected = s.supplyType === "expected";
            const n = s.rating?.count || 0;
            return (
              <div key={s.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                <Photo src={s.image} alt={s.product} onDoubleClick={() => setZoomImage(s.image)}>
                  <span className={"absolute right-2 top-3 rounded-full px-2 py-0.5 text-[10.5px] font-semibold " + a.cls}>{a.label}</span>
                </Photo>
                <div className="p-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={farmer} size={30} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-[12.5px] font-semibold text-[#16301F]">{farmer} <CheckCircle2 size={13} className="shrink-0 text-[#2E7D32]" /></p>
                      <p className="text-[11px] text-gray-500">Farmer</p>
                    </div>
                    <RatingChip rating={s.rating} onClick={() => setReviewsFor(s)} />
                  </div>
                  <h3 className="mt-2.5 truncate text-[15.5px] font-bold text-[#16301F]">{s.product}</h3>
                  <CategoryLine category={s.category} />
                  <button type="button" onClick={() => setReviewsFor(s)} className="mt-1 flex items-center gap-1.5 text-left text-[12px] text-gray-600 hover:underline">
                    <Stars value={s.rating?.avg} />
                    <span>{n > 0 ? `${n} review${n === 1 ? "" : "s"}` : "No reviews yet"}</span>
                  </button>
                  <p className="mt-1.5 text-[15.5px] font-bold text-[#16301F]">{peso(s.pricePerUnit)} <span className="text-[12.5px] font-semibold text-gray-600">/ {s.unit}</span></p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                    <div>{expected ? <CalendarDays size={13} className="mb-0.5 text-[#2E7D32]" /> : <Package size={13} className="mb-0.5 text-[#2E7D32]" />}
                      {expected ? "Expected Harvest" : "On Hand"}
                      <p className="text-[12px] font-semibold text-[#16301F]">{expected ? formatDate(s.availabilityDate) : `${formatQty(s.availableQuantity)} ${s.unit}`}</p>{!expected && s.expiresAt && <p className="mt-0.5 text-[10.5px] font-medium text-amber-700">Expires {formatDate(s.expiresAt)}</p>}</div>
                    <div><MapPin size={13} className="mb-0.5 text-[#2E7D32]" />Location<p className="text-[12px] font-semibold text-[#16301F]">{s.location}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={locked} onClick={() => setForm(s)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-2 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"><Pencil size={13} /> Edit</button>
                    <button type="button" onClick={() => setView(s)} className="flex flex-[1.3] items-center justify-center gap-1 rounded-lg bg-[#1B5E20] py-2 text-[12.5px] font-semibold text-white hover:brightness-110"><Eye size={13} /> View Details</button>
                    {!locked && <button type="button" disabled={busy === s.id} onClick={() => cancel(s)} aria-label="Delete product" className="rounded-lg bg-gray-100 px-2.5 text-gray-600 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
      {view && <Details s={view} farmer={farmer} onClose={() => setView(null)} onReviews={() => setReviewsFor(view)} onImageZoom={(src) => setZoomImage(src)} />}
      <ImageLightbox src={zoomImage} alt="Product image" onClose={() => setZoomImage("")} />
      {reviewsFor && <ReviewsModal supply={reviewsFor} onClose={() => setReviewsFor(null)} />}
    </div>
  );
}