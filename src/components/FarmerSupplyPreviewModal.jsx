import { useEffect } from "react";
import { X, Package } from "lucide-react";
import { formatDate, formatQty } from "./FormBits.jsx";
import { peso } from "./SupplyCard.jsx";
import { Stars } from "./ReviewsModal.jsx";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKey(value) {
  return value ? String(value).slice(0, 10) : "";
}

function stockInfo(s) {
  const expiry = dateKey(s.expiresAt);
  const expired = s.status === "expired" || (
    s.supplyType === "onhand" && expiry && expiry < todayLocal() && Number(s.reservedQuantity || 0) <= 0
  );
  if (expired) return { label: "Expired", cls: "bg-gray-100 text-gray-700" };
  if ((s.approvalStatus || "approved") === "pending") return { label: "Pending approval", cls: "bg-amber-100 text-amber-800" };
  if (s.approvalStatus === "rejected") return { label: "Rejected", cls: "bg-red-100 text-red-700" };
  if (Number(s.availableQuantity) > 0) {
    return { label: `Available · ${formatQty(s.availableQuantity)} ${s.unit}`, cls: "bg-green-100 text-green-800" };
  }
  return { label: "Out of Stock", cls: "bg-red-100 text-red-700" };
}

export default function FarmerSupplyPreviewModal({ supply, farmer, onClose, onReviews }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!supply) return null;
  const status = stockInfo(supply);
  const reviewCount = Number(supply.rating?.count || 0);
  const isExpected = supply.supplyType === "expected";
  const postedBy = farmer || supply.farmerName || "Farmer";
  const postedDate = supply.availabilityDate || supply.createdAt;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${supply.product || "Supply"} details`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="relative flex h-48 items-center justify-center overflow-hidden bg-[#E8F5E9] sm:h-56">
          {supply.image ? (
            <img src={supply.image} alt={supply.product || "Product"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[#2E7D32]/60">
              <Package size={48} strokeWidth={1.5} />
              <span className="text-xs font-medium">No product photo</span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close supply details"
            className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-600 shadow transition hover:bg-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5 p-5 text-[13px] text-gray-700 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="break-words text-[19px] font-bold text-[#16301F]">{supply.product || "Untitled product"}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
          </div>

          <p className="font-medium text-[#4B5F4C]">{supply.category || "Farm product"} · {peso(supply.pricePerUnit)} / {supply.unit || "unit"}</p>
          <p className="font-medium text-[#16301F]">{isExpected ? "Expected Harvest" : "On Hand"}</p>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F6FAF4] p-3">
            <div>
              <p className="text-[10.5px] text-gray-500">Available</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[#16301F]">{formatQty(supply.availableQuantity)} {supply.unit}</p>
            </div>
            <div>
              <p className="text-[10.5px] text-gray-500">Total</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[#16301F]">{formatQty(supply.quantity)} {supply.unit}</p>
            </div>
            <div>
              <p className="text-[10.5px] text-gray-500">Reserved</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[#16301F]">{formatQty(supply.reservedQuantity)} {supply.unit}</p>
            </div>
          </div>
          <p>{supply.location || "Location not provided"} · {isExpected ? "Harvest" : "Since"} {formatDate(postedDate)}</p>
          {!isExpected && supply.expiresAt && <p>Expiry date: {formatDate(supply.expiresAt)}</p>}
          <p className="text-gray-500">Posted by {postedBy}</p>

          <button
            type="button"
            onClick={onReviews}
            className="flex w-full items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-left transition hover:bg-amber-100"
          >
            <Stars value={supply.rating?.avg} size={16} />
            <span className="text-[12.5px] font-semibold text-[#16301F]">
              {reviewCount > 0 ? `${supply.rating.avg} · ${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No reviews yet"}
            </span>
            <span className="ml-auto shrink-0 text-[12px] font-semibold text-amber-700">See messages</span>
          </button>

          {supply.description && <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3">{supply.description}</p>}
          {status.label === "Pending approval" && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Waiting for admin approval. Buyers cannot see this listing yet.</p>}
          {status.label === "Rejected" && <p className="rounded-lg bg-red-50 p-3 text-red-700">This listing was rejected. Edit the product and submit it again.</p>}
          {status.label === "Out of Stock" && <p className="rounded-lg bg-red-50 p-3 text-red-700">All of this product is currently reserved or unavailable. Track its requests in Order Management.</p>}

          <button type="button" onClick={onClose} className="mt-1 w-full rounded-xl bg-gray-100 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-200">Close</button>
        </div>
      </div>
    </div>
  );
}
