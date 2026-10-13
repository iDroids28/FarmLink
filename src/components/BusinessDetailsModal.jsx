import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getUserMessage } from "../AuthShared";
import { demandRepository } from "../repositories/demandRepository";
import ProgressBar from "./ProgressBar.jsx";
import { StatusBadge, formatDate, formatQty } from "./FormBits.jsx";
import OfferSupplyForm from "./OfferSupplyForm.jsx";
import { DEMAND_STATUS_LABEL } from "../models/demand/Demand";
import {
  demandProgress,
  displayStatus,
  demandTone,
} from "../models/demand/progress";

/*
 * Business profile + request details. Progress is derived from the demand
 * already loaded by Business Requests. Confirm/Decline stay on Matches.
 */
export default function BusinessDetailsModal({ demand, onClose, onOffered }) {
  const demandId = demand.id;
  const [business, setBusiness] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setBusiness(undefined);
    setError("");

    demandRepository
      .getBusiness(demandId)
      .then((result) => {
        if (alive) setBusiness(result);
      })
      .catch((err) => {
        if (alive) setError(getUserMessage(err));
      });

    return () => {
      alive = false;
    };
  }, [demandId]);

  const progress = demandProgress(demand);
  const status = displayStatus(demand);
  const hidden = "Shown once your match for this request is confirmed";

  const businessRows = business
    ? [
        ["Business Name", business.businessName],
        ["Business Type", business.businessType],
        [
          "Authorized Representative",
          business.contactVisible ? business.representative : hidden,
        ],
        ["Business Address", business.businessAddress],
        [
          "Business Email",
          business.contactVisible ? business.businessEmail : hidden,
        ],
        [
          "Mobile Number",
          business.contactVisible ? business.mobile : hidden,
        ],
      ]
    : [];

  const requestRows = [
    ["Product", demand.product],
    ["Requested Quantity", `${formatQty(demand.quantity)} ${demand.unit}`],
    ["Needed Date", formatDate(demand.neededDate)],
    ["Request Location", demand.location],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Request details"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15.5px] font-semibold text-[#16301F]">
            Request Details
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          <section>
            <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">
              Business / Buyer
            </p>

            {error && (
              <p className="rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">
                {error}
              </p>
            )}

            {!error && business === undefined && (
              <p className="text-[13px] text-gray-500">Loading business profile…</p>
            )}

            {!error && business === null && (
              <p className="text-[13px] text-gray-500">
                Business profile is not available for this request.
              </p>
            )}

            {business && (
              <dl className="space-y-2">
                {businessRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[12px] text-gray-500">{label}</dt>
                    <dd className="break-words text-[13.5px] font-medium text-[#16301F]">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="border-t border-black/5 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">
                The Request
              </p>
              <StatusBadge
                label={DEMAND_STATUS_LABEL[status] || status}
                tone={demandTone(status)}
              />
            </div>

            <dl className="space-y-2">
              {requestRows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-500">{label}</dt>
                  <dd className="text-[13.5px] font-medium text-[#16301F]">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px] text-[#16301F]">
                <span className="font-medium">
                  Covered {formatQty(progress.matched)} / {formatQty(demand.quantity)} {demand.unit}
                </span>
                <span className="font-semibold">{progress.percent}%</span>
              </div>

              <ProgressBar
                percent={progress.percent}
                label={`${demand.product} progress`}
              />

              <p className="mt-1 text-[11.5px] text-gray-500">
                Pending {formatQty(progress.pending)} · Confirmed {formatQty(progress.confirmed)} · Remaining {formatQty(progress.remaining)} {demand.unit}
              </p>
            </div>
          </section>

          <OfferSupplyForm demand={demand} onOffered={onOffered} />

          <p className="rounded-lg bg-[#F4F7F3] p-2.5 text-[12px] text-gray-600">
            After submitting an offer, review it and confirm or decline it from your Matches page.
          </p>
        </div>
      </div>
    </div>
  );
}
