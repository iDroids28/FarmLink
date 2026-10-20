import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { formatDate } from "./FormBits.jsx";
import { supplyApi } from "../api/supplyApi.js";

// Five stars, filled up to the rounded value.
export function Stars({ value = 0, size = 14 }) {
  const full = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value || 0} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= full ? "text-amber-400" : "text-gray-300"}
          fill={i <= full ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

/* Every review of one product: the buyers' names, stars and messages.
   Pass the supply (needs `id` and `product`). */
export default function ReviewsModal({ supply, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    supplyApi
      .reviews(supply.id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [supply.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reviews = data?.reviews || [];
  const summary = data?.summary || { avg: 0, count: 0 };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Product reviews"
    >
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold text-[#16301F]">{data?.product || supply.product}</h3>
            <p className="text-[12.5px] text-gray-500">Ratings and messages from buyers</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
        {!data && !error && <p className="mt-4 text-[13px] text-gray-500">Loading…</p>}

        {data && (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 p-3">
              <span className="text-[28px] font-bold text-[#16301F]">{summary.count > 0 ? summary.avg : "–"}</span>
              <div>
                <Stars value={summary.avg} size={16} />
                <p className="text-[12px] text-gray-600">
                  {summary.count > 0 ? `${summary.count} review${summary.count === 1 ? "" : "s"}` : "No reviews yet"}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-black/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13.5px] font-semibold text-[#16301F]">{r.buyerName}</p>
                    <span className="shrink-0 text-[11.5px] text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <Stars value={r.rating} />
                  {r.message ? (
                    <p className="mt-1 whitespace-pre-line text-[13px] text-gray-700">{r.message}</p>
                  ) : (
                    <p className="mt-1 text-[12.5px] italic text-gray-400">No message</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">
          Close
        </button>
      </div>
    </div>
  );
}