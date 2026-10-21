import {
  checkQuantity, checkUnit, checkDate, checkLocation,
} from "../common";

export const DEMAND_CATEGORIES = [
  "Vegetables", "Fruits", "Rice", "Corn & Grains", "Root Crops", "Legumes & Beans",
  "Herbs & Spices", "Mushrooms", "Coconut Products", "Coffee & Cacao", "Sugarcane",
  "Dairy & Milk", "Eggs", "Livestock", "Poultry", "Meat", "Fish & Seafood",
  "Honey & Bee Products", "Seeds & Seedlings", "Flowers & Ornamental Plants",
  "Fiber Crops", "Farm By-products", "Other Farm Products",
];

const DEMAND_PRODUCT_RE = /^\p{L}{2,60}$/u;

export const DEMAND_STATUS_LABEL = {
  open: "Open",
  potential_match: "Potential Match",
  pending_confirmation: "Pending Confirmation",
  partially_matched: "Partially Matched",
  matched: "Matched",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const EMPTY_DEMAND_FORM = {
  product: "",
  category: "",
  quantity: "",
  unit: "kg",
  neededDate: "",
  location: "",
};

export const canChangeDemand = (d) => d.status === "open" && d.matchedQuantity === 0;
export const canCancelDemand = (d) => d.status === "open" || d.status === "potential_match";

export function validateDemandInput(f) {
  const product = String(f?.product || "").trim();
  if (!DEMAND_PRODUCT_RE.test(product)) {
    return "Product name must contain 2–60 letters only, with no spaces, numbers, or special characters.";
  }
  if (!DEMAND_CATEGORIES.includes(f?.category)) {
    return "Please choose a valid farm-product category.";
  }
  const quantityError = checkQuantity(f?.quantity);
  if (quantityError) return quantityError;
  if (Number(f.quantity) < 25) {
    return `Minimum demand quantity is 25 ${f.unit || "units"}.`;
  }
  return (
    checkUnit(f.unit) ||
    checkDate(f.neededDate, "the needed date", true) ||
    checkLocation(f.location)
  );
}

export function toDemandPayload(f) {
  return {
    product: f.product.trim(),
    category: f.category,
    quantity: Number(f.quantity),
    unit: f.unit,
    neededDate: f.neededDate,
    location: f.location.trim(),
  };
}

export function demandToForm(d) {
  return {
    product: d.product,
    category: d.category || "",
    quantity: String(d.quantity),
    unit: d.unit,
    neededDate: String(d.neededDate).slice(0, 10),
    location: d.location,
  };
}
