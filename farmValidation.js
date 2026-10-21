import { SAFE_MESSAGES } from "./safeErrors.js";

/* Server-side validation for Supply and Demand input. The browser's own checks
   are only for convenience; this file is the real gatekeeper. */

export const UNITS = ["kg", "ton", "sack", "crate", "piece", "bundle", "ml", "liter", "gal", "bottle", "tray", "dozen"];
export const SUPPLY_TYPES = ["onhand", "expected"];
const DEMAND_PRODUCT_RE = /^\p{L}{2,60}$/u;
const DEMAND_CATEGORIES = [
  "Vegetables", "Fruits", "Rice", "Corn & Grains", "Root Crops", "Legumes & Beans",
  "Herbs & Spices", "Mushrooms", "Coconut Products", "Coffee & Cacao", "Sugarcane",
  "Dairy & Milk", "Eggs", "Livestock", "Poultry", "Meat", "Fish & Seafood",
  "Honey & Bee Products", "Seeds & Seedlings", "Flowers & Ornamental Plants",
  "Fiber Crops", "Farm By-products", "Other Farm Products",
];

const TEXT_RE = /^[\p{L}\p{N}\s.,'()-]+$/u;
const ID_RE = /^[a-f\d]{24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUANTITY = 1_000_000;
const DAY = 24 * 60 * 60 * 1000;

export const isValidId = (id) => typeof id === "string" && ID_RE.test(id);
export const round2 = (n) => Math.round(n * 100) / 100;

function todayUTC() {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

function cleanText(value, label, max) {
  if (typeof value !== "string") return { error: `${label} is required.` };
  const v = value.trim().replace(/\s+/g, " ");
  if (v.length < 2) return { error: `${label} must be at least 2 characters.` };
  if (v.length > max) return { error: `${label} must be at most ${max} characters.` };
  if (!TEXT_RE.test(v)) return { error: `${label} contains characters that are not allowed.` };
  return { value: v };
}

function cleanQuantity(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: "Quantity must be greater than 0." };
  }
  const v = round2(value);
  if (v <= 0) return { error: "Quantity must be greater than 0." };
  if (v > MAX_QUANTITY) return { error: "Quantity is too large." };
  return { value: v };
}

// minDays/maxDays are offsets from today (UTC). minDays = -1 tolerates
// timezone differences (a user in the Philippines is ahead of UTC).
function cleanDate(value, label, minDays, maxDays, pastMessage) {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    return { error: `Please choose ${label}.` };
  }
  const t = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) {
    return { error: "That date is not valid." };
  }
  const today = todayUTC();
  if (t < today + minDays * DAY) return { error: pastMessage };
  if (t > today + maxDays * DAY) return { error: `${label} is too far in the future.` };
  return { value: new Date(t) };
}

function firstError(parts) {
  for (const p of parts) if (p.error) return p.error;
  return null;
}

function hasOnlyKeys(body, allowed) {
  return (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body).every((k) => allowed.includes(k))
  );
}

/* Returns { value } or { error }. Only these fields are ever read. Owner,
   status, reserved and available quantities can NOT be sent by the browser. */
export function readSupplyInput(body) {
  const allowed = ["product", "supplyType", "quantity", "unit", "availabilityDate", "location"];
  if (!hasOnlyKeys(body, allowed)) return { error: SAFE_MESSAGES.unprocessed };
  if (!SUPPLY_TYPES.includes(body.supplyType)) return { error: "Please choose a supply type." };
  if (!UNITS.includes(body.unit)) return { error: "Please choose a valid unit." };

  const expected = body.supplyType === "expected";
  const product = cleanText(body.product, "Product", 60);
  const quantity = cleanQuantity(body.quantity);
  const date = expected
    ? cleanDate(body.availabilityDate, "the expected harvest date", -1, 730, "The expected harvest date cannot be in the past.")
    : cleanDate(body.availabilityDate, "the availability date", -365, 730, "The availability date is too far in the past.");
  const location = cleanText(body.location, "Location", 100);

  const error = firstError([product, quantity, date, location]);
  if (error) return { error };
  return {
    value: {
      product: product.value,
      supplyType: body.supplyType,
      quantity: quantity.value,
      unit: body.unit,
      availabilityDate: date.value,
      location: location.value,
    },
  };
}

export function readDemandInput(body) {
  const allowed = ["product", "category", "quantity", "unit", "neededDate", "location"];
  if (!hasOnlyKeys(body, allowed)) return { error: SAFE_MESSAGES.unprocessed };
  if (!UNITS.includes(body.unit)) return { error: "Please choose a valid unit." };
  if (!DEMAND_CATEGORIES.includes(body.category)) return { error: "Please choose a valid farm-product category." };

  const product = typeof body.product === "string" ? body.product.trim() : "";
  if (!DEMAND_PRODUCT_RE.test(product)) {
    return { error: "Product name must contain 2–60 letters only, with no spaces, numbers, or special characters." };
  }
  const quantity = cleanQuantity(body.quantity);
  if (quantity.error) return { error: quantity.error };
  if (quantity.value < 25) return { error: `Minimum demand quantity is 25 ${body.unit}.` };

  const date = cleanDate(body.neededDate, "the needed date", -1, 730, "The needed date cannot be in the past.");
  const location = cleanText(body.location, "Location", 100);
  const error = firstError([date, location]);
  if (error) return { error };

  return {
    value: {
      product,
      category: body.category,
      quantity: quantity.value,
      unit: body.unit,
      neededDate: date.value,
      location: location.value,
    },
  };
}


/* Request-specific offer. Location is deliberately NOT accepted: the server
   copies it from the demand. Product/unit are only compared with the demand. */
export function readOfferInput(body) {
  const allowed = ["product", "unit", "quantity", "supplyType", "availabilityDate"];
  if (!hasOnlyKeys(body, allowed)) return { error: SAFE_MESSAGES.unprocessed };
  if (!SUPPLY_TYPES.includes(body.supplyType)) return { error: "Please choose a supply type." };
  if (!UNITS.includes(body.unit)) return { error: "Please choose a valid unit." };

  const expected = body.supplyType === "expected";
  const product = cleanText(body.product, "Product", 60);
  const quantity = cleanQuantity(body.quantity);
  const date = expected
    ? cleanDate(body.availabilityDate, "the expected harvest date", -1, 730, "The expected harvest date cannot be in the past.")
    : cleanDate(body.availabilityDate, "the availability date", -365, 730, "The availability date is too far in the past.");

  const error = firstError([product, quantity, date]);
  if (error) return { error };

  return {
    value: {
      product: product.value,
      unit: body.unit,
      quantity: quantity.value,
      supplyType: body.supplyType,
      availabilityDate: date.value,
    },
  };
}
