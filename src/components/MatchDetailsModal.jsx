import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getUserMessage } from "../AuthShared";
import { matchRepository } from "../repositories/matchRepository";
import ProgressBar from "./ProgressBar.jsx";
import {
  ActionButton,
  Notice,
  StatusBadge,
  formatDate,
  formatQty,
} from "./FormBits.jsx";
import {
  MATCH_STATUS_LABEL,
  MATCH_STATUS_TONE,
  canDecideMatch,
} from "../models/match/Match";

/*
 * Business profile + request + demand-level progress for one of the farmer's
 * matches (GET /api/matches/:id/details). Confirm / Decline are shown only for a
 * pending_confirmation match; the backend enforces ownership and status anyway.
 * `row` is the match from the already-loaded list, so it is the freshest status
 * right after an action. Details are re-fetched after every action.
 */
export default function MatchDetailsModal({
  matchId,
  row,
  busy = false,
  error: actionError = "",
  success = "",
  onConfirm,
  onDecline,
  onClose,
}) {
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadError("");
    matchRepository
      .getDetails(matchId)
      .then((d) => {
        if (alive) setDetails(d);
      })
      .catch((err) => {
        if (alive) setLoadError(getUserMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [matchId, reloadKey]);

  // Run the existing viewmodel action (it refreshes the list), then refresh progress.
  async function decide(action) {
    await action(matchId);
    setReloadKey((k) => k + 1);
  }

  const m = details?.match;
  const d = details?.demand;
  const b = details?.business;

  const canDecide =
    Boolean(m) && canDecideMatch(m) && Boolean(row) && canDecideMatch(row);

  const hidden = "Shown only while you have a pending or confirmed match on this request";

  const businessRows = b
    ? [
        ["Business Type", b.businessType],
        ["Authorized Representative", b.contactVisible ? b.representative : hidden],
        ["Business Address", b.businessAddress],
        ["Business Email", b.contactVisible ? b.businessEmail : hidden],
        ["Mobile Number", b.contactVisible ? b.mobile : hidden],
      ]
    : [];

  const requestRows = d
    ? [
        ["Product", d.product],
        ["Requested Quantity", `${formatQty(d.quantity)} ${d.unit}`],
        ["Needed Date", formatDate(d.neededDate)],
        ["Request Location", d.location],
        ["Your Match", `${formatQty(m.quantity)} ${m.unit}`],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Match details"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15.5px] font-semibold text-[#16301F]">Match Details</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <Notice type="error">{loadError || actionError}</Notice>
          <Notice type="success">{success}</Notice>
        </div>

        {!details && !loadError && (
          <p className="mt-4 text-[13px] text-gray-500">Loading…</p>
        )}

        {details && (
          <div className="mt-4 space-y-5">
            <section>
              <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">
                Business / Buyer
              </p>

              {b === null ? (
                <p className="text-[13px] text-gray-500">
                  Business profile is not available for this request.
                </p>
              ) : (
                <>
                  <p className="mb-2 break-words text-[18px] font-semibold text-[#16301F]">
                    {b.businessName || "—"}
                  </p>
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
                </>
              )}
            </section>

            <section className="border-t border-black/5 pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">
                  The Request
                </p>
                <StatusBadge
                  label={MATCH_STATUS_LABEL[m.status] || m.status}
                  tone={MATCH_STATUS_TONE[m.status] || "gray"}
                />
              </div>

              <dl className="space-y-2">
                {requestRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[12px] text-gray-500">{label}</dt>
                    <dd className="text-[13.5px] font-medium text-[#16301F]">{value || "—"}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px] text-[#16301F]">
                  <span className="font-medium">
                    Covered {formatQty(d.matchedQuantity)} / {formatQty(d.quantity)} {d.unit}
                  </span>
                  <span className="font-semibold">{d.progressPercent}%</span>
                </div>

                <ProgressBar percent={d.progressPercent} label={`${d.product} progress`} />

                <p className="mt-1 text-[11.5px] text-gray-500">
                  Pending {formatQty(d.pendingQuantity)} · Confirmed {formatQty(d.confirmedQuantity)} ·
                  Remaining {formatQty(d.remainingQuantity)} {d.unit}
                </p>
              </div>
            </section>

            {canDecide && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">
                <ActionButton
                  variant="secondary"
                  onClick={() => decide(onDecline)}
                  disabled={busy}
                >
                  Decline
                </ActionButton>
                <ActionButton onClick={() => decide(onConfirm)} disabled={busy}>
                  Confirm
                </ActionButton>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
