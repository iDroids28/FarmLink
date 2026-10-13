import {
  checkProduct, checkQuantity, checkUnit, checkDate, checkLocation,
} from "../common";

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
  quantity: "",
  unit: "kg",
  neededDate: "",
  location: "",
};

export const canChangeDemand = (d) => d.status === "open" && d.matchedQuantity === 0;
export const canCancelDemand = (d) => d.status === "open" || d.status === "potential_match";

export function validateDemandInput(f) {
  return (
    checkProduct(f.product) ||
    checkQuantity(f.quantity) ||
    checkUnit(f.unit) ||
    checkDate(f.neededDate, "the needed date", true) ||
    checkLocation(f.location)
  );
}

export function toDemandPayload(f) {
  return {
    product: f.product.trim(),
    quantity: Number(f.quantity),
    unit: f.unit,
    neededDate: f.neededDate,
    location: f.location.trim(),
  };
}

export function demandToForm(d) {
  return {
    product: d.product,
    quantity: String(d.quantity),
    unit: d.unit,
    neededDate: String(d.neededDate).slice(0, 10),
    location: d.location,
  };
}
