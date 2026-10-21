import { useEffect, useState } from "react";
import { X, UserRound } from "lucide-react";
import { formatDate } from "./FormBits.jsx";
import { supplyApi } from "../api/supplyApi.js";
import { Stars } from "./ReviewsModal.jsx";

export default function FarmerReviewsModal({ farmerId, farmerName, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    if (!farmerId) {
      setError("Farmer profile is unavailable.");
      return () => { alive = false; };
    }
    supplyApi.farmerReviews(farmerId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [farmerId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const summary = data?.summary || { avg: 0, count: 0 };
  const reviews = data?.reviews || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Farmer reviews">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold text-[#16301F]">{data?.farmerName || farmerName || "Farmer"}</h3>
            <p className="text-[12.5px] text-gray-500">Ratings from buyers after completed orders</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
        {!data && !error && <p className="mt-4 text-[13px] text-gray-500">Loading…</p>}
        {data && <>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 p-3">
            <span className="text-[28px] font-bold text-[#16301F]">{summary.count ? summary.avg : "–"}</span>
            <div><Stars value={summary.avg} size={16} /><p className="text-[12px] text-gray-600">{summary.count ? `${summary.count} review${summary.count === 1 ? "" : "s"}` : "No reviews yet"}</p></div>
          </div>
          {reviews.length ? <ul className="mt-4 space-y-3">{reviews.map((r) => <li key={r.id} className="rounded-xl border border-black/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                  {r.buyerPhoto ? <img src={r.buyerPhoto} alt={`${r.buyerName}'s profile`} className="h-full w-full object-cover" /> : <UserRound size={16} />}
                </span>
                <p className="truncate text-[13.5px] font-semibold text-[#16301F]">{r.buyerName}</p>
              </div>
              <span className="shrink-0 text-[11.5px] text-gray-400">{formatDate(r.createdAt)}</span>
            </div>
            <div className="mt-1"><Stars value={r.rating} /></div>
            {r.message ? <p className="mt-1 whitespace-pre-line text-[13px] text-gray-700">{r.message}</p> : <p className="mt-1 text-[12.5px] italic text-gray-400">No message</p>}
          </li>)}</ul> : <p className="mt-4 text-[13px] text-gray-500">No farmer reviews yet.</p>}
        </>}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">Close</button>
      </div>
    </div>
  );
}
