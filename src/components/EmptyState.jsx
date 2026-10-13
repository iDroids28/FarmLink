import GlassCard from "./GlassCard.jsx";

export default function EmptyState({ icon: Icon, title, message }) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 py-14 text-center">
      {Icon && <Icon size={28} className="text-[#9AB59C]" />}
      <p className="text-[14px] font-medium text-[#16301F]">{title}</p>
      {message && (
        <p className="max-w-xs text-[12.5px] text-gray-500">{message}</p>
      )}
    </GlassCard>
  );
}