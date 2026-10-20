import { useEffect, useMemo } from "react";
import { ClipboardList, Plus, Store, Handshake, PackageSearch, TrendingUp, ArrowUpRight, MapPin } from "lucide-react";
import DashboardProfilePhoto from "../../components/DashboardProfilePhoto.jsx";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import BigAction from "../../components/BigAction.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import { LoadNote, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { Notice, StatusBadge, formatDate, formatQty, firstName } from "../../components/FormBits.jsx";
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
    {
      label: "Active Requests",
      value: active.length,
      note: "Requirements still in progress",
      icon: ClipboardList,
      iconClass: "bg-[#E4F4E2] text-[#2E7D32]",
    },
    {
      label: "Remaining Demand",
      value: remainingText,
      note: "Grouped by unit — no conversions",
      icon: TrendingUp,
      iconClass: "bg-[#EAF3DC] text-[#648A24]",
    },
    {
      label: "Available Listings",
      value: sm.items.length,
      note: "Supply currently available to browse",
      icon: Store,
      iconClass: "bg-[#E6F0F7] text-[#39708B]",
    },
  ];

  const firstLoad = (dm.loading && dm.demands.length === 0) || (sm.loading && sm.items.length === 0);
  const recent = active.slice(0, 5);

  return (
    <div className="space-y-7">
      {/* Welcome panel */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-[#D5E9D2] bg-gradient-to-br from-[#E3F5E1] via-[#F8FCF6] to-white p-5 shadow-[0_14px_35px_rgba(22,48,31,0.07)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#B9E6B3]/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-28 h-44 w-44 rounded-full border-[22px] border-white/50" />
        <div className="relative flex items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BBDDB7] bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2E7D32]">
                <Store size={14} /> Buyer workspace
              </span>
              <span className="rounded-full bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                Business / Buyer
              </span>
            </div>
            <h2 className="text-[27px] font-bold leading-tight tracking-tight text-[#16301F] sm:text-[32px]">
              Welcome back, {firstName(user)}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#56705B] sm:text-[15px]">
              Track your requirements, discover available agricultural supply, and follow matches with farmers.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-[#52705A] sm:text-[13px]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#45A64B]" /> Demand tracking</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#78B7D2]" /> Supply discovery</span>
            </div>
          </div>
          <div className="hidden shrink-0 overflow-hidden sm:flex sm:h-28 sm:w-28 sm:items-center sm:justify-center sm:rounded-[30px] sm:border sm:border-white/90 sm:bg-white/65 sm:shadow-[0_10px_28px_rgba(46,125,50,0.10)]">
            <DashboardProfilePhoto user={user} />
          </div>
        </div>
      </section>

      <LoadNote loading={firstLoad} error="" />
      <Notice type="error">{dm.error || sm.error}</Notice>

      {/* Quick actions */}
      <section className="space-y-3">
        <div>
          <h3 className="text-[18px] font-bold tracking-tight text-[#16301F] sm:text-[20px]">Quick actions</h3>
          <p className="mt-1 text-[13px] text-gray-500 sm:text-[14px]">Manage your buying needs from one place.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BigAction primary icon={Plus} title="Request Product" text="Tell farmers what you need" onClick={() => onNavigate("demands", "create")} />
          <BigAction icon={ClipboardList} title="My Requirements" text="Review your requests" onClick={() => onNavigate("demands")} />
          <BigAction icon={Store} title="Find Supply" text="Browse available produce" onClick={() => onNavigate("available")} />
          <BigAction icon={Handshake} title="Matches" text="Review matches with farmers" onClick={() => onNavigate("matches")} />
        </div>
      </section>

      {/* Demand overview */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F5E4] text-[#2E7D32]"><TrendingUp size={18} /></div>
          <div>
            <h3 className="text-[18px] font-bold tracking-tight text-[#16301F] sm:text-[20px]">Demand overview</h3>
            <p className="text-[13px] text-gray-500">A snapshot of your current buying needs.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map(({ label, value, note, icon: Icon, iconClass }) => (
            <div key={label} className="group relative overflow-hidden rounded-2xl border border-[#E0EAE0] bg-white/90 p-5 shadow-[0_8px_24px_rgba(22,48,31,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(22,48,31,0.09)]">
              <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-[44px] bg-[#F5FAF2] transition group-hover:bg-[#ECF7E9]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#65756A] sm:text-[14px]">{label}</p>
                  <p className={`mt-3 break-words font-bold leading-tight tracking-tight text-[#16301F] ${label === "Remaining Demand" ? "text-[21px] sm:text-[23px]" : "text-[34px]"}`}>
                    {firstLoad ? "—" : value}
                  </p>
                  <p className="mt-2 text-[12px] text-gray-500 sm:text-[13px]">{note}</p>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}><Icon size={21} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent requirements */}
      {firstLoad ? null : recent.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={ClipboardList}
            title="No active requests"
            message="Create a product request to help farmers identify supply that may match your needs."
          />
          <div className="flex justify-center">
            <button type="button" onClick={() => onNavigate("demands", "create")} className={primaryBtn} style={primaryStyle}>
              Request Product
            </button>
          </div>
        </div>
      ) : (
        <GlassCard padding="p-0" className="overflow-hidden border border-[#E0EAE0]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9F0E7] bg-gradient-to-r from-[#F5FBF3] to-white px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E4F4E2] text-[#2E7D32]"><ClipboardList size={20} /></div>
              <div>
                <h3 className="text-[16px] font-bold text-[#16301F] sm:text-[17px]">My Requirements</h3>
                <p className="text-[12px] text-gray-500 sm:text-[13px]">Follow progress on your latest requests.</p>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate("demands")} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold text-[#2E7D32] transition hover:bg-[#EAF6E8]">
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="space-y-1 p-4 sm:p-5">
            {recent.map((d) => {
              const p = demandProgress(d);
              const status = displayStatus(d);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onNavigate("demands")}
                  className="block w-full rounded-2xl border border-transparent p-3 text-left transition hover:border-[#E0EAE0] hover:bg-[#FAFCF9] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F7ED] text-[#3D8740]"><PackageSearch size={18} /></div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-[#16301F] sm:text-[16px]">{d.product}</p>
                        <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-gray-500 sm:text-[13px]">
                          <MapPin size={12} className="shrink-0" /> {d.location} <span className="mx-1 text-gray-300">·</span> needed {formatDate(d.neededDate)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge label={DEMAND_STATUS_LABEL[status] || status} tone={demandTone(status)} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[#16301F] sm:text-[13px]">
                    <span className="font-semibold">{formatQty(p.matched)} / {formatQty(d.quantity)} {d.unit}</span>
                    <span className="rounded-full bg-[#EAF6E8] px-2.5 py-1 font-bold text-[#2E7D32]">{p.percent}% matched</span>
                  </div>
                  <div className="mt-2"><ProgressBar percent={p.percent} label={`${d.product} progress`} /></div>
                  <p className="mt-2 text-[11.5px] leading-5 text-gray-500 sm:text-[12px]">
                    Confirmed {formatQty(p.confirmed)} <span className="mx-1 text-gray-300">·</span> Waiting for farmer {formatQty(p.pending)} <span className="mx-1 text-gray-300">·</span> Remaining {formatQty(p.remaining)} {d.unit}
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
