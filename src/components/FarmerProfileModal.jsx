import { useEffect, useState } from "react";
import { X, User } from "lucide-react";
import { getUserMessage } from "../AuthShared";
import { farmerRepository } from "../repositories/farmerRepository";

/* Shows only what GET /api/farmers/:id returns: name, farm location, type of
   farming, products and the farm photo. No contact details or documents. */
export default function FarmerProfileModal({ farmerId, onClose }) {
  const [farmer, setFarmer] = useState(null);
  const [error, setError] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFarmer(null);
    setError("");
    setPhotoFailed(false);
    farmerRepository
      .getProfile(farmerId)
      .then((f) => { if (alive) setFarmer(f); })
      .catch((err) => { if (alive) setError(getUserMessage(err)); });
    return () => { alive = false; };
  }, [farmerId]);

  const rows = farmer
    ? [
        ["Farm Location", farmer.farmLocation],
        ["Type of Farming", farmer.farmingType],
        ["Main Products / Crops", farmer.products],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Farmer profile"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15.5px] font-semibold text-[#16301F]">Farmer Profile</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
        {!error && !farmer && <p className="mt-3 text-[13px] text-gray-500">Loading…</p>}

        {farmer && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              {farmer.hasPhoto && !photoFailed ? (
                <img
                  src={farmerRepository.photoUrl(farmerId)}
                  alt={`${farmer.displayName}`}
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
                  <User size={32} />
                </span>
              )}
              <p className="min-w-0 break-words text-[18px] font-semibold text-[#16301F]">{farmer.displayName}</p>
            </div>

            <dl className="space-y-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] text-gray-500">{k}</dt>
                  <dd className="text-[13.5px] font-medium text-[#16301F]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}