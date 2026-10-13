import { useEffect } from "react";
import { Sprout } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { Notice, StatusBadge, ActionButton, statusTone, formatDate, formatQty } from "../../components/FormBits.jsx";
import useAvailableSupplyViewModel from "../../viewmodels/useAvailableSupplyViewModel";
import { SUPPLY_TYPE_LABEL, SUPPLY_STATUS_LABEL } from "../../models/supply/Supply";

export default function AvailableSupply() {
  const vm = useAvailableSupplyViewModel();
  const { load } = vm;
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000); // reserved quantity drops out of "available" quickly
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[#16301F]">Available Supply</h2>
          <p className="text-[13.5px] text-gray-500">
            Supply posted by farmers. Quantities are what is still available (reserved amounts are not included).
            Expected supply is an estimate and is not guaranteed.
          </p>
        </div>
        <ActionButton variant="secondary" onClick={load} disabled={vm.loading}>Refresh</ActionButton>
      </div>

      <Notice>{vm.error}</Notice>

      {vm.loading && vm.items.length === 0 ? (
        <GlassCard><p className="text-[13.5px] text-gray-500">Loading available supply...</p></GlassCard>
      ) : vm.items.length === 0 ? (
        !vm.error && <EmptyState icon={Sprout} title="No supply available yet" message="Supply posted by farmers will appear here." />
      ) : (
        <GlassCard padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-black/5 text-[12px] text-gray-500">
                  {["Farmer", "Product", "Available", "Unit", "Type", "Date", "Location", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {vm.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{s.farmerName}</td>
                    <td className="px-4 py-3 font-medium text-[#16301F]">{s.product}</td>
                    <td className="px-4 py-3">{formatQty(s.availableQuantity)}</td>
                    <td className="px-4 py-3">{s.unit}</td>
                    <td className="px-4 py-3">{SUPPLY_TYPE_LABEL[s.supplyType]}</td>
                    <td className="px-4 py-3">{formatDate(s.availabilityDate)}</td>
                    <td className="px-4 py-3">{s.location}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={SUPPLY_STATUS_LABEL[s.status] || s.status} tone={statusTone(s.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}