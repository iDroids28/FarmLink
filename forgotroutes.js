import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { otpLimiter } from "./security.js";
import { SAFE_MESSAGES, respondWithSafeError } from "./safeErrors.js";

/* ---------------- EMAIL VALIDATION ---------------- */

export function isGmail(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
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

/* ---------------- OTP DELIVERY ----------------
   If SMTP_HOST (+ SMTP_USER / SMTP_PASS / SMTP_FROM) is set in .env the OTP
   is e-mailed with nodemailer. Without SMTP, the OTP is printed in the server
   terminal ONLY in development. In production nothing is printed. */

async function deliverOtp(email, otp) {
  if (process.env.SMTP_HOST) {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your FarmLink password reset code",
      text: `Your FarmLink verification code is ${otp}. It expires in 5 minutes. If you did not request it, you can ignore this email.`,
    });
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("=================================================");
    console.log(`DEV ONLY - OTP for ${email}: ${otp}`);
    console.log("=================================================");
  } else {
    console.error("OTP not delivered: configure SMTP_* in .env for production.");
  }
}

/* ---------------- FORGOT PASSWORD ROUTER ---------------- */

export default function createForgotRouter({ User }) {
  const router = express.Router();
  const otpStore = new Map();

  // Remove expired codes so the Map can't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of otpStore) if (now > rec.expiresAt) otpStore.delete(key);
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
        return res.status(400).json({ error: "Please enter a valid Gmail address." });
      }

      // Same answer whether or not the account exists (no user enumeration).
      const genericResponse = {
        message: "If an account exists for that email, an OTP has been sent.",
      };

      const user = await User.findOne({ email: cleanEmail });
      if (!user) return res.json(genericResponse);

      // Cooldown: ignore repeat requests inside 60s (still the same response).
      const existing = otpStore.get(cleanEmail);
      if (existing && Date.now() - existing.sentAt < OTP_RESEND_MS) {
        return res.json(genericResponse);
      }

      const otp = crypto.randomInt(100000, 1000000).toString(); // CSPRNG
      otpStore.set(cleanEmail, {
        otp,
        sentAt: Date.now(),
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
      });

      try {
        await deliverOtp(cleanEmail, otp);
      } catch (mailErr) {
        // Log it, but keep the generic answer so nothing leaks to the client.
        console.error("OTP delivery error:", mailErr);
      }

      return res.json(genericResponse);
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
      await User.findOneAndUpdate(
        { email: cleanEmail },
        {
          password: passwordHash,
          failedLoginAttempts: 0,
          lockUntil: null,
          lockCount: 0,
          $inc: { tokenVersion: 1 },
        }
      );

      otpStore.delete(cleanEmail);
      res.json({ message: "Password reset successfully." });
    } catch (err) {
      respondWithSafeError(res, err, "Reset password error", SAFE_MESSAGES.unprocessed);
    }
  });

  return router;
}