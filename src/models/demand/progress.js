/* Progress helpers for demands. Quantities come from real Match totals
   (confirmed + pending), never from a guess. Units are never converted. */

const r2 = (n) => Math.round(n * 100) / 100;

// Statuses that are over for good. Everything else is an active request.
const CLOSED = ["cancelled", "completed", "expired"];
export const isActiveDemand = (d) => !CLOSED.includes(d.status);

export function demandProgress(d) {
  const qty = Math.max(0, Number(d.quantity) || 0);
  const confirmed = Math.max(0, Number(d.confirmedQuantity) || 0);
  const pending = Math.max(0, Number(d.pendingQuantity) || 0);
  const matched = Math.min(r2(confirmed + pending), qty); // never over-allocated
  const remaining = r2(Math.max(0, qty - matched));
  const percent = qty > 0 ? Math.round(Math.min(100, Math.max(0, (matched / qty) * 100)) * 10) / 10 : 0;
  return { matched, confirmed, pending, remaining, percent };
}

// Status computed from the real numbers, so a request with matches is never
// labelled "Open" just because a stored status is out of date.
export function displayStatus(d) {
  if (CLOSED.includes(d.status)) return d.status;
  const { matched, confirmed, pending } = demandProgress(d);
  const qty = Number(d.quantity) || 0;
  if (matched <= 0) return "open";
  if (confirmed + 0.001 >= qty) return "matched";
  if (pending > 0) return "potential_match";
  return "partially_matched";
}

// FormBits.StatusBadge tones: green | amber | gray
export const demandTone = (s) =>
  s === "open" || s === "matched" ? "green" : s === "cancelled" || s === "expired" ? "gray" : "amber";