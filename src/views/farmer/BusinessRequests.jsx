import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import FarmerProfileModal from "../../components/FarmerProfileModal.jsx";
import BusinessDetailsModal from "../../components/BusinessDetailsModal.jsx";
import { PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import {
  Notice,
  StatusBadge,
  ActionButton,
  formatDate,
  formatQty,
} from "../../components/FormBits.jsx";
import useBusinessRequestsViewModel from "../../viewmodels/useBusinessRequestsViewModel";
import { DEMAND_STATUS_LABEL } from "../../models/demand/Demand";
import {
  MATCH_STATUS_LABEL,
  MATCH_STATUS_TONE,
} from "../../models/match/Match";
import {
  demandProgress,
  displayStatus,
  demandTone,
} from "../../models/demand/progress";

/*
 * ALL active business requests, whether or not the current farmer has matching
 * supply. Progress and contributors come from real Match records.
 * Only pending_confirmation and confirmed matches count toward progress.
 * Contributions are displayed oldest-first.
 */
export default function BusinessRequests() {
  const vm = useBusinessRequestsViewModel();
  const { load } = vm;
  const [profileId, setProfileId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const detail = vm.items.find((item) => item.id === detailId);

  useEffect(() => {
    load();

    const timer = setInterval(load, 15000);

    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Requests"
        subtitle="What businesses currently need, how much is already covered, and which farmers contributed."
      />

      <LoadNote
        loading={vm.loading && vm.items.length === 0}
        error=""
      />

      <Notice type="error">{vm.error}</Notice>

      {!vm.loading && !vm.error && vm.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No active requests"
          message="Business requests will appear here."
        />
      ) : (
        <div className="space-y-4">
          {vm.items.map((d) => {
            const p = demandProgress(d);
            const status = displayStatus(d);

            return (
              <GlassCard key={d.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-semibold text-[#16301F]">
                      {d.product}
                    </h3>

                    <p className="text-[13px] text-gray-600">
                      {formatQty(d.quantity)} {d.unit} needed
                    </p>

                    <p className="text-[12.5px] text-gray-500">
                      Needed: {formatDate(d.neededDate)} · Location:{" "}
                      {d.location}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={DEMAND_STATUS_LABEL[status] || status}
                      tone={demandTone(status)}
                    />
                    <ActionButton
                      variant="secondary"
                      className="!px-3 !py-1 !text-[12px]"
                      onClick={() => setDetailId(d.id)}
                    >
                      View Details
                    </ActionButton>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[12.5px] text-[#16301F]">
                    <span className="font-medium">
                      {formatQty(p.matched)} / {formatQty(d.quantity)}{" "}
                      {d.unit}
                    </span>

                    <span className="font-semibold">
                      {p.percent}%
                    </span>
                  </div>

                  <ProgressBar
                    percent={p.percent}
                    label={`${d.product} progress`}
                  />

                  <p className="mt-1 text-[11.5px] text-gray-500">
                    Confirmed {formatQty(p.confirmed)} · Pending response{" "}
                    {formatQty(p.pending)} · Remaining{" "}
                    {formatQty(p.remaining)} {d.unit}
                  </p>
                </div>

                <div className="mt-4 border-t border-black/5 pt-3">
                  <p className="mb-2 text-[12.5px] font-semibold text-[#16301F]">
                    Contributing Farmers
                  </p>

                  {!d.contributions || d.contributions.length === 0 ? (
                    <p className="text-[12.5px] text-gray-500">
                      No farmers have contributed yet.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {d.contributions.map((c) => (
                        <li
                          key={c.farmerId}
                          className="flex flex-wrap items-center gap-2 text-[13px] text-[#16301F]"
                        >
                          <span className="min-w-0 flex-1">
                            {c.order}.{" "}
                            <span className="font-medium">
                              {c.farmerName}
                            </span>
                            {" — "}
                            {formatQty(c.totalQuantity ?? c.quantity)}{" "}
                            {d.unit}

                            <span className="block pl-5 text-[11.5px] text-gray-500">
                              Confirmed{" "}
                              {formatQty(c.confirmedQuantity ?? 0)}
                              {" · "}
                              Pending{" "}
                              {formatQty(c.pendingQuantity ?? 0)}{" "}
                              {d.unit}
                            </span>
                          </span>

                          <StatusBadge
                            label={
                              c.status === "pending_confirmation"
                                ? "Pending response"
                                : (MATCH_STATUS_LABEL[c.status] || c.status)
                            }
                            tone={
                              MATCH_STATUS_TONE[c.status] || "gray"
                            }
                          />

                          <ActionButton
                            variant="secondary"
                            className="!px-3 !py-1 !text-[12px]"
                            onClick={() =>
                              setProfileId(c.farmerId)
                            }
                          >
                            View Profile
                          </ActionButton>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {detail && (
        <BusinessDetailsModal
          demand={detail}
          onClose={() => setDetailId(null)}
          onOffered={load}
        />
      )}

      {profileId && (
        <FarmerProfileModal
          farmerId={profileId}
          onClose={() => setProfileId(null)}
        />
      )}
    </div>
  );
}
