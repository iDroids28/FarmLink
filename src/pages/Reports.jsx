import { useState } from "react";
import { FileBarChart } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Reports() {
  const [monthly] = useState([]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[#16301F]">Reports</h2>
        <p className="text-[13.5px] text-gray-500">
          Summary of your sales over recent months.
        </p>
      </div>

      {monthly.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No sales data yet"
          message="Your monthly sales summary will appear here once you have completed orders."
        />
      ) : (
        <GlassCard padding="p-0">
          <div className="divide-y divide-black/5">
            {monthly.map((m) => (
              <div
                key={m.month}
                className="flex items-center justify-between px-5 py-4"
              >
                <span className="text-[14px] text-[#16301F]">{m.month}</span>
                <span className="text-[14px] font-semibold text-[#16301F]">
                  {m.sales}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}