import mongoose from "mongoose";

const { Schema } = mongoose;

const applicationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: String,
    email: String,
    farmName: { type: String, required: true },
    location: { type: String, required: true },
    contact: { type: String, required: true },
    products: { type: String, required: true },
    farmSize: String,
    description: String,
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending", index: true },
  },
  { timestamps: true }
);

const requirementSchema = new Schema(
  {
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerName: String,
    product: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: "kg" },
    neededDate: { type: String, required: true }, // YYYY-MM-DD
    location: { type: String, required: true },
    targetPrice: Number,
    notes: String,
    closed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const supplySchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    farmerName: String,
    product: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: "kg" },
    availableDate: { type: String, required: true }, // YYYY-MM-DD
  },
  { timestamps: true }
);

const notificationSchema = new Schema(
  {
    audience: { type: String, enum: ["all", "farmers", "buyers", "user"], required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User" }, // only when audience === "user"
    title: { type: String, required: true },
    message: { type: String, required: true },
    announcement: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Application = mongoose.model("FarmlinkApplication", applicationSchema, "farmlink_applications");
export const Requirement = mongoose.model("FarmlinkRequirement", requirementSchema, "farmlink_requirements");
export const Supply = mongoose.model("FarmlinkSupply", supplySchema, "farmlink_supplies");
export const Notification = mongoose.model("FarmlinkNotification", notificationSchema, "farmlink_notifications");