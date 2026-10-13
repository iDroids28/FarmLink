import mongoose from "mongoose";

const { Schema } = mongoose;

// Metadata only. The file itself lives in private storage on the server and the
// stored file name / path is never sent to the browser.
const documentSchema = new Schema({
  kind: { type: String, enum: ["photo", "govId", "proof", "permit"], required: true },
  docType: { type: String, required: true },
  customType: { type: String, default: "" },
  originalName: { type: String, default: "" },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  storedName: { type: String, required: true },
});

const roleApplicationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["farmer", "buyer"], required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    // Shared
    mobile: { type: String, required: true },

    // Farmer application
    fullName: String,
    email: String,
    address: String,
    farmLocation: String,
    farmingType: String,
    products: String,
    farmerStatus: String,
    // Filled only when farmerStatus is "Other"; empty otherwise.
    farmerStatusCustom: { type: String, default: "" },

    // Business / Buyer application
    businessName: String,
    businessType: String,
    // Filled only when businessType is "Other"; empty otherwise.
    businessTypeCustom: { type: String, default: "" },
    representative: String,
    businessAddress: String,
    businessEmail: String,
    // No longer collected. Kept so applications submitted earlier still display.
    interestedProducts: String,

    documents: [documentSchema],

    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A user can have only ONE pending application at a time, enforced by the
// database (so two quick clicks / two tabs cannot create two). Rejected and
// approved records are kept and never overwritten.
roleApplicationSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "one_pending_application_per_user",
  }
);

export const RoleApplication = mongoose.model(
  "RoleApplication",
  roleApplicationSchema,
  "farmlink_role_applications"
);