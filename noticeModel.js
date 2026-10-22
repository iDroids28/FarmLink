import mongoose from "mongoose";

export const NOTICE_TYPES = [
  "match_created", "match_confirmed", "match_declined", "match_cancelled", "application_result",
  "request_created", "request_confirmed", "request_declined", "request_cancelled",
  // Supply approval flow
  "supply_submitted", "supply_approved", "supply_rejected",
  // Order tracking (farmer moves a pre-order through its steps)
  "order_status",
  // A buyer rated a product after the order was complete
  "product_rated",
  // Broadcast a buyer demand to farmers who do not already receive a match alert.
  "buyer_demand_created", "demand_removed_by_admin",
];

const noticeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTICE_TYPES, required: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 300 },
    read: { type: Boolean, default: false },
    match: { type: mongoose.Schema.Types.ObjectId, default: null },
    // The supply request (or supply listing) this notice is about
    request: { type: mongoose.Schema.Types.ObjectId, default: null },
    // A buyer demand that farmers can open from a broadcast notification.
    demand: { type: mongoose.Schema.Types.ObjectId, ref: "Demand", default: null, index: true },
  },
  { timestamps: true }
);
noticeSchema.index({ user: 1, createdAt: -1 });

export const Notice = mongoose.models.UserNotice || mongoose.model("UserNotice", noticeSchema, "user_notices");

// A notification problem must never fail the user's real request.
export async function notify(user, type, title, message, match = null, request = null, demand = null) {
  try {
    await Notice.create({
      user, type, title, message,
      ...(match ? { match } : {}),
      ...(request ? { request } : {}),
      ...(demand ? { demand } : {}),
    });
  } catch (err) {
    console.error("Notice error:", err);
  }
}