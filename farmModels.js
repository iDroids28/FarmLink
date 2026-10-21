import mongoose from "mongoose";
import { UNITS } from "./farmValidation.js";

/* Supply and Demand models. Statuses beyond available/open/cancelled are
   listed now so the matching phase does not need a schema change, but nothing
   sets them yet. */

export const SUPPLY_STATUSES = [
  "available", "potential_match", "pending_confirmation", "confirmed",
  "reserved", "completed", "cancelled", "expired",
];
export const DEMAND_STATUSES = [
  "open", "potential_match", "pending_confirmation", "partially_matched",
  "matched", "completed", "cancelled", "expired",
];
export const APPROVAL_STATUSES = ["pending", "approved", "rejected"];

const supplySchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: String, required: true, trim: true, maxlength: 60 },

    // Product details shown in My Supply, Supply Approvals and Find Supply.
    category: { type: String, default: "", trim: true, maxlength: 40 },
    pricePerUnit: { type: Number, min: 0, default: 0 },
    description: { type: String, default: "", trim: true, maxlength: 200 },
    // Photo stored as a small data URL (the browser shrinks it before upload).
    image: { type: String, default: "" },

    // Admin approval: every new or edited product starts as "pending".
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: "approved", index: true },
    rejectionReason: { type: String, default: "", maxlength: 200 },

    supplyType: { type: String, enum: ["onhand", "expected"], required: true },
    estimatedQuantity: { type: Number, min: 0, default: null },
    actualQuantity: { type: Number, min: 0, default: null },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    // Derived on the server (base quantity - reserved). Never taken from the browser.
    availableQuantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, enum: UNITS, required: true },
    availabilityDate: { type: Date, required: true },
    // On-hand listings expire by date; expected harvest uses availabilityDate.
    expiresAt: { type: Date, default: null, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: SUPPLY_STATUSES, default: "available" },
    // Set only for a request-specific offer. Ordinary supply never has it (null/missing).
    targetDemand: { type: mongoose.Schema.Types.ObjectId, ref: "Demand", default: null },
  },
  { timestamps: true }
);
// createdAt order is the FIFO priority used later by matching.
supplySchema.index({ status: 1, createdAt: 1 });
supplySchema.index({ approvalStatus: 1, createdAt: 1 });

// One active targeted offer per farmer per demand. Ordinary supply has no
// targetDemand, so it is outside this index. Cancelled offers allow re-offers.
supplySchema.index(
  { farmer: 1, targetDemand: 1 },
  {
    unique: true,
    name: "one_active_targeted_offer_per_farmer_demand",
    partialFilterExpression: {
      targetDemand: { $type: "objectId" },
      status: "available",
    },
  }
);

const demandSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: String, required: true, trim: true, maxlength: 60 },
    quantity: { type: Number, required: true, min: 0 },
    matchedQuantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, enum: UNITS, required: true },
    neededDate: { type: Date, required: true },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: DEMAND_STATUSES, default: "open" },
  },
  { timestamps: true }
);
demandSchema.index({ status: 1, createdAt: 1 });

export const Supply = mongoose.models.Supply || mongoose.model("Supply", supplySchema);
export const Demand = mongoose.models.Demand || mongoose.model("Demand", demandSchema);