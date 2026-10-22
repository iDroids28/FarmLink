import { useEffect, useState } from "react";
import { X, User } from "lucide-react";
import { formatDate } from "./FormBits.jsx";
import { requestRepository } from "../repositories/requestRepository";
import { farmerRepository } from "../repositories/farmerRepository";
import { getUserMessage } from "../api/farmlinkApi.js";

/*
 * Shows a farmer profile either from a supply card (legacy usage) or from a
 * contribution in Business Requests (farmerId usage). The direct farmer profile
 * endpoint returns a safe whitelist of public fields and never exposes contact
 * details or uploaded verification documents.
 */
export default function FarmerProfileModal({ supply, farmerId, onClose }) {
  const directFarmerId = farmerId ? String(farmerId) : "";
  const supplyId = supply?.id ? String(supply.id) : "";
  const usesDirectProfile = Boolean(directFarmerId);
  const [f, setF] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setF(null);
    setError("");

    const loadProfile = usesDirectProfile
      ? farmerRepository.getProfile(directFarmerId)
      : supplyId
        ? requestRepository.farmer(supplyId).then((result) => result?.farmer || null)
        : Promise.reject(new Error("Farmer profile is not available."));

    loadProfile
      .then((profile) => {
        if (alive) setF(profile || null);
      })
      .catch((e) => {
        if (alive) setError(getUserMessage(e));
      });

    return () => { alive = false; };
  }, [directFarmerId, supplyId, usesDirectProfile]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = f?.displayName || f?.businessName || f?.name || supply?.farmerName || "Farmer profile";
  const rows = f
    ? usesDirectProfile
      ? [
          ["Farm Location", f.farmLocation],
          ["Type of Farming", f.farmingType],
          ["Products", f.products],
          ["Member since", f.memberSince ? formatDate(f.memberSince) : ""],
        ].filter(([, v]) => v)
      : [
          ["Business name", f.businessName],
          ["Farmer name", f.name || supply?.farmerName],
          ["Phone", f.phone],
          ["Email", f.email],
          ["Address", f.address],
          ["Location", f.location],
          ["Farm size", f.farmSize],
          ["Main crops", f.crops],
          ["About", f.about],
          ["Member since", f.memberSince ? formatDate(f.memberSince) : ""],
        ].filter(([, v]) => v)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog" aria-modal="true" aria-label="Farmer profile"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {usesDirectProfile && f?.hasPhoto ? (
              <img
                src={farmerRepository.photoUrl(directFarmerId)}
                alt={`${title} profile`}
                className="h-12 w-12 shrink-0 rounded-full border border-black/10 object-cover"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                <User size={22} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold text-[#16301F]">{title}</h3>
              {supply?.product && <p className="text-[12.5px] text-gray-500">Seller of {supply.product}</p>}
            </div>
          </div>
          <button type="button" onClick={() => onClose?.()} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}
        {!f && !error && <p className="mt-4 text-[13px] text-gray-500">Loading…</p>}
        {f && rows.length === 0 && <p className="mt-4 text-[13px] text-gray-500">This farmer has not added public profile details yet.</p>}

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

        <button type="button" onClick={() => onClose?.()} className="mt-5 w-full rounded-lg bg-gray-100 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200">
          Close
        </button>
      </div>
    </div>
  );
}
