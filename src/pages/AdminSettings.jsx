import GlassCard from "../components/GlassCard.jsx";
import { PageHeader } from "../components/DemoBits.jsx";

export default function AdminSettings({ user }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Your admin account." />
      <GlassCard>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-gray-500">Name</dt>
            <dd className="text-[13.5px] font-medium text-[#16301F]">{user?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-gray-500">Email</dt>
            <dd className="text-[13.5px] font-medium text-[#16301F]">{user?.email || "—"}</dd>
          </div>
        </dl>
      </GlassCard>
    </div>
  );
}