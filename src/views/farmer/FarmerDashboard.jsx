import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import BigAction from "../../components/BigAction.jsx";
import { Notice, StatusBadge, statusTone, formatQty } from "../../components/FormBits.jsx";
import DashboardWelcome from "../../components/DashboardWelcome.jsx";
import useSupplyViewModel from "../../viewmodels/useSupplyViewModel";
import useMatchViewModel from "../../viewmodels/useMatchViewModel";
import { requestRepository } from "../../repositories/requestRepository";
import { SUPPLY_TYPE_LABEL, SUPPLY_STATUS_LABEL } from "../../models/supply/Supply";
import { Sprout, Plus, Link2, Inbox, ArrowRight } from "lucide-react";

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
    { label: "Active Supply", value: active.length, mode: "active" },
    { label: "On Hand", value: active.filter((s) => s.supplyType === "onhand").length, mode: "onhand" },
    { label: "Expected", value: active.filter((s) => s.supplyType === "expected").length, mode: "expected" },
  ];
  const recent = vm.supplies.slice(0, 3);

  return (
    <div className="space-y-6">
      <DashboardWelcome user={user} />

      <Notice>{vm.error}</Notice>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          text={
            matchVm.loading
              ? "Checking..."
              : waiting > 0
              ? `${waiting} waiting for your answer`
              : "No requests waiting"
          }
          onClick={() => onNavigate("matches")}
        />
        <BigAction
          icon={Inbox}
          title="Requests"
          text={waitingRequests > 0 ? `${waitingRequests} waiting: accept or decline` : "No requests waiting"}
          onClick={() => onNavigate("requests")}
        />
        <BigAction
          icon={Sprout}
          title="My Supply"
          text="See what you have posted"
          onClick={() => onNavigate("supply")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, mode }) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate("supply", mode)}
            aria-label={`View ${label}`}
            className="group w-full rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
          >
            <GlassCard className="h-full transition-transform group-hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] text-gray-600">{label}</span>
                <ArrowRight size={16} className="shrink-0 text-[#2E7D32] opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
              <p className="mt-2 text-[30px] font-bold text-[#16301F]">{vm.loading ? "—" : value}</p>
              <p className="mt-1 text-[11.5px] text-gray-500">Click to view</p>
            </GlassCard>
          </button>
        ))}
      </div>

      {vm.loading ? (
        <GlassCard><p className="text-[14px] text-gray-500">Loading your supply...</p></GlassCard>
      ) : recent.length === 0 ? (
        <EmptyState icon={Sprout} title="No supply posted yet" message="Your latest supply will show up here." />
      ) : (
        <GlassCard padding="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-[16px] font-semibold text-[#16301F]">Recent Supply</h3>
            <button type="button" onClick={() => onNavigate("supply")} className="text-[14px] font-semibold text-[#2E7D32] hover:underline">
              View All
            </button>
          </div>
          <div className="mt-3 divide-y divide-black/5 px-5 pb-5">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[#16301F]">{s.product}</p>
                  <p className="truncate text-[13.5px] text-gray-500">
                    {formatQty(s.availableQuantity)} {s.unit} · {SUPPLY_TYPE_LABEL[s.supplyType]}
                  </p>
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