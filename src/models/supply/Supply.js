import {
  checkProduct, checkQuantity, checkUnit, checkDate, checkLocation,
} from "../common";

export const SUPPLY_TYPES = [
  { id: "onhand", label: "On-Hand", hint: "Already harvested and physically available." },
  { id: "expected", label: "Expected / Pre-order", hint: "Not harvested yet. Quantity is an estimate, not a guarantee." },
];

export const SUPPLY_TYPE_LABEL = { onhand: "On-Hand", expected: "Expected" };

export const SUPPLY_STATUS_LABEL = {
  available: "Available",
  potential_match: "Potential Match",
  pending_confirmation: "Pending Confirmation",
  confirmed: "Confirmed",
  reserved: "Reserved",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const EMPTY_SUPPLY_FORM = {
  product: "",
  supplyType: "onhand",
  quantity: "",
  unit: "kg",
  availabilityDate: "",
  location: "",
};

// Same rule the server uses: only untouched, unreserved listings can change.
export const canChangeSupply = (s) => s.status === "available" && s.reservedQuantity === 0;

export function validateSupplyInput(f) {
  if (!SUPPLY_TYPES.some((t) => t.id === f.supplyType)) return "Please choose a supply type.";
  const dateLabel = f.supplyType === "expected" ? "the expected harvest date" : "the availability date";
  return (
    checkProduct(f.product) ||
    checkQuantity(f.quantity) ||
    checkUnit(f.unit) ||
    checkDate(f.availabilityDate, dateLabel, f.supplyType === "expected") ||
    checkLocation(f.location)
  );
}

export function toSupplyPayload(f) {
  return {
    product: f.product.trim(),
    supplyType: f.supplyType,
    quantity: Number(f.quantity),
    unit: f.unit,
    availabilityDate: f.availabilityDate,
    location: f.location.trim(),
  };
}

export function supplyToForm(s) {
  return {
    product: s.product,
    supplyType: s.supplyType,
    quantity: String(s.quantity ?? ""),
    unit: s.unit,
    availabilityDate: String(s.availabilityDate).slice(0, 10),
    location: s.location,
  };
}
