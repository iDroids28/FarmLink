import { useEffect, useState } from "react";
import { UserRound, X, ZoomIn } from "lucide-react";
import { api, getUserMessage } from "../api/farmlinkApi.js";

export default function AdminBuyerProfileModal({ buyerId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    setPhotoFailed(false);
    setPhotoOpen(false);

    api.get(`/admin/buyers/${buyerId}/profile`)
      .then((result) => { if (alive) setData(result); })
      .catch((e) => { if (alive) setError(getUserMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [buyerId]);

  useEffect(() => {
    if (!photoOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPhotoOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photoOpen]);

  const buyer = data?.buyer || {};
  const profile = data?.profile || {};
  const photo = typeof profile.photo === "string" ? profile.photo : "";
  const fields = [
    ["Name", buyer.name],
    ["Email", buyer.email],
    ["Role", buyer.role || "buyer"],
    ["Verification", buyer.verificationStatus],
  ];
  const closeProfile = () => {
    setPhotoOpen(false);
    onClose?.();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        onMouseDown={(e) => e.target === e.currentTarget && closeProfile()}
        role="dialog"
        aria-modal="true"
        aria-label="Buyer profile"
      >
        <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
          <div className="flex items-start gap-4 border-b border-black/5 p-5">
            <button
              type="button"
              onClick={() => photo && !photoFailed && setPhotoOpen(true)}
              disabled={!photo || photoFailed || loading || Boolean(error)}
              title={photo && !photoFailed ? "Click to enlarge profile photo" : "No profile photo uploaded"}
              aria-label={photo && !photoFailed ? "Enlarge buyer profile photo" : "No buyer profile photo uploaded"}
              className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E8F5E9] text-[#2E7D32] disabled:cursor-default"
            >
              {photo && !photoFailed ? (
                <>
                  <img
                    src={photo}
                    alt={`${buyer.name || "Buyer"} profile`}
                    onError={() => setPhotoFailed(true)}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                    <ZoomIn size={20} />
                  </span>
                </>
              ) : <UserRound size={32} aria-label="No profile photo" />}
            </button>

            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2E7D32]">Buyer profile</p>
              <h2 className="mt-1 break-words text-[18px] font-bold leading-tight text-[#16301F]">{buyer.name || "Business / Buyer"}</h2>
              <p className="mt-1 break-words text-[13px] text-gray-500">{buyer.email || "—"}</p>
              {photo && !photoFailed && <p className="mt-2 text-[11px] text-gray-400">Click the photo to enlarge</p>}
              {!loading && !error && (!photo || photoFailed) && <p className="mt-2 text-[11px] text-gray-400">No profile photo available</p>}
            </div>

            <button type="button" onClick={closeProfile} aria-label="Close buyer profile" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <p className="p-5 text-[13px] text-gray-500">Loading buyer profile…</p>
          ) : error ? (
            <p className="m-5 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
          ) : (
            <dl className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-500">{label}</dt>
                  <dd className="break-words text-[13.5px] font-medium text-[#16301F]">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="border-t border-black/5 p-4">
            <button type="button" onClick={closeProfile} className="w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">Close</button>
          </div>
        </div>
      </div>

      {photoOpen && photo && !photoFailed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded buyer profile photo"
          onMouseDown={(e) => e.target === e.currentTarget && setPhotoOpen(false)}
        >
          <button type="button" onClick={() => setPhotoOpen(false)} aria-label="Close enlarged photo" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X size={22} /></button>
          <img src={photo} alt={`${buyer.name || "Buyer"} profile enlarged`} className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </>
  );
}
