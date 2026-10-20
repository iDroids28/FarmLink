import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { otpLimiter } from "./security.js";
import { SAFE_MESSAGES, respondWithSafeError } from "./safeErrors.js";
import {
  sendPasswordResetOtpEmail,
  checkEmailConfig,
  describeMailError,
  acquireSendLock,
  releaseSendLock,
  isValidEmailAddress,
  EMAIL_SEND_FAILED_BODY,
} from "./emailService.js";

/* ---------------- EMAIL VALIDATION ---------------- */

// Legacy export name retained because server.js imports isGmail. It now accepts
// any valid recipient domain and shares the same validation as emailService.js.
export function isGmail(email) {
  return isValidEmailAddress(typeof email === "string" ? email.trim() : email);
}

/* ---------------- PASSWORD VALIDATION ----------------
   Must match getPasswordError() in src/AuthShared.js:
   ANY non-alphanumeric, non-space character counts as "special". */

export const PASSWORD_MAX_LENGTH = 64; // bcrypt only uses the first 72 bytes

export function passwordError(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (/\s/.test(password)) return "Password cannot contain spaces.";
  if (!/[A-Z]/.test(password)) return "Password must include at least 1 uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least 1 lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least 1 number.";
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return "Password must include at least 1 special character (e.g. @ # $ % ^ & * ! ?).";
  }
  return null;
}

const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000; // server-side cooldown between OTPs per email

function cleanEmailValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Constant-time comparison so response timing can't leak OTP digits.
function otpMatches(input, expected) {
  if (typeof input !== "string" || input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

async function deliverOtp(email, otp) {
  await sendPasswordResetOtpEmail(email, otp, OTP_TTL_MS / 60000);
}

/* ---------------- FORGOT PASSWORD ROUTER ---------------- */

export default function createForgotRouter({ User }) {
  const router = express.Router();
  const otpStore = new Map();

  // Remove expired codes so the Map can't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of otpStore) {
      if (now > rec.expiresAt) otpStore.delete(key);
    }
  }, 60 * 1000).unref();

  // Shared check used by verify + reset. Returns an error response or null.
  function checkOtp(cleanEmail, otp) {
    const record = otpStore.get(cleanEmail);
    if (!record) return { status: 400, error: "OTP not found or expired." };
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return { status: 400, error: "OTP has expired." };
    }
    if (!otpMatches(otp, record.otp)) {
      record.attempts += 1;
      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(cleanEmail);
        return { status: 429, error: "Too many incorrect attempts. Please request a new OTP." };
      }
      return { status: 400, error: "Invalid OTP." };
    }
    return null;
  }

  /* ---------------- SEND OTP ---------------- */

  router.post("/forgot/send-otp", otpLimiter, async (req, res) => {
    try {
      const cleanEmail = cleanEmailValue(req.body?.email);
      if (!cleanEmail) return res.status(400).json({ error: "Email is required." });
      if (!isGmail(cleanEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      // If global mail configuration is missing, all email addresses receive
      // the same configuration error; no account lookup is needed first.
      const config = checkEmailConfig();
      if (!config.ok) {
        console.error("[email] Cannot send password-reset OTP:", config.problems.join("; "));
        return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
      }

      // Keep the normal success response identical for existing/non-existing accounts.
      const genericResponse = {
        message: "If an account exists for that email, an OTP has been sent.",
      };
      const user = await User.findOne({ email: cleanEmail });
      if (!user) return res.json(genericResponse);

      const existing = otpStore.get(cleanEmail);
      if (existing && Date.now() - existing.sentAt < OTP_RESEND_MS) {
        return res.json(genericResponse);
      }

      const lockKey = `forgot:${cleanEmail}`;
      const lockToken = acquireSendLock(lockKey);
      if (!lockToken) {
        return res.status(429).json({
          error: "A code request is already being processed. Please try again shortly.",
        });
      }

      try {
        const otp = crypto.randomInt(100000, 1000000).toString();
        const previous = otpStore.get(cleanEmail);
        const entry = {
          otp,
          sentAt: Date.now(),
          expiresAt: Date.now() + OTP_TTL_MS,
          attempts: 0,
        };

        // Store first so an email that has been sent is immediately verifiable.
        otpStore.set(cleanEmail, entry);
        try {
          await deliverOtp(cleanEmail, otp);
        } catch (mailErr) {
          console.error("Password reset email failed:", describeMailError(mailErr));
          // Roll back only if another request hasn't replaced this entry.
          if (otpStore.get(cleanEmail) === entry) {
            if (previous) otpStore.set(cleanEmail, previous);
            else otpStore.delete(cleanEmail);
          }
          return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
        }

        return res.json(genericResponse);
      } finally {
        releaseSendLock(lockKey, lockToken);
      }
    } catch (err) {
      respondWithSafeError(res, err, "Send OTP error", SAFE_MESSAGES.unprocessed);
    }
  });

  /* ---------------- VERIFY OTP ---------------- */

  router.post("/forgot/verify-otp", otpLimiter, async (req, res) => {
    try {
      const failure = checkOtp(cleanEmailValue(req.body?.email), req.body?.otp);
      if (failure) return res.status(failure.status).json({ error: failure.error });
      res.json({ message: "OTP verified successfully." });
    } catch (err) {
      respondWithSafeError(res, err, "Verify OTP error");
    }
  });

  /* ---------------- RESET PASSWORD ---------------- */

  router.post("/forgot/reset-password", otpLimiter, async (req, res) => {
    try {
      const cleanEmail = cleanEmailValue(req.body?.email);
      const { otp, newPassword } = req.body || {};

      const failure = checkOtp(cleanEmail, otp);
      if (failure) return res.status(failure.status).json({ error: failure.error });

      if (typeof newPassword !== "string") {
        return res.status(400).json({ error: SAFE_MESSAGES.unprocessed });
      }
      const pwError = passwordError(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });

      const passwordHash = await bcrypt.hash(newPassword, 10);

      // New password + clear lockout + tokenVersion bump (logs out every
      // device that still holds an old session token).
      const updatedUser = await User.findOneAndUpdate(
        { email: cleanEmail },
        {
          password: passwordHash,
          failedLoginAttempts: 0,
          lockUntil: null,
          lockCount: 0,
          $inc: { tokenVersion: 1 },
        }
      );
      if (!updatedUser) {
        return res.status(400).json({ error: "OTP not found or expired." });
      }

      otpStore.delete(cleanEmail);
      res.json({ message: "Password reset successfully." });
    } catch (err) {
      respondWithSafeError(res, err, "Reset password error", SAFE_MESSAGES.unprocessed);
    }
  });

  return router;
}
