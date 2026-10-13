import { Lock } from "lucide-react";
import GlassCard from "./GlassCard.jsx";
import { PageHeader, StatusBadge, LoadNote, primaryBtn, primaryStyle } from "./DemoBits.jsx";
import { useLoad } from "../api/farmlinkApi.js";

export default function SellerLocked({ onNavigate }) {
  const { data, loading, error } = useLoad("/applications/mine");
  const mine = data?.application;
  const pending = mine?.status === "Pending";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seller Features"
        subtitle="These pages are for approved Farmers / Sellers."
      />
      <LoadNote loading={loading && !data} error={error} />

      <GlassCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
            <Lock size={22} />
          </span>
          <h3 className="text-[16px] font-semibold text-[#16301F]">
            {pending ? "Your application is pending" : "Apply as a Farmer first"}
          </h3>
          <p className="max-w-md text-[13.5px] text-gray-600">
            {pending
              ? "An admin is reviewing your application. Once approved, My Supply unlocks here automatically."
              : "To post your supply, apply as a Farmer / Seller. After the admin approves it, My Supply unlocks."}
          </p>
          {mine && <StatusBadge status={mine.status} />}
          <button
            type="button"
            onClick={() => onNavigate?.("apply")}
            className={primaryBtn}
            style={primaryStyle}
          >
            {pending ? "View Application Status" : "Apply as a Farmer"}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}