/* Small shared pieces for the new Supply / Demand screens. Same colors and
   shapes as the existing FarmLink design. */

export const FIELD_CLASS =
  "w-full rounded-xl bg-[#F4F7F3] border border-[#DCE7DC] px-4 py-2.5 text-[14px] text-gray-800 placeholder:text-gray-400 outline-none transition focus:bg-white focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/25 disabled:opacity-60";

export const BUTTON_STYLE = {
  background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
  boxShadow: "0 6px 16px rgba(46,125,50,0.25)",
};

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[12.5px] font-semibold text-[#16301F]">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-gray-500">{hint}</p>}
    </div>
  );
}

export function Notice({ type = "error", children }) {
  if (!children) return null;
  const ok = type === "success";
  return (
    <div
      role={ok ? "status" : "alert"}
      className={
        "rounded-xl border px-4 py-2.5 text-[13px] " +
        (ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700")
      }
    >
      {children}
    </div>
  );
}

const TONES = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  gray: "bg-gray-100 text-gray-600",
};
export function StatusBadge({ label, tone = "gray" }) {
  return (
    <span className={"inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium " + TONES[tone]}>
      {label}
    </span>
  );
}
export const statusTone = (status) =>
  status === "available" || status === "open" ? "green" : status === "cancelled" ? "gray" : "amber";

export function ActionButton({ variant = "primary", className = "", ...props }) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      {...props}
      className={
        "rounded-full px-4 py-2 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] disabled:opacity-60 " +
        (primary
          ? "text-white hover:brightness-110 "
          : "border border-[#DCE7DC] bg-white text-gray-700 hover:bg-[#F4F7F3] ") +
        className
      }
      style={primary ? BUTTON_STYLE : undefined}
    />
  );
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Dates are stored as UTC midnight, so show them in UTC to avoid off-by-one days.
  return d.toLocaleDateString("en-PH", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function formatQty(n) {
  return n == null ? "—" : Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

export function firstName(user) {
  return (user?.name || user?.email || "there").split(/[\s@]/)[0];
}
