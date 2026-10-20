import mongoose from "mongoose";

const emailOtpChallengeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: ["login", "change_password"], required: true, index: true },
    challengeHash: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true },
    newPasswordHash: { type: String, default: null },
    remember: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

emailOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailOtpChallengeSchema.index({ user: 1, purpose: 1, createdAt: -1 });

export const EmailOtpChallenge =
  mongoose.models.FarmLinkEmailOtpChallenge ||
  mongoose.model("FarmLinkEmailOtpChallenge", emailOtpChallengeSchema, "farmlink_email_otp_challenges");
