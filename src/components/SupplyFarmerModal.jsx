import { useEffect, useState } from "react";
import { X, User, Store, Sprout } from "lucide-react";
import { formatDate, formatQty } from "./FormBits.jsx";
import { peso } from "./SupplyCard.jsx";
import ReviewsModal, { Stars } from "./ReviewsModal.jsx";
import { supplyApi } from "../api/supplyApi.js";
import { farmerRepository } from "../repositories/farmerRepository";

/* Farmer pop-up used by Find Supply (buyer) and by Supply Approvals / Supply
   Management (admin). Shows the farmer's photo, Farm Name (store), personal
   information, and every approved product that farmer uploaded, each with its
   rating and a "See reviews" button.
   Pass the supply (needs `id` and `product`). If `onOrder(product)` is given,
   each product gets a Pre-order button. */

function ProfilePhoto({ farmerId, name }) {
  const [failed, setFailed] = useState(false);
  const canLoad = farmerId && typeof farmerRepository?.photoUrl === "function";
  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
      {canLoad && !failed ? (
        <img
          src={farmerRepository.photoUrl(farmerId)}
          alt={name || "Farmer"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <User size={30} />
      )}
    </span>
  );
}

function ProductPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-24 w-full items-center justify-center overflow-hidden bg-[#E8F5E9] text-[#2E7D32]">
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <Sprout size={26} />
      )}
    </div>
  );
}

export default function SupplyFarmerModal({ supply, onClose, onOrder }) {
  const [data, setData] = useState(null); // { farmer, products }
  const [error, setError] = useState("");
  const [reviewsFor, setReviewsFor] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    supplyApi
      .farmer(supply.id)
      .then((d) => { if (alive) setData({ farmer: d?.farmer || {}, products: d?.products || [] }); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [supply.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !reviewsFor && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, reviewsFor]);

  const f = data?.farmer;
  const products = data?.products || [];
  const farmName = f?.businessName || "";
  const farmerName = f?.name || supply.farmerName || "";

  const rows = f
    ? [
        ["Farm name", farmName],
        ["Farmer name", farmerName],
        ["Phone", f.phone],
        ["Email", f.email],
        ["Address", f.address],
        ["Location", f.location],
        ["Farm size", f.farmSize],
        ["Type of farming", f.farmingType],
        ["Main crops", f.crops],
        ["About", f.about],
        ["Member since", f.memberSince ? formatDate(f.memberSince) : ""],
      ].filter(([, v]) => v)
    : [];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        role="dialog" aria-modal="true" aria-label="Farmer profile"
      >
        <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <ProfilePhoto farmerId={f?.id} name={farmerName} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#2E7D32]">
                  <Store size={13} /> Farm
                </p>
                <h3 className="break-words text-[18px] font-bold leading-tight text-[#16301F]">
                  {farmName || farmerName || "Farmer profile"}
                </h3>
                {farmName && farmerName && <p className="text-[13px] text-gray-600">{farmerName}</p>}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
          {!data && !error && <p className="mt-4 text-[13px] text-gray-500">Loading…</p>}
          {f && rows.length === 0 && <p className="mt-4 text-[13px] text-gray-500">This farmer has not added profile details yet.</p>}

          {rows.length > 0 && (
            <dl className="mt-4 space-y-2">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-500">{label}</dt>
                  <dd className="break-words text-[13.5px] font-medium text-[#16301F]">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {data && (
            <div className="mt-5 border-t border-black/5 pt-4">
              <h4 className="text-[14px] font-semibold text-[#16301F]">Products ({products.length})</h4>
              {products.length === 0 ? (
                <p className="mt-2 text-[13px] text-gray-500">No approved products yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {products.map((p) => {
                    const ok = Number(p.availableQuantity) > 0;
                    const count = p.rating?.count || 0;
                    return (
                      <div key={p.id} className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
                        <ProductPhoto src={p.image} alt={p.product} />
                        <div className="p-2.5">
                          <p className="truncate text-[13.5px] font-semibold text-[#16301F]">{p.product}</p>
                          <p className="text-[12.5px] font-bold text-[#16301F]">
                            {peso(p.pricePerUnit)} <span className="font-medium text-gray-500">/ {p.unit}</span>
                          </p>
                          <span className={"mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold " + (ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700")}>
                            {ok ? `Available · ${formatQty(p.availableQuantity)} ${p.unit}` : "Out of Stock"}
                          </span>

                          <button
                            type="button"
                            onClick={() => setReviewsFor(p)}
                            className="mt-2 flex w-full flex-col items-start rounded-lg bg-amber-50 px-2 py-1.5 text-left hover:bg-amber-100"
                            title="See ratings and messages from other buyers"
                          >
                            <span className="flex items-center gap-1.5">
                              <Stars value={p.rating?.avg} size={13} />
                              <span className="text-[11.5px] font-semibold text-[#16301F]">{count > 0 ? `${p.rating.avg} (${count})` : "No ratings"}</span>
                            </span>
                            <span className="text-[11px] font-semibold text-amber-700">See reviews</span>
                          </button>

                          {onOrder && (
                            <button
                              type="button"
                              disabled={!ok}
                              onClick={() => onOrder(p)}
                              className="mt-2 w-full rounded-lg bg-[#1B5E20] py-1.5 text-[12px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {ok ? "Pre-order" : "Out of Stock"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>

      {reviewsFor && <ReviewsModal supply={reviewsFor} onClose={() => setReviewsFor(null)} />}
    </>
  );
}