import mongoose from "mongoose";
const { Schema } = mongoose;

const requirementSchema = new Schema(
  {
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true },
    product: { type: String, required: true, trim: true, maxlength: 40 },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    neededDate: { type: String, required: true }, // YYYY-MM-DD
    location: { type: String, required: true, trim: true, maxlength: 100 },
    targetPrice: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 300, default: "" },
    matched: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Partially Matched", "Fully Matched", "Closed"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

const supplySchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    farmerName: { type: String, required: true },
    category: { type: String, required: true },
    product: { type: String, required: true, trim: true, maxlength: 40 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // per unit
    availableDate: { type: String, required: true },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    status: { type: String, enum: ["Available", "Sold Out", "Removed"], default: "Available" },
  },
  { timestamps: true }
);

const preOrderSchema = new Schema(
  {
    supply: { type: Schema.Types.ObjectId, ref: "Supply", required: true },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerName: { type: String, required: true },
    farmer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    farmerName: { type: String, required: true },
    product: { type: String, required: true },
    unit: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    neededDate: { type: String, required: true },
    notes: { type: String, trim: true, maxlength: 300, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Declined", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const Requirement = mongoose.models.Requirement || mongoose.model("Requirement", requirementSchema);
export const Supply = mongoose.models.Supply || mongoose.model("Supply", supplySchema);
export const PreOrder = mongoose.models.PreOrder || mongoose.model("PreOrder", preOrderSchema);