import { useState } from "react";
import { Truck } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Deliveries() {
  const [deliveries] = useState([]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[#16301F]">
          Deliveries
        </h2>
        <p className="text-[13.5px] text-gray-500">
          Delivery status for your buyers.
        </p>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries yet"
          message="Deliveries will show up here once an order is confirmed."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {deliveries.map((d, i) => (
            <GlassCard key={i}>
              <div className="flex items-center gap-2 text-gray-500">
                <Truck size={16} />
                <span className="text-[12px]">ETA: {d.eta}</span>
              </div>
              <p className="mt-2 text-[15px] font-semibold text-[#16301F]">
                {d.buyer}
              </p>
              <p className="mt-1 text-[12.5px] text-gray-500">{d.item}</p>
              <span className="mt-3 inline-block rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-medium text-green-700">
                {d.status}
              </span>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}