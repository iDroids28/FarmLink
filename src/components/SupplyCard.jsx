import { useState } from "react";
import { MapPin, CalendarDays, Package, User, ShoppingCart, Heart, Leaf, Wheat, Apple, Carrot, Sprout, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatQty } from "./FormBits.jsx";

export const peso = (n) =>
  n == null ? "—" : `₱ ${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_ICON = { Vegetables: Leaf, "Leafy Vegetables": Sprout, Grains: Wheat, Fruits: Apple, "Root Crops": Carrot };
export function CategoryLine({ category }) {
  if (!category) return null;
  const Icon = CATEGORY_ICON[category] || Leaf;
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-500">
      <Icon size={13} className="text-[#2E7D32]" /> {category}
    </p>
  );
}

export function TypeRibbon({ type }) {
  const expected = type === "expected";
  return (
    <span className={"absolute left-3 top-3 rounded-md px-2.5 py-1 text-[11.5px] font-semibold text-white shadow " + (expected ? "bg-[#F5A623]" : "bg-[#2E7D32]")}>
      {expected ? "Expected Harvest" : "Available"}
    </span>
  );
}

export function ProductImage({ src, alt, type, children }) {
  return (
    <div className="relative h-40 w-full overflow-hidden bg-[#E8F5E9]">
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : (
        <div className="flex h-full items-center justify-center text-[#2E7D32]/40"><Package size={40} /></div>
      )}
      {type && <TypeRibbon type={type} />}
      {children}
    </div>
  );
}

export function Avatar({ name, size = 36 }) {
  const initial = String(name || "").trim().charAt(0).toUpperCase();
  return (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[14px] font-bold text-[#2E7D32]">
      {initial || <User size={size / 2} />}
    </span>
  );
}

/* "Showing 1-6 of 12 products" + page buttons */
export function Pagination({ page, pageSize, total, onPage }) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-semibold border border-gray-200 bg-white text-gray-600 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-[12px] text-gray-500">Showing {from}–{to} of {total} products</p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" onClick={() => onPage(n)}
            className={btn + (n === page ? " !border-[#1B5E20] !bg-[#1B5E20] !text-white" : "")}>{n}</button>
        ))}
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <p className="flex items-start gap-1 text-[11px] leading-tight text-gray-400"><Icon size={13} className="mt-0.5 shrink-0 text-[#2E7D32]" /> {label}</p>
      <p className="mt-0.5 pl-[17px] text-[12px] font-semibold leading-tight text-[#16301F]">{value}</p>
    </div>
  );
}

/* Buyer card used on Find Supply (matches the mockup). */
export default function SupplyCard({ s, onProfile, onOrder }) {
  const [fav, setFav] = useState(false);
  const expected = s.supplyType === "expected";
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <ProductImage src={s.image} alt={s.product} type={s.supplyType}>
        <button type="button" onClick={() => setFav((v) => !v)} aria-label="Save to favourites"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow">
          <Heart size={16} className={fav ? "fill-red-500 text-red-500" : "text-gray-500"} />
        </button>
      </ProductImage>
      <div className="p-4">
        <button type="button" onClick={onProfile} title="View farmer profile" className="flex w-full items-center gap-2.5 text-left">
          <Avatar name={s.farmerName} size={40} />
          <span>
            <span className="block text-[13.5px] font-semibold text-[#16301F]">{s.farmerName || "Farmer"}</span>
            <span className="block text-[11.5px] text-gray-500">Local Farmer</span>
          </span>
        </button>

        <h3 className="mt-3 truncate text-[16.5px] font-bold text-[#16301F]">{s.product}</h3>
        <CategoryLine category={s.category} />
        <p className="mt-2 text-[17px] font-bold text-[#16301F]">
          {peso(s.pricePerUnit)} <span className="text-[13px] font-semibold text-gray-600">/ {s.unit}</span>
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Info icon={Package} label={expected ? "Expected Quantity" : "Available Quantity"} value={`${formatQty(s.availableQuantity)} ${s.unit}`} />
          <Info icon={MapPin} label="Location" value={s.location || "—"} />
          <Info icon={CalendarDays} label={expected ? "Harvest Date" : "Availability"} value={expected ? formatDate(s.availabilityDate) : "Today"} />
        </div>

        <button type="button" onClick={onOrder}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B5E20] py-2.5 text-[13.5px] font-semibold text-white hover:brightness-110">
          <ShoppingCart size={16} /> Pre-order
        </button>
      </div>
    </div>
  );
}