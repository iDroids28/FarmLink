import mongoose from "mongoose";

export const NOTICE_TYPES = [
  "match_created", "match_confirmed", "match_declined", "match_cancelled", "application_result",
];

const noticeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTICE_TYPES, required: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 300 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
noticeSchema.index({ user: 1, createdAt: -1 });

export const Notice = mongoose.models.UserNotice || mongoose.model("UserNotice", noticeSchema, "user_notices");

// A notification problem must never fail the user's real request.
export async function notify(user, type, title, message) {
  try {
    await Notice.create({ user, type, title, message });
  } catch (err) {
    console.error("Notice error:", err);
  }
}