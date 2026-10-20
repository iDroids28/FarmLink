import mongoose from "mongoose";

export const REQUEST_STATUSES = ["pending_confirmation", "confirmed", "declined", "cancelled"];
export const REQUEST_KINDS = ["preorder", "supply_request"];

const requestSchema = new mongoose.Schema(
  {
    supply: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: REQUEST_KINDS, default: "supply_request" },
    product: { type: String, required: true },
    unit: { type: String, required: true },
    supplyType: { type: String, default: "onhand" },
    location: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0.01 },
    neededDate: { type: String, required: true },
    notes: { type: String, default: "", maxlength: 300 },
    status: { type: String, enum: REQUEST_STATUSES, default: "pending_confirmation", index: true },
  },
  { timestamps: true }
);

export const SupplyRequest =
  mongoose.models.SupplyRequest || mongoose.model("SupplyRequest", requestSchema, "supply_requests");