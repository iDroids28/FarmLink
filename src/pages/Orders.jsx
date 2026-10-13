import { useState } from "react";
import { PackageSearch } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

const STATUS_STYLE = {
  Pending: "bg-amber-100 text-amber-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Delivered: "bg-green-100 text-green-700",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);

  function handleAccept(id) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Confirmed" } : o))
    );
  }

  function handleDecline(id) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[#16301F]">Orders</h2>
        <p className="text-[13.5px] text-gray-500">
          Orders coming in from buyers.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders yet"
          message="Orders from buyers will appear here once they come in."
        />
      ) : (
        <GlassCard padding="p-0">
          <div className="divide-y divide-black/5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#16301F]">
                    {o.buyer}
                  </p>
                  <p className="text-[12.5px] text-gray-500">{o.item}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-[11.5px] font-medium " +
                      STATUS_STYLE[o.status]
                    }
                  >
                    {o.status}
                  </span>
                  {o.status === "Pending" && (
                    <>
                      <button
                        onClick={() => handleAccept(o.id)}
                        className="rounded-full bg-[#2E7D32] px-3 py-1 text-[12px] font-medium text-white hover:bg-[#256029]"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(o.id)}
                        className="rounded-full px-3 py-1 text-[12px] font-medium text-gray-500 hover:text-gray-800"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}