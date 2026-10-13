/* Shared rules for Supply and Demand forms. These mirror farmValidation.js on
   the server (the server is the one that actually enforces them). */

export const UNITS = ["kg", "ton", "sack", "crate", "piece", "bundle"];

const TEXT_RE = /^[\p{L}\p{N}\s.,'()-]+$/u;
const MAX_QUANTITY = 1000000;

export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function checkText(value, label, max) {
  const t = (value || "").trim().replace(/\s+/g, " ");
  if (t.length < 2) return `${label} must be at least 2 characters.`;
  if (t.length > max) return `${label} must be at most ${max} characters.`;
  if (!TEXT_RE.test(t)) return `${label} contains characters that are not allowed.`;
  return null;
}

export const checkProduct = (v) => checkText(v, "Product", 60);
export const checkLocation = (v) => checkText(v, "Location", 100);

export function checkQuantity(value) {
  if (value === "" || value == null) return "Please enter a quantity.";
  const n = Number(value);
  if (!Number.isFinite(n) || Math.round(n * 100) / 100 <= 0) return "Quantity must be greater than 0.";
  if (n > MAX_QUANTITY) return "Quantity is too large.";
  return null;
}

export const checkUnit = (v) => (UNITS.includes(v) ? null : "Please choose a valid unit.");

export function checkDate(value, label, notInPast) {
  if (!value) return `Please choose ${label}.`;
  if (notInPast && value < todayISO()) return `${label[0].toUpperCase()}${label.slice(1)} cannot be in the past.`;
  return null;
}
