export default function BigAction({ icon: Icon, title, text, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-4 rounded-2xl p-5 text-left transition " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 " +
        "active:scale-[0.99] " +
        (primary
          ? "text-white hover:brightness-110"
          : "border border-[#DCE7DC] bg-white/80 text-[#16301F] hover:bg-white")
      }
      style={
        primary
          ? {
              background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
              boxShadow: "0 10px 22px rgba(46,125,50,0.28)",
            }
          : { boxShadow: "0 6px 18px rgba(22,48,31,0.06)" }
      }
    >
      <span
        className={
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full " +
          (primary ? "bg-white/20" : "bg-[#F4F7F3]")
        }
      >
        <Icon size={28} className={primary ? "text-white" : "text-[#2E7D32]"} />
      </span>
      <span className="min-w-0">
        <span className="block text-[18px] font-semibold leading-tight">{title}</span>
        {text && (
          <span className={"mt-1 block text-[14px] " + (primary ? "text-white/85" : "text-gray-500")}>
            {text}
          </span>
        )}
      </span>
    </button>
  );
}