import { useEffect } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import BigAction from "../../components/BigAction.jsx";
import { Notice, StatusBadge, statusTone, formatQty, firstName } from "../../components/FormBits.jsx";
import useSupplyViewModel from "../../viewmodels/useSupplyViewModel";
import { SUPPLY_TYPE_LABEL, SUPPLY_STATUS_LABEL } from "../../models/supply/Supply";
import { Sprout, PackageCheck, CalendarClock, Plus, Link2 } from "lucide-react";
import useMatchViewModel from "../../viewmodels/useMatchViewModel";

export default function FarmerDashboard({ user, onNavigate }) {
  const vm = useSupplyViewModel();
  const matchVm = useMatchViewModel();
const { load: loadMatches } = matchVm;
useEffect(() => { loadMatches(); }, [loadMatches]);
const waiting = matchVm.matches.filter((m) => m.status === "pending_confirmation").length;
  const { loadSupplies } = vm;
  useEffect(() => {
    loadSupplies();
  }, [loadSupplies]);

  // Every number is counted from the supply records returned by the server.
  const active = vm.supplies.filter((s) => s.status === "available");
  const cards = [
    { label: "Active Supply", value: active.length, icon: Sprout },
    { label: "On-Hand", value: active.filter((s) => s.supplyType === "onhand").length, icon: PackageCheck },
    { label: "Expected", value: active.filter((s) => s.supplyType === "expected").length, icon: CalendarClock },
  ];
  const recent = vm.supplies.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[24px] font-semibold text-[#16301F]">Welcome back, {firstName(user)}</h2>
        <p className="text-[15px] text-gray-600">What would you like to do today?</p>
      </div>

      <Notice>{vm.error}</Notice>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
  icon={Sprout}
  title="My Supply"
  text="See what you have posted"
  onClick={() => onNavigate("supply")}
/>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <GlassCard key={label}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-600">{label}</span>
              <Icon size={18} className="text-[#4CAF50]" />
            </div>
            <p className="mt-2 text-[30px] font-bold text-[#16301F]">{vm.loading ? "—" : value}</p>
          </GlassCard>
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
            <button type="button" onClick={() => onNavigate("supply")} className="text-[14px] font-semibold text-[#2E7D32] hover:underline">View All</button>
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