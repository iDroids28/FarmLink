// Delivery fee (Pick Up is always free). Must match the rule in supplyRoutes.js.
// 1-10 kg = 80, over 10 up to 50 kg = 120, over 50 up to 100 kg = 250,
// over 100 kg = 250 for every 100 kg (rounded up).
export function deliveryFee(kg, fulfillment) {
  if (fulfillment !== "delivery") return 0;
  const q = Number(kg);
  if (!(q > 0)) return 0;
  if (q <= 10) return 80;
  if (q <= 50) return 120;
  if (q <= 100) return 250;
  return 250 * Math.ceil(q / 100);
}

export const feeText = (fee) => (fee > 0 ? `₱${Number(fee).toFixed(2)}` : "Free");

export const DELIVERY_RATES = [
  ["1–10 kg", "₱80"],
  ["11–50 kg", "₱120"],
  ["51–100 kg", "₱250"],
  ["Over 100 kg", "₱250 per 100 kg"],
];