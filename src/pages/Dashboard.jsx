import {
  Sprout,
  ShoppingCart,
  Wallet,
  TrendingUp,
  PackageSearch,
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

const STATS = [
  { label: "Active Listings", value: "0", icon: Sprout },
  { label: "Pending Orders", value: "0", icon: ShoppingCart },
  { label: "Sales This Month", value: "₱0", icon: Wallet },
  { label: "Avg. Market Price", value: "—", icon: TrendingUp },
];

const RECENT_ORDERS = [];

export default function Dashboard({ user }) {
  const firstName = (user?.name || user?.email || "there").split("@")[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-[#16301F]">
          Welcome back, {firstName}
        </h2>
        <p className="text-[13.5px] text-gray-500">
          Here's a summary of your farm today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.label}>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-gray-500">
                  {stat.label}
                </span>
                <Icon size={16} className="text-[#4CAF50]" />
              </div>
              <p className="mt-2 text-[24px] font-bold text-[#16301F]">
                {stat.value}
              </p>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {RECENT_ORDERS.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No recent orders"
              message="Orders from buyers will show up here."
            />
          ) : (
            <GlassCard padding="p-0">
              <div className="flex items-center justify-between px-5 pt-5">
                <h3 className="text-[14.5px] font-semibold text-[#16301F]">
                  Recent Orders
                </h3>
                <button className="text-[12.5px] font-medium text-[#2E7D32] hover:underline">
                  View All
                </button>
              </div>
              <div className="mt-3 divide-y divide-black/5 px-5 pb-5">
                {RECENT_ORDERS.map((order, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-[#16301F]">
                        {order.buyer}
                      </p>
                      <p className="truncate text-[12.5px] text-gray-500">
                        {order.item}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11.5px] font-medium text-gray-600">
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        <GlassCard className="flex flex-col justify-between">
          <div>
            <h3 className="text-[14.5px] font-semibold text-[#16301F]">
              Next Harvest
            </h3>
            <p className="mt-2 text-[13px] text-gray-500">
              No upcoming harvest scheduled yet.
            </p>
          </div>
          <button
            className="mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{
              background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
              boxShadow: "0 6px 16px rgba(46,125,50,0.25)",
            }}
          >
            Post to Marketplace
          </button>
        </GlassCard>
      </div>
    </div>
  );
}