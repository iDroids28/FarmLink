import { useCallback, useEffect, useState } from "react";
import { Send, Package, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import { Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import { requestRepository, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, requestKindLabel } from "../../repositories/requestRepository";
import { matchRepository } from "../../repositories/matchRepository";
import { matchOrderApi } from "../../api/matchOrderApi.js";
import { getUserMessage } from "../../api/farmlinkApi.js";

const directStatus = (r) => REQUEST_STATUS_LABEL[r.status] || r.status;

function OfferPhoto({ offer }) {
  const [photo, setPhoto] = useState(offer.image || "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setPhoto(offer.image || "");
    setFailed(false);
    if (offer.hasPhoto) {
      matchOrderApi.photo(offer.id)
        .then((d) => { if (alive && d?.image) setPhoto(d.image); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [offer.id, offer.hasPhoto, offer.image]);

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#DCE7DC] bg-[#F4F7F3] text-[#2E7D32] sm:h-28 sm:w-28">
      {photo && !failed ? (
        <img src={photo} alt={`${offer.product} offered by ${offer.farmerName || "farmer"}`} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <Package size={26} />
      )}
    </div>
  );
}

function demandOfferStatus(offer) {
  if (offer.status === "pending_confirmation") return { label: "Waiting for your decision", tone: "amber" };
  if (offer.status === "confirmed") return { label: "Accepted", tone: "green" };
  if (offer.status === "declined") return { label: "Declined", tone: "gray" };
  if (offer.status === "cancelled") return { label: "Cancelled", tone: "gray" };
  return { label: offer.status || "Unknown", tone: "gray" };
}

export default function MyRequests({ onNavigate }) {
  const [rows, setRows] = useState(null);
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState("");
  const [offerError, setOfferError] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [directResult, matchResult] = await Promise.allSettled([
      requestRepository.mine(),
      matchOrderApi.mine(),
    ]);

    if (directResult.status === "fulfilled") {
      setRows(directResult.value?.requests || []);
      setError("");
    } else {
      setError(getUserMessage(directResult.reason));
    }

    if (matchResult.status === "fulfilled") {
      setOffers((matchResult.value?.matches || []).filter((m) => m.isDemandOffer));
      setOfferError("");
    } else {
      setOfferError(getUserMessage(matchResult.reason));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function cancel(id) {
    if (busyId) return;
    setBusyId(id);
    setError("");
    setNote("");
    try {
      await requestRepository.cancel(id);
      setNote("Direct request cancelled.");
    } catch (e) {
      setError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  async function decideOffer(offer, accept) {
    if (busyId) return;
    if (!accept && !window.confirm(`Decline the farmer's offer for ${offer.product}?`)) return;
    setBusyId(offer.id);
    setError("");
    setOfferError("");
    setNote("");
    try {
      if (accept) {
        await matchRepository.confirm(offer.id);
        setNote("Offer accepted. Open Matches to choose Pick Up or Delivery and finish the pre-order.");
      } else {
        await matchRepository.decline(offer.id);
        setNote("Offer declined. The offered quantity has been released.");
      }
    } catch (e) {
      setOfferError(getUserMessage(e));
    }
    await load();
    setBusyId(null);
  }

  const list = rows || [];
  const demandOffers = offers || [];
  const directPendingCount = list.filter((r) => r.status === "pending_confirmation").length;
  const offerPendingCount = demandOffers.filter((o) => o.status === "pending_confirmation").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        subtitle="Review direct requests you sent from Find Supply and farmer offers submitted for your demands. You decide whether to accept a demand offer."
      />
      <LoadNote loading={rows === null && !error} error={error} />
      <Notice type="success">{note}</Notice>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-[#16301F]">Farmer Offers for My Demands</h2>
            <p className="text-[12.5px] text-gray-500">Offers submitted from Business Requests appear here, not in Matches while waiting for your decision.</p>
          </div>
          {offerPendingCount > 0 && <StatusBadge label={`${offerPendingCount} awaiting your decision`} tone="amber" />}
        </div>
        <Notice>{offerError}</Notice>

        {offers === null && !offerError ? (
          <p className="rounded-xl border border-[#DCE7DC] bg-white p-4 text-[13px] text-gray-500">Loading farmer offers…</p>
        ) : demandOffers.length === 0 ? (
          <EmptyState icon={Package} title="No farmer offers yet" message="When a farmer offers supply for one of your demands, you can review and accept or decline it here." />
        ) : (
          <div className="space-y-3">
            {demandOffers.map((offer) => {
              const state = demandOfferStatus(offer);
              const pending = offer.status === "pending_confirmation";
              const accepted = offer.status === "confirmed";
              return (
                <GlassCard key={`demand-offer:${offer.id}`}>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <OfferPhoto offer={offer} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-[15.5px] font-bold text-[#16301F]">{offer.product}</h3>
                          <p className="text-[12.5px] text-gray-500">Offer from <span className="font-semibold text-[#16301F]">{offer.farmerName || "Farmer"}</span> · {offer.supplyType === "expected" ? "Expected / Pre-order" : "On-hand"}</p>
                        </div>
                        <StatusBadge label={state.label} tone={state.tone} />
                      </div>
                      <p className="mt-2 text-[13.5px] font-semibold text-[#16301F]">{formatQty(offer.quantity)} {offer.unit} offered</p>
                      <p className="mt-1 text-[12.5px] text-gray-600">For your demand of {formatQty(offer.requestedQuantity)} {offer.unit} · needed {formatDate(offer.neededDate)}</p>
                      <p className="mt-1 text-[12.5px] text-gray-500">{offer.location}{offer.availabilityDate ? ` · available ${formatDate(offer.availabilityDate)}` : ""}</p>
                      {pending && (
                        <>
                          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[12.5px] text-amber-900">Review the farmer's product photo and quantity. The farmer cannot accept or decline this offer for you.</p>
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button type="button" disabled={busyId === offer.id} onClick={() => decideOffer(offer, false)} className="rounded-full border border-[#DCE7DC] bg-white px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-[#F4F7F3] disabled:opacity-60">
                              {busyId === offer.id ? "Saving…" : "Decline offer"}
                            </button>
                            <button type="button" disabled={busyId === offer.id} onClick={() => decideOffer(offer, true)} className="rounded-full bg-[#2E7D32] px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-60">
                              {busyId === offer.id ? "Saving…" : "Accept offer"}
                            </button>
                          </div>
                        </>
                      )}
                      {accepted && (
                        <div className="mt-3 rounded-lg bg-green-50 p-3 text-[12.5px] text-green-800">
                          <div className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /><span>You accepted this offer. Continue to Matches to choose Pick Up or Delivery and complete the pre-order.</span></div>
                          <button type="button" onClick={() => onNavigate?.("matches")} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-green-900 hover:underline">Continue to Matches <ArrowRight size={14} /></button>
                        </div>
                      )}
                      {offer.status === "declined" && <p className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 p-2.5 text-[12.5px] text-gray-600"><XCircle size={15} /> You declined this offer. The farmer's reserved quantity was released.</p>}
                      {offer.status === "cancelled" && <p className="mt-3 text-[12.5px] text-gray-500">This offer was cancelled and is no longer active.</p>}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-black/5 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold text-[#16301F]">Direct Requests from Find Supply</h2>
            <p className="text-[12.5px] text-gray-500">Requests made on an existing farmer product listing. These are still answered by the farmer.</p>
          </div>
          {directPendingCount > 0 && <StatusBadge label={`${directPendingCount} waiting for farmer`} tone="amber" />}
        </div>

        {rows !== null && list.length === 0 ? (
          <EmptyState icon={Send} title="No direct requests yet" message="Open Find Supply and tap Pre-order or Request Supply on a product." />
        ) : (
          <div className="space-y-3">
            {list.map((r) => (
              <GlassCard key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#16301F]">{r.product}</p>
                    <p className="text-[12.5px] text-gray-500">{requestKindLabel(r)} · {r.location}</p>
                  </div>
                  <StatusBadge label={directStatus(r)} tone={REQUEST_STATUS_TONE[r.status] === "red" ? "gray" : (REQUEST_STATUS_TONE[r.status] || "gray")} />
                </div>
                <p className="mt-2 text-[13.5px] text-[#16301F]"><b>{formatQty(r.quantity)} {r.unit}</b> · needed {formatDate(r.neededDate)}</p>
                {r.notes && <p className="mt-1 text-[12.5px] text-gray-600">Your message: {r.notes}</p>}
                {r.status === "confirmed" && <p className="mt-2 rounded-lg bg-green-50 p-2 text-[12.5px] text-green-800">Accepted by the farmer. This is now pre-ordered.</p>}
                {r.status === "pending_confirmation" && (
                  <div className="mt-3 flex justify-end">
                    <button type="button" disabled={busyId === r.id} onClick={() => cancel(r.id)} className="rounded-md bg-gray-100 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60">Cancel request</button>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
