import mongoose from "mongoose";

export const MATCH_STATUSES = ["pending_confirmation", "confirmed", "declined", "cancelled"];

const matchSchema = new mongoose.Schema(
  {
    demand: { type: mongoose.Schema.Types.ObjectId, ref: "Demand", required: true, index: true },
    supply: { type: mongoose.Schema.Types.ObjectId, ref: "Supply", required: true, index: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Snapshot of what both sides need to see, so views never expose the other party.
    product: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    location: { type: String, required: true },
    neededDate: { type: Date, required: true },
    availabilityDate: { type: Date, required: true },
    status: { type: String, enum: MATCH_STATUSES, default: "pending_confirmation" },
  },
  { timestamps: true }
);
matchSchema.index({ farmer: 1, createdAt: -1 });
matchSchema.index({ buyer: 1, createdAt: -1 });

export const Match = mongoose.models.Match || mongoose.model("Match", matchSchema);