import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import BigAction from "../../components/BigAction.jsx";
import { Notice, StatusBadge, statusTone, formatQty, firstName } from "../../components/FormBits.jsx";
import useSupplyViewModel from "../../viewmodels/useSupplyViewModel";
import useMatchViewModel from "../../viewmodels/useMatchViewModel";
import { requestRepository } from "../../repositories/requestRepository";
import { SUPPLY_TYPE_LABEL, SUPPLY_STATUS_LABEL } from "../../models/supply/Supply";
import { Sprout, Plus, Link2, Inbox, Package, CalendarDays, TrendingUp, ArrowUpRight } from "lucide-react";
import DashboardProfilePhoto from "../../components/DashboardProfilePhoto.jsx";

export default function FarmerDashboard({ user, onNavigate }) {
  const vm = useSupplyViewModel();
  const matchVm = useMatchViewModel();
  const { load: loadMatches } = matchVm;
  const { loadSupplies } = vm;

  const [incoming, setIncoming] = useState([]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    loadSupplies();
  }, [loadSupplies]);

  // Buyers' requests / pre-orders on my supply.
  useEffect(() => {
    const refresh = () => {
      requestRepository
        .incoming()
        .then((d) => setIncoming(d?.requests || []))
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const waiting = matchVm.matches.filter((m) => m.status === "pending_confirmation").length;
  const waitingRequests = incoming.filter((r) => r.status === "pending_confirmation").length;

  // Every number is counted from the supply records returned by the server.
  const active = vm.supplies.filter((s) => s.status === "available");
  const cards = [
    {
      label: "Active Supply",
      value: active.length,
      mode: "active",
      note: "Currently available listings",
      icon: Sprout,
      iconClass: "bg-[#E4F4E2] text-[#2E7D32]",
    },
    {
      label: "On Hand",
      value: active.filter((s) => s.supplyType === "onhand").length,
      mode: "onhand",
      note: "Ready to provide",
      icon: Package,
      iconClass: "bg-[#EAF3DC] text-[#648A24]",
    },
    {
      label: "Expected",
      value: active.filter((s) => s.supplyType === "expected").length,
      mode: "expected",
      note: "Upcoming harvest listings",
      icon: CalendarDays,
      iconClass: "bg-[#E6F0F7] text-[#39708B]",
    },
  ];
  const recent = vm.supplies.slice(0, 3);

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
                <Sprout size={14} /> Farmer workspace
              </span>
              <span className="rounded-full bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                Farmer
              </span>
            </div>
            <h2 className="text-[27px] font-bold leading-tight tracking-tight text-[#16301F] sm:text-[32px]">
              Welcome back, {firstName(user)}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#56705B] sm:text-[15px]">
              Manage your harvest, review buyer requests, and keep your available supply up to date.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-[#52705A] sm:text-[13px]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#45A64B]" /> Supply overview</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#78B7D2]" /> Buyer coordination</span>
            </div>
          </div>
          <div className="hidden shrink-0 overflow-hidden sm:flex sm:h-28 sm:w-28 sm:items-center sm:justify-center sm:rounded-[30px] sm:border sm:border-white/90 sm:bg-white/65 sm:shadow-[0_10px_28px_rgba(46,125,50,0.10)]">
            <DashboardProfilePhoto user={user} />
          </div>
        </div>
      </section>

      <Notice>{vm.error}</Notice>

      {/* Quick actions */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[18px] font-bold tracking-tight text-[#16301F] sm:text-[20px]">Quick actions</h3>
            <p className="mt-1 text-[13px] text-gray-500 sm:text-[14px]">Get to the things you need most.</p>
          </div>
          {waiting + waitingRequests > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7D8B0] bg-[#FFF8E8] px-3 py-1.5 text-[12px] font-semibold text-[#8A641C]">
              <Inbox size={14} /> {waiting + waitingRequests} item{waiting + waitingRequests === 1 ? "" : "s"} need attention
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BigAction
            primary
            icon={Plus}
            title="Post Supply"
            text="Add the harvest you have"
            onClick={() => onNavigate("supply", "create")}
          />
          <BigAction
            icon={Link2}
            title="Match Requests"
            text={matchVm.loading ? "Checking..." : waiting > 0 ? `${waiting} waiting for your answer` : "Review compatible matches"}
            onClick={() => onNavigate("matches")}
          />
          <BigAction
            icon={Inbox}
            title="Requests"
            text={waitingRequests > 0 ? `${waitingRequests} waiting: accept or decline` : "Review requests from buyers"}
            onClick={() => onNavigate("requests")}
          />
          <BigAction
            icon={Sprout}
            title="My Supply"
            text="See what you have posted"
            onClick={() => onNavigate("supply")}
          />
        </div>
      </section>

      {/* Supply summary */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F5E4] text-[#2E7D32]"><TrendingUp size={18} /></div>
          <div>
            <h3 className="text-[18px] font-bold tracking-tight text-[#16301F] sm:text-[20px]">Supply overview</h3>
            <p className="text-[13px] text-gray-500">A quick look at your listed harvest.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map(({ label, value, mode, note, icon: Icon, iconClass }) => (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate("supply", mode)}
              aria-label={`View ${label}`}
              className="group w-full rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
            >
              <div className="relative h-full overflow-hidden rounded-2xl border border-[#E0EAE0] bg-white/90 p-5 shadow-[0_8px_24px_rgba(22,48,31,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(22,48,31,0.09)]">
                <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-[44px] bg-[#F5FAF2] transition group-hover:bg-[#ECF7E9]" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#65756A] sm:text-[14px]">{label}</p>
                    <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-[#16301F]">{vm.loading ? "—" : value}</p>
                    <p className="mt-2 text-[12px] text-gray-500 sm:text-[13px]">{note}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}><Icon size={21} /></div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent supply */}
      {vm.loading ? (
        <GlassCard className="border border-[#E0EAE0]"><p className="text-[14px] text-gray-500">Loading your supply...</p></GlassCard>
      ) : recent.length === 0 ? (
        <EmptyState icon={Sprout} title="No supply posted yet" message="Your latest supply will show up here after you post a harvest." />
      ) : (
        <GlassCard padding="p-0" className="overflow-hidden border border-[#E0EAE0]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9F0E7] bg-gradient-to-r from-[#F5FBF3] to-white px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E4F4E2] text-[#2E7D32]"><Sprout size={20} /></div>
              <div>
                <h3 className="text-[16px] font-bold text-[#16301F] sm:text-[17px]">Recent Supply</h3>
                <p className="text-[12px] text-gray-500 sm:text-[13px]">Your latest posted items.</p>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate("supply")} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold text-[#2E7D32] transition hover:bg-[#EAF6E8]">
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="divide-y divide-[#EDF2EB] px-4 sm:px-6">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-4 transition hover:bg-[#FAFCF9] sm:px-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F7ED] text-[#3D8740]"><Package size={19} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#16301F]">{s.product}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-gray-500 sm:text-[13px]">
                      {formatQty(s.availableQuantity)} {s.unit} <span className="mx-1 text-gray-300">·</span> {SUPPLY_TYPE_LABEL[s.supplyType]}
                    </p>
                  </div>
                </div>
                <StatusBadge label={SUPPLY_STATUS_LABEL[s.status] || s.status} tone={statusTone(s.status)} />
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
