import { useEffect, useMemo } from "react";
import { ClipboardList, Plus, Store, Handshake } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import BigAction from "../../components/BigAction.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import { LoadNote, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { Notice, StatusBadge, formatDate, formatQty } from "../../components/FormBits.jsx";
import DashboardWelcome from "../../components/DashboardWelcome.jsx";
import useDemandViewModel from "../../viewmodels/useDemandViewModel";
import useAvailableSupplyViewModel from "../../viewmodels/useAvailableSupplyViewModel";
import { DEMAND_STATUS_LABEL } from "../../models/demand/Demand";
import { demandProgress, displayStatus, demandTone, isActiveDemand } from "../../models/demand/progress";

/* Buyer dashboard: built only from /api/demands/mine and /api/supplies/available,
   re-read on open, every 15 seconds and when the tab regains focus, so it
   always reflects the current database (including matches that already happened). */
export default function BuyerDashboard({ user, onNavigate }) {
  const dm = useDemandViewModel();
  const sm = useAvailableSupplyViewModel();
  const { loadDemands } = dm;
  const { load: loadSupply } = sm;

  useEffect(() => {
    const refresh = () => { loadDemands(); loadSupply(); };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [loadDemands, loadSupply]);

  const active = useMemo(() => dm.demands.filter(isActiveDemand), [dm.demands]);

  // Units are never converted: remaining demand is totalled per unit.
  const remainingText = useMemo(() => {
    const byUnit = {};
    for (const d of active) {
      const { remaining } = demandProgress(d);
      if (remaining > 0) byUnit[d.unit] = Math.round(((byUnit[d.unit] || 0) + remaining) * 100) / 100;
    }
    const parts = Object.entries(byUnit).map(([u, q]) => `${formatQty(q)} ${u}`);
    return parts.length ? parts.join(" · ") : "0";
  }, [active]);

  const stats = [
    { label: "Active Requests", value: active.length },
    { label: "Total Remaining Demand", value: remainingText },
    { label: "Available Listings", value: sm.items.length },
  ];

  const firstLoad = (dm.loading && dm.demands.length === 0) || (sm.loading && sm.items.length === 0);
  const recent = active.slice(0, 5);

  return (
    <div className="space-y-6">
      <DashboardWelcome user={user} />
      <LoadNote loading={firstLoad} error="" />
      <Notice type="error">{dm.error || sm.error}</Notice>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BigAction primary icon={Plus} title="Request Product" text="Tell farmers what you need" onClick={() => onNavigate("demands", "create")} />
        <BigAction primary icon={ClipboardList} title="My Requirements" text="See your requests" onClick={() => onNavigate("demands")} />
        <BigAction primary icon={Store} title="Find Supply" text="See what farmers have posted" onClick={() => onNavigate("available")} />
        <BigAction primary icon={Handshake} title="Matches" text="See matches with farmers" onClick={() => onNavigate("matches")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value }) => (
          <GlassCard key={label}>
            <span className="text-[12.5px] text-gray-500">{label}</span>
            <p className="mt-2 break-words text-[24px] font-bold text-[#16301F]">{firstLoad ? "—" : value}</p>
          </GlassCard>
        ))}
      </div>

      {firstLoad ? null : recent.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={ClipboardList}
            title="No active requests"
            message="Click Request Product to create one. Farmers' matching supply is suggested automatically."
          />
          <div className="flex justify-center">
            <button type="button" onClick={() => onNavigate("demands", "create")} className={primaryBtn} style={primaryStyle}>
              Request Product
            </button>
          </div>
        </div>
      ) : (
        <GlassCard padding="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-[15px] font-semibold text-[#16301F]">My Requirements</h3>
            <button type="button" onClick={() => onNavigate("demands")} className="text-[13px] font-semibold text-[#2E7D32] hover:underline">
              View All
            </button>
          </div>
          <div className="mt-3 divide-y divide-black/5 px-5 pb-5">
            {recent.map((d) => {
              const p = demandProgress(d);
              const status = displayStatus(d);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onNavigate("demands")}
                  className="block w-full py-3 text-left hover:bg-black/[0.02]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-[#16301F]">{d.product}</p>
                      <p className="truncate text-[12.5px] text-gray-500">
                        {d.location} · needed {formatDate(d.neededDate)}
                      </p>
                    </div>
                    <StatusBadge label={DEMAND_STATUS_LABEL[status] || status} tone={demandTone(status)} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12.5px] text-[#16301F]">
                    <span className="font-medium">{formatQty(p.matched)} / {formatQty(d.quantity)} {d.unit}</span>
                    <span className="font-semibold">{p.percent}%</span>
                  </div>
                  <div className="mt-1"><ProgressBar percent={p.percent} label={`${d.product} progress`} /></div>
                  <p className="mt-1 text-[11.5px] text-gray-500">
                    Confirmed {formatQty(p.confirmed)} · Waiting for farmer {formatQty(p.pending)} · Remaining {formatQty(p.remaining)} {d.unit}
                  </p>
                </button>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}