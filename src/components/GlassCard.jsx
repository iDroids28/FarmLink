export default function GlassCard({
  children,
  className = "",
  as: Tag = "div",
  opacity = 0.68,
  padding = "p-5",
}) {
  return (
    <Tag
      className={`rounded-2xl ${padding} ${className}`}
      style={{
        background: `rgba(255,255,255,${opacity})`,
        border: "1px solid rgba(22,48,31,0.08)",
        boxShadow: "0 10px 30px rgba(22,48,31,0.08)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {children}
    </Tag>
  );
}