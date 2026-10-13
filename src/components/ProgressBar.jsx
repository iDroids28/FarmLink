/* 0-100% bar in the existing FarmLink greens. The value is always clamped. */
export default function ProgressBar({ percent = 0, label = "Progress" }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      className="h-2 w-full overflow-hidden rounded-full bg-[#E4F2DE]"
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${p}%`, background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
      />
    </div>
  );
}