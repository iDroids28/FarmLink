import { useCallback, useEffect, useRef, useState } from "react";
import { Handshake, Sprout, UploadCloud, X, Camera } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, LoadNote, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import { peso } from "../../components/SupplyCard.jsx";
import { matchRepository } from "../../repositories/matchRepository";
import { MATCH_STATUS_LABEL, MATCH_STATUS_TONE } from "../../models/match/Match";
import { DEMAND_STATUS_LABEL } from "../../models/demand/Demand";
import { getUserMessage } from "../../api/farmlinkApi.js";
import { matchOrderApi } from "../../api/matchOrderApi.js";

// Your old page (renamed to FarmerMatchesOld.jsx) is used only if the new list cannot be loaded.
const oldFiles = import.meta.glob("./FarmerMatchesOld.jsx", { eager: true });
const FarmerMatchesOld = oldFiles["./FarmerMatchesOld.jsx"]?.default;

const STEP_LABEL = {
  accepted: "Accepted",
  preparing: "Preparing",
  packed: "Packed",
  ready_pickup: "Ready for Pickup",
  collected: "Collected",
  completed: "Completed",
  ready_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

const grayBtn = "rounded-md bg-gray-100 px-3 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200";
const isExpected = (m) => m.supplyType === "expected";
const typeLabel = (m) => (isExpected(m) ? "Expected Harvest" : "On Hand");
const demandStatusTone = (status) => {
  if (["matched", "completed"].includes(status)) return "green";
  if (["potential_match", "pending_confirmation", "partially_matched"].includes(status)) return "amber";
  return "gray";
};
const demandStatusText = (m) => m.demandStatus ? (DEMAND_STATUS_LABEL[m.demandStatus] || m.demandStatus) : "";

// Shrinks the chosen photo in the browser (about 60 KB) so it can be sent safely.
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Use a JPG, PNG or WEBP photo."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Photo is too large (max 8 MB)."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let max = 560;
      let quality = 0.7;
      let out = "";
      for (let i = 0; i < 7; i += 1) {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", quality);
        if (out.length <= 80000) break;
        max = Math.round(max * 0.85);
        quality = Math.max(0.4, quality - 0.08);
      }
      URL.revokeObjectURL(url);
      if (out.length <= 85000) resolve(out);
      else reject(new Error("That photo is too detailed. Try another one."));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that photo.")); };
    img.src = url;
  });
}

/* Show the offer photo before the product name, matching the Buyer Matches layout.
   The private endpoint also allows the farmer who owns this exact supply to view their own upload. */
function MatchThumb({ m }) {
  const [photo, setPhoto] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);
  const [listingFailed, setListingFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPhoto("");
    setPhotoFailed(false);
    setListingFailed(false);
    if (m.hasPhoto) {
      matchOrderApi.photo(m.id)
        .then((data) => { if (active && data?.image) setPhoto(data.image); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [m.id, m.hasPhoto]);

  const useOfferPhoto = Boolean(m.hasPhoto && photo && !photoFailed);
  const src = useOfferPhoto ? photo : m.image;
  const visibleSrc = useOfferPhoto ? photo : (listingFailed ? "" : m.image);

  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/5 bg-[#E8F5E9] text-[#2E7D32]">
      {visibleSrc ? (
        <img
          src={visibleSrc}
          alt={`${m.product} product photo`}
          onError={() => {
            if (useOfferPhoto) setPhotoFailed(true);
            else setListingFailed(true);
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <Sprout size={22} />
      )}
    </span>
  );
}

/* ---------- Accept a match (or add a photo to a confirmed one) with the products' photo ---------- */
function PhotoModal({ m, onClose, onDone }) {
  const pending = m.status === "pending_confirmation";
  const [uploaded, setUploaded] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pick(file) {
    if (!file) return;
    try {
      setError("");
      setUploaded(await shrinkPhoto(file));
    } catch (e) {
      setError(e.message);
    }
  }

  const preview = uploaded || m.image;

  async function submit() {
    if (busy) return;
    setError("");
    if (!preview) return setError("Upload a photo of the products.");
    setBusy(true);
    try {
      // 1) the photo (the buyer sees it before pre-ordering)
      await matchOrderApi.savePhoto(m.id, uploaded ? { image: uploaded } : { useListing: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    try {
      // 2) confirm the match (only when it is still waiting for the farmer)
      if (pending) await matchRepository.confirm(m.id);
      await onDone(pending ? "Match accepted. The buyer can now see your photo and pre-order." : "Photo saved. The buyer was notified.");
    } catch (e) {
      setError(getUserMessage(e));
      setBusy(false);
    }
  }

  const rows = [
    ["Buyer", m.buyerName],
    ["This match", `${formatQty(m.quantity)} ${m.unit} of ${m.product}`],
    ["Buyer requested (total)", `${formatQty(m.requestedQuantity)} ${m.unit}`],
    ["Supply type", typeLabel(m)],
    ["Price", `${peso(m.pricePerUnit)} / ${m.unit}`],
    ["Needed by", formatDate(m.neededDate)],
    ["Location", m.location],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Match photo"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-[#16301F]">{pending ? "Accept this match" : "Photo of the products"}</h3>
            <p className="text-[12.5px] text-gray-500">{m.product}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <dl className="mt-3 space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-gray-500">{k}</dt>
              <dd className="text-[13.5px] font-medium text-[#16301F]">{v || "—"}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <p className="text-[13px] font-semibold text-[#16301F]">Photo of the products</p>
          <p className="text-[12px] text-gray-500">The buyer sees this photo before they pre-order. Use the listing photo, or upload a fresh one.</p>
          <div className="mt-2 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-[#E8F5E9]">
            {preview ? (
              <img src={preview} alt="Products" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center text-[12.5px] text-gray-500"><Camera size={26} className="mb-1 text-[#2E7D32]" />No photo yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-[13px] font-semibold text-[#16301F] hover:border-[#2E7D32]"
          >
            <UploadCloud size={16} className="text-[#2E7D32]" /> {uploaded ? "Choose a different photo" : "Upload a new photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          {uploaded && (
            <button type="button" onClick={() => setUploaded("")} className="mt-1 text-[12px] font-semibold text-gray-500 hover:underline">
              Use the listing photo instead
            </button>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className={grayBtn + " flex-1"}>Cancel</button>
          <button type="button" disabled={busy} onClick={submit} className={primaryBtn + " flex-1"} style={primaryStyle}>
            {busy ? "Saving..." : pending ? "Accept match" : "Save photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- The page ---------- */
export default function FarmerMatches(props) {
  const { onNavigate } = props;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [photoFor, setPhotoFor] = useState(null);

  const load = useCallback(
    () => matchOrderApi.farmerMatches()
      .then((d) => { setRows(d.matches || []); setError(""); setFallback(false); })
      .catch((e) => { setError(e.message); setFallback(true); }),
    []
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Pending request-specific offers are proposals for the buyer to review in
  // My Requests. Only automatic FIFO matches and buyer-accepted offers belong here.
  const visibleRows = (rows || []).filter((m) => !m.isDemandOffer || m.status === "confirmed" || Boolean(m.order));

  async function decline(m) {
    if (busyId || !window.confirm(`Decline the match for ${m.product}?`)) return;
    setBusyId(m.id);
    setActionError("");
    setNote("");
    try {
      await matchRepository.decline(m.id);
      setNote("Match declined.");
    } catch (e) {
      setActionError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  async function photoDone(text) {
    setPhotoFor(null);
    setActionError("");
    setNote(text);
    await load();
  }

  // A request-specific offer already contains its required photo. The farmer
  // should confirm that pending match directly rather than being asked to upload it again.
  async function acceptWithExistingPhoto(m) {
    if (busyId) return;
    setBusyId(m.id);
    setActionError("");
    setNote("");
    try {
      await matchRepository.confirm(m.id);
      setNote("Match accepted. The buyer can now see your photo and pre-order.");
    } catch (e) {
      setActionError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  // If the new list cannot be loaded, show the old page when it was renamed to FarmerMatchesOld.jsx.
  if (fallback) {
    if (FarmerMatchesOld) return <FarmerMatchesOld {...props} />;
    return (
      <div className="space-y-4">
        <Notice type="error">{error}</Notice>
        <p className="text-[13px] text-gray-600">The Matches list could not be loaded. Restart the backend and refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matches"
        subtitle="Review automatic matches that need your decision and track confirmed orders. Offers you submitted for a buyer demand wait for the buyer in My Requests."
      />
      <LoadNote loading={rows === null && !error} error="" />
      <Notice type="error">{actionError}</Notice>
      <Notice type="success">{note}</Notice>

      {rows !== null && visibleRows.length === 0 ? (
        <EmptyState icon={Handshake} title="No matches to review" message="Pending offers for buyer demands are waiting for the buyer in My Requests. Automatic matches and buyer-accepted offers appear here." />
      ) : (
        <div className="space-y-3">
          {visibleRows.map((m) => {
            const pending = m.status === "pending_confirmation";
            const awaitingBuyer = pending && Boolean(m.isDemandOffer);
            const confirmed = m.status === "confirmed";
            return (
              <div key={m.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <MatchThumb m={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-bold text-[#16301F]">{m.product}</p>
                    <p className="text-[12.5px] text-gray-500">
                      {formatQty(m.quantity)} {m.unit} of {m.buyerName}'s {formatQty(m.requestedQuantity)} {m.unit} · needed by {formatDate(m.neededDate)}
                    </p>
                    <p className="text-[12.5px] text-gray-500">
                      <span className="font-semibold text-[#2E7D32]">{typeLabel(m)}</span> · {m.location}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusBadge
                      label={awaitingBuyer ? "Waiting for buyer" : (MATCH_STATUS_LABEL[m.status] || m.status)}
                      tone={awaitingBuyer ? "amber" : (MATCH_STATUS_TONE[m.status] || "gray")}
                    />

                    {awaitingBuyer && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11.5px] font-semibold text-blue-800">
                        Offer sent · buyer decision pending
                      </span>
                    )}

                    {pending && !m.isDemandOffer && (
                      <>
                        {m.hasPhoto && demandStatusText(m) && <StatusBadge label={demandStatusText(m)} tone={demandStatusTone(m.demandStatus)} />}
                        <button type="button" disabled={busyId === m.id} onClick={() => decline(m)} className={grayBtn + " disabled:opacity-60"}>
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={busyId === m.id}
                          onClick={() => m.hasPhoto ? acceptWithExistingPhoto(m) : setPhotoFor(m)}
                          className="rounded-md bg-[#1B5E20] px-3 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                        >
                          {busyId === m.id ? "Accepting..." : "Accept"}
                        </button>
                      </>
                    )}

                    {confirmed && (
                      <>
                        {m.hasPhoto ? (
                          demandStatusText(m) ? <StatusBadge label={demandStatusText(m)} tone={demandStatusTone(m.demandStatus)} /> : null
                        ) : (
                          <button type="button" onClick={() => setPhotoFor(m)} className="flex items-center gap-1.5 rounded-md bg-[#1B5E20] px-3 py-2 text-[13px] font-semibold text-white hover:brightness-110">
                            <Camera size={14} /> Add photo
                          </button>
                        )}
                        {m.order ? (
                          <>
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11.5px] font-semibold text-blue-800">
                              Pre-ordered · {STEP_LABEL[m.order.orderStatus] || "Accepted"}
                            </span>
                            <button type="button" onClick={() => onNavigate?.("orders")} className={grayBtn}>Order Management</button>
                          </>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11.5px] font-semibold text-amber-800">Waiting for the buyer to pre-order</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {photoFor && <PhotoModal m={photoFor} onClose={() => setPhotoFor(null)} onDone={photoDone} />}
    </div>
  );
}