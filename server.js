import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto"; // NEW
import cookieParser from "cookie-parser";
import helmet from "helmet";
import "dotenv/config";
import createSupplyRouter from "./supplyRoutes.js";
import createDemandRouter from "./demandRoutes.js";
import createAdminRouter from "./adminRoutes.js";
import createMatchRouter from "./matchRoutes.js";
import createFarmlinkRouter from "./Farmlinkroutes.js";
import createNoticeRouter from "./noticeRoutes.js";
import createRoleApplicationRouter from "./roleApplicationRoutes.js";
import createFarmerProfileRouter from "./farmerProfileRoutes.js";
import createProfileRouter from "./profileRoutes.js";
import createSettingsRouter from "./settingsRoutes.js";
import createRequestRouter from "./requestRoutes.js";
import createOrderPhotoRouter from "./orderPhotoRoutes.js";
import { EmailOtpChallenge } from "./emailOtpChallengeModel.js";


import createForgotRouter, {
  isGmail,
  passwordError,
} from "./forgotroutes.js";

import {
  authenticate,
  requireRole,
  authLimiter,
  loginLimiter,
  otpLimiter,
  sanitizeBody,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  setUserLookup,
} from "./security.js";

import {
  SAFE_MESSAGES,
  isDatabaseUnavailable,
  respondWithSafeError,
} from "./safeErrors.js";

import {
  sendSignupOtpEmail,
  sendLoginOtpEmail,
  sendPasswordChangeOtpEmail,
  checkEmailConfig,
  describeMailError,
  acquireSendLock,
  releaseSendLock,
  EMAIL_SEND_FAILED_BODY,
} from "./emailService.js";

// Warn at startup, but never print SMTP secrets. Requests will fail safely
// until the local .env contains a valid Gmail SMTP configuration.
{
  const { ok, problems } = checkEmailConfig();
  if (!ok) console.error("[email] OTP email is NOT configured:", problems.join("; "));
}

const app = express();

/* ---------------- CORE SECURITY MIDDLEWARE ---------------- */

// Sets safe HTTP response headers (X-Content-Type-Options, HSTS, etc.)
app.use(helmet());

// Set TRUST_PROXY=1 in .env when deployed behind a reverse proxy, so rate
// limiting sees each user's real IP.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));

// Only the known frontend origin(s) may call this API, and only they are
// allowed to send/receive the auth cookie. FRONTEND_ORIGIN can be a
// comma-separated list.
const ALLOWED_ORIGINS = (
  process.env.FRONTEND_ORIGIN || "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    exposedHeaders: ["Retry-After"],
  })
);

// Small limit for the whole API. Routes that accept a photo get more room:
//  - /api/supplies: product photo and reviews (a resized image, roughly 50-300 KB) -> 3 MB
//  - /api/order-photos and /api/requests/matches: the buyer's / farmer's photo of the products -> 400 KB
const jsonSmall = express.json({ limit: "100kb" });
const jsonPhoto = express.json({ limit: "400kb" });
const jsonSupply = express.json({ limit: "3mb" });
app.use((req, res, next) => {
  if (req.path.startsWith("/api/supplies")) return jsonSupply(req, res, next);
  if (req.path.startsWith("/api/order-photos") || req.path.startsWith("/api/requests/matches")) {
    return jsonPhoto(req, res, next);
  }
  return jsonSmall(req, res, next);
});
app.use(cookieParser());
app.use(sanitizeBody); // strip NoSQL-injection operators from every request body

// If the database is down, answer right away with a friendly message instead
// of letting requests hang and fail with a raw database error.
app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: SAFE_MESSAGES.unavailable });
  }
  next();
});

/* ---------------- PRODUCT MODEL ---------------- */

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    price: { type: Number, required: true, min: 0 },
    farmer: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

/* ---------------- PRODUCT INPUT VALIDATION ---------------- */

function productInputError(body) {
  const { name, price, farmer } = body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return "Product name is required.";
  }
  if (name.trim().length > 100) {
    return "Product name is too long.";
  }
  if (!farmer || typeof farmer !== "string" || !farmer.trim()) {
    return "Farmer name is required.";
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return "Price must be a positive number.";
  }
  return null;
}

/* ---------------- PRODUCT ROUTES ---------------- */

// Reading the product list only requires being logged in (any role).
app.get("/api/products", authenticate, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    respondWithSafeError(res, err, "Load products error");
  }
});

// Creating a product is restricted to farmers and admins — a buyer account
// has no business reason to create supply listings.
app.post(
  "/api/products",
  authenticate,
  requireRole("farmer", "admin"),
  async (req, res) => {
    try {
      const validationError = productInputError(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const { name, price, farmer } = req.body;
      const product = await Product.create({
        name: name.trim(),
        price,
        farmer: farmer.trim(),
      });

      res.status(201).json(product);
    } catch (err) {
      respondWithSafeError(res, err, "Create product error");
    }
  }
);

/* ---------------- USER MODEL ---------------- */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Password is stored as a HASH — never in plain text.
    password: {
      type: String,
      required: true,
    },

    // user (registered, no role yet) | farmer | buyer | admin
    role: {
      type: String,
      enum: ["user", "farmer", "buyer", "admin"],
      default: "user",
    },

    // Verification state for the Farmer / Business-Buyer application (Phase 2).
    // "legacy" = existing account whose role predates verification (access kept).
    verificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected", "legacy"],
      default: "none",
    },

    // Consent captured at signup (Privacy Controls requirement).
    consentAt: {
      type: Date,
      required: true,
    },

    // Account-lockout fields (Session & Account Security requirement).
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    // Optional email OTP on every login when enabled in Account & Security.
    twoFactorEnabled: { type: Boolean, default: false },

    // Bumped on password reset/change -> old session tokens stop working.
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // Number of lockouts in a row. Makes each lockout longer; reset on a correct login or password reset.
    lockCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// authenticate() re-checks role + tokenVersion in the database on every request.
setUserLookup((id) => User.findById(id).select("role tokenVersion").lean());

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCK_MS = 60 * 1000; // first lockout: 1 minute
const MAX_LOCK_MS = 60 * 60 * 1000; // never longer than 60 minutes
// 1st = 1 min, then 2, 4, 8, 16, 32, 60 (capped)
function lockDurationMs(lockCount) {
  return Math.min(BASE_LOCK_MS * 2 ** (lockCount - 1), MAX_LOCK_MS);
}
const DUMMY_HASH = bcrypt.hashSync("farmlink-dummy-password", 10);

/* ---------------- PENDING SIGNUP MODEL (NEW) ----------------
   A sign-up waits here until the email code is entered. Only after the
   correct code is the real User account created. MongoDB deletes expired
   rows by itself (TTL index on expiresAt). The code is stored only as a hash. */

const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    consentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingSignup = mongoose.model("PendingSignup", pendingSignupSchema);

const SIGNUP_CODE_TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
const SIGNUP_RESEND_MS = 30 * 1000; // wait 30 seconds before a new code
const SIGNUP_MAX_ATTEMPTS = 5; // wrong tries before the sign-up is cancelled

function newSignupCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashSignupCode(email, code) {
  return crypto
    .createHash("sha256")
    .update(`${email}:${code}:${process.env.JWT_SECRET || ""}`)
    .digest("hex");
}

function codeMatches(email, code, storedHash) {
  const a = Buffer.from(hashSignupCode(email, code));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const PENDING_RESTORE_FIELDS = [
  "name",
  "passwordHash",
  "codeHash",
  "attempts",
  "lastSentAt",
  "consentAt",
  "expiresAt",
];

// Restore the previous state only if this request's new hash is still stored.
// This prevents a failed older request from overwriting a newer request.
async function rollbackPendingSignup(email, newHash, previous) {
  try {
    if (previous) {
      const restore = {};
      for (const field of PENDING_RESTORE_FIELDS) {
        if (previous[field] !== undefined) restore[field] = previous[field];
      }
      await PendingSignup.updateOne(
        { email, codeHash: newHash },
        { $set: restore }
      );
    } else {
      await PendingSignup.deleteOne({ email, codeHash: newHash });
    }
  } catch (err) {
    // Do not log codes or credential data.
    console.error("Signup OTP rollback failed:", err?.name || "Error");
  }
}

// Write the new hash/expiry first, then deliver the email. If delivery fails,
// conditionally restore the exact prior state (or remove a newly-created row).
async function persistAndDeliverSignupCode({ email, code, filter, newState, upsert }) {
  const previous = await PendingSignup.findOneAndUpdate(
    filter,
    { $set: newState },
    { upsert, returnDocument: "before", setDefaultsOnInsert: true }
  ).lean();

  if (!previous && !upsert) return { ok: false, conflict: true };

  try {
    await sendSignupOtpEmail(email, code, SIGNUP_CODE_TTL_MS / 60000);
    return { ok: true, conflict: false };
  } catch (mailErr) {
    console.error("Signup OTP email failed:", describeMailError(mailErr));
    await rollbackPendingSignup(email, newState.codeHash, previous);
    return { ok: false, conflict: false };
  }
}

/* ---------------- VALIDATION ---------------- */

const NAME_REGEX = /^[a-zA-Z\s'-]+$/;

function isValidName(value) {
  const name = (value || "").trim();

  return (
    name.length > 0 &&
    name.length <= 100 &&
    NAME_REGEX.test(name)
  );
}

function isValidEmail(value) {
  return isGmail(
    (value || "").trim().toLowerCase()
  );
}

function publicUser(user) {
  // Never send the password hash (or other internal fields) to the client.
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    twoFactorEnabled: user.twoFactorEnabled === true,
  };
}

/* ---------------- SIGNUP (step 1: validate + send code) ---------------- */

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, consent } = req.body; // role is never read from the client

    // Required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "All fields are required.",
      });
    }

    // Fields must be plain text (blocks objects/arrays sent by a crafted request).
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        error: SAFE_MESSAGES.unprocessed,
      });
    }

    // Privacy: signup cannot proceed without explicit consent to data use.
    if (consent !== true) {
      return res.status(400).json({
        error: "You must agree to the privacy notice to create an account.",
      });
    }

    // Name validation
    if (!isValidName(name)) {
      return res.status(400).json({
        error:
          "Name can only contain letters, spaces, hyphens, and apostrophes.",
      });
    }

    // Email validation
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error:
          "Please enter a valid email address.",
      });
    }

    // Password validation
    const pwError = passwordError(password);

    if (pwError) {
      return res.status(400).json({
        error: pwError,
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check existing account
    const existing = await User.findOne({
      email: cleanEmail,
    });

    if (existing) {
      return res.status(409).json({
        error: "An account with that email already exists.",
      });
    }

    // Fail before writing pending signup state if SMTP is not configured.
    const emailCheck = checkEmailConfig();
    if (!emailCheck.ok) {
      console.error("[email] Cannot send signup OTP:", emailCheck.problems.join("; "));
      return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
    }

    // Hash password now, so the plain password is never stored anywhere.
    const passwordHash = await bcrypt.hash(password, 10);
    const code = newSignupCode();
    const now = new Date();
    const lockKey = `signup:${cleanEmail}`;
    const lockToken = acquireSendLock(lockKey);
    if (!lockToken) {
      return res.status(429).json({
        error: "Please wait a moment before requesting another code.",
      });
    }

    try {
      const result = await persistAndDeliverSignupCode({
        email: cleanEmail,
        code,
        filter: { email: cleanEmail },
        upsert: true,
        newState: {
          name: name.trim(),
          passwordHash,
          codeHash: hashSignupCode(cleanEmail, code),
          attempts: 0,
          lastSentAt: now,
          consentAt: now,
          expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
        },
      });
      if (!result.ok) {
        if (result.conflict) {
          return res.status(409).json({ error: "Your verification request changed. Please try again." });
        }
        return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
      }
    } finally {
      releaseSendLock(lockKey, lockToken);
    }

    // No account and no session yet: the user must enter the code first.
    res.status(200).json({
      message: "Verification code sent.",
      email: cleanEmail,
      resendAfterSeconds: SIGNUP_RESEND_MS / 1000,
    });
  } catch (err) {
    respondWithSafeError(res, err, "Signup error");
  }
});

/* ---------------- SIGNUP (step 2: check the code, create the account) ---------------- */

app.post("/api/auth/signup/verify", authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (typeof email !== "string" || typeof code !== "string") {
      return res.status(400).json({ error: SAFE_MESSAGES.unprocessed });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Enter the 6-digit code." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pending = await PendingSignup.findOne({ email: cleanEmail });

    if (!pending || pending.expiresAt <= new Date()) {
      if (pending) await PendingSignup.deleteOne({ _id: pending._id });
      return res.status(400).json({
        error: "That code has expired. Please sign up again.",
      });
    }

    if (pending.attempts >= SIGNUP_MAX_ATTEMPTS) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return res.status(400).json({
        error: "Too many wrong codes. Please sign up again.",
      });
    }

    if (!codeMatches(cleanEmail, code, pending.codeHash)) {
      const updated = await PendingSignup.findByIdAndUpdate(
        pending._id,
        { $inc: { attempts: 1 } },
        { returnDocument: "after" }
      );
      const left = Math.max(0, SIGNUP_MAX_ATTEMPTS - (updated?.attempts || 0));
      if (left === 0) {
        await PendingSignup.deleteOne({ _id: pending._id });
        return res.status(400).json({
          error: "Too many wrong codes. Please sign up again.",
        });
      }
      return res.status(400).json({
        error: `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.`,
      });
    }

    // Correct code. Someone could have registered this email in the meantime.
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      await PendingSignup.deleteOne({ _id: pending._id });
      return res.status(409).json({
        error: "An account with that email already exists.",
      });
    }

    // Every new account is a plain registered account. Farmer / Business-Buyer
    // access comes later through an admin-approved application.
    await User.create({
      name: pending.name,
      email: cleanEmail,
      password: pending.passwordHash,
      role: "user",
      consentAt: pending.consentAt,
    });

    await PendingSignup.deleteOne({ _id: pending._id });

    // No session is created at signup: the user logs in on the next screen.
    res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    // Two verifications at the same moment: the unique email index rejects the second.
    if (err && err.code === 11000) {
      console.error("Signup duplicate email:", err);
      return res.status(409).json({
        error: "An account with that email already exists.",
      });
    }
    respondWithSafeError(res, err, "Signup verify error");
  }
});

/* ---------------- SIGNUP (resend a new code) ---------------- */

app.post("/api/auth/signup/resend", authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (typeof email !== "string") {
      return res.status(400).json({ error: SAFE_MESSAGES.unprocessed });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pending = await PendingSignup.findOne({ email: cleanEmail });

    if (!pending) {
      return res.status(400).json({
        error: "This sign-up has expired. Please sign up again.",
      });
    }

    const waitMs = SIGNUP_RESEND_MS - (Date.now() - pending.lastSentAt.getTime());
    if (waitMs > 0) {
      return res.status(400).json({
        error: "Please wait a few seconds before asking for a new code.",
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }

    const emailCheck = checkEmailConfig();
    if (!emailCheck.ok) {
      console.error("[email] Cannot send signup OTP:", emailCheck.problems.join("; "));
      return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
    }

    const code = newSignupCode();
    const now = new Date();
    const lockKey = `signup:${cleanEmail}`;
    const lockToken = acquireSendLock(lockKey);
    if (!lockToken) {
      return res.status(429).json({
        error: "Please wait a moment before requesting another code.",
      });
    }

    try {
      const result = await persistAndDeliverSignupCode({
        email: cleanEmail,
        code,
        // Compare-and-swap: only replace the code observed before cooldown check.
        filter: { email: cleanEmail, codeHash: pending.codeHash },
        upsert: false,
        newState: {
          codeHash: hashSignupCode(cleanEmail, code),
          attempts: 0,
          lastSentAt: now,
          expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
        },
      });
      if (result.conflict) {
        return res.status(409).json({
          error: "Your verification request changed. Please try again.",
        });
      }
      if (!result.ok) return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
    } finally {
      releaseSendLock(lockKey, lockToken);
    }

    res.json({
      message: "A new code was sent.",
      resendAfterSeconds: SIGNUP_RESEND_MS / 1000,
    });
  } catch (err) {
    respondWithSafeError(res, err, "Signup resend error");
  }
});

const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_OTP_RESEND_MS = 30 * 1000;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

function hashEmailOtpChallenge(challengeId) {
  return crypto.createHash("sha256")
    .update(`farmlink-email-otp-challenge:${challengeId}:${process.env.JWT_SECRET || ""}`)
    .digest("hex");
}

function hashEmailOtpCode(userId, purpose, code) {
  return crypto.createHash("sha256")
    .update(`farmlink-email-otp:${userId}:${purpose}:${code}:${process.env.JWT_SECRET || ""}`)
    .digest("hex");
}

function emailOtpCodeMatches(userId, purpose, code, storedHash) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code) || typeof storedHash !== "string") return false;
  const a = Buffer.from(hashEmailOtpCode(userId, purpose, code));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function maskEmail(email) {
  const [local = "", domain = ""] = String(email || "").split("@");
  return `${local ? local.slice(0, 1) : "*"}${"*".repeat(Math.min(5, Math.max(3, local.length - 1)))}@${domain}`;
}

class OtpEmailDeliveryError extends Error {
  constructor(original) {
    super("Could not deliver the email verification code.");
    this.name = "OtpEmailDeliveryError";
    this.original = original;
  }
}

async function createAndSendEmailOtp({ user, purpose, remember = false, newPasswordHash = null }) {
  const challengeId = crypto.randomBytes(32).toString("hex");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const now = new Date();
  const record = await EmailOtpChallenge.create({
    user: user._id,
    purpose,
    challengeHash: hashEmailOtpChallenge(challengeId),
    codeHash: hashEmailOtpCode(user._id, purpose, code),
    newPasswordHash,
    remember,
    tokenVersion: user.tokenVersion || 0,
    attempts: 0,
    lastSentAt: now,
    expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
  });

  try {
    if (purpose === "login") {
      await sendLoginOtpEmail(user.email, code, EMAIL_OTP_TTL_MS / 60000);
    } else {
      await sendPasswordChangeOtpEmail(user.email, code, EMAIL_OTP_TTL_MS / 60000);
    }
  } catch (mailErr) {
    await EmailOtpChallenge.deleteOne({ _id: record._id, codeHash: record.codeHash }).catch(() => {});
    throw new OtpEmailDeliveryError(mailErr);
  }

  // Invalidate older challenges only after the new email was accepted.
  await EmailOtpChallenge.deleteMany({ user: user._id, purpose, _id: { $ne: record._id } }).catch((err) => {
    console.error("Could not clear older email OTP challenges:", err?.name || "Error");
  });

  return {
    challengeId,
    email: maskEmail(user.email),
    resendAfterSeconds: EMAIL_OTP_RESEND_MS / 1000,
    expiresInSeconds: EMAIL_OTP_TTL_MS / 1000,
  };
}

async function resendEmailOtpChallenge(record, purpose) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const newCodeHash = hashEmailOtpCode(record.user, purpose, code);
  const now = new Date();
  const previous = {
    codeHash: record.codeHash,
    attempts: record.attempts,
    lastSentAt: record.lastSentAt,
    expiresAt: record.expiresAt,
  };
  const swapped = await EmailOtpChallenge.findOneAndUpdate(
    { _id: record._id, codeHash: record.codeHash, purpose },
    { $set: {
      codeHash: newCodeHash,
      attempts: 0,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
    } },
    { returnDocument: "after" }
  ).lean();
  if (!swapped) return { conflict: true };

  const user = await User.findById(record.user);
  if (!user) {
    await EmailOtpChallenge.deleteOne({ _id: record._id, codeHash: newCodeHash }).catch(() => {});
    return { expired: true };
  }
  try {
    if (purpose === "login") await sendLoginOtpEmail(user.email, code, EMAIL_OTP_TTL_MS / 60000);
    else await sendPasswordChangeOtpEmail(user.email, code, EMAIL_OTP_TTL_MS / 60000);
  } catch (mailErr) {
    const restored = await EmailOtpChallenge.updateOne(
      { _id: record._id, codeHash: newCodeHash },
      { $set: previous }
    ).catch(() => ({ modifiedCount: 0 }));
    if (!restored.modifiedCount) {
      console.error("Email OTP resend rollback could not restore previous state.");
    }
    throw new OtpEmailDeliveryError(mailErr);
  }
  return { conflict: false, email: maskEmail(user.email), resendAfterSeconds: EMAIL_OTP_RESEND_MS / 1000 };
}

async function recordWrongEmailOtp(record) {
  const updated = await EmailOtpChallenge.findOneAndUpdate(
    { _id: record._id, attempts: { $lt: EMAIL_OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (!updated || updated.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await EmailOtpChallenge.deleteOne({ _id: record._id }).catch(() => {});
    return { blocked: true };
  }
  return { blocked: false, attemptsLeft: EMAIL_OTP_MAX_ATTEMPTS - updated.attempts };
}

/* ---------------- LOGIN ---------------- */

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // "Remember Me": only an explicit boolean true counts.
    const remember = req.body.remember === true;

    if (!email || !password) {
      return res.status(400).json({
        error: "Enter your email and password to continue.",
      });
    }

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: SAFE_MESSAGES.unprocessed,
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error:
          "Please enter a valid email address.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find user in MongoDB
    const user = await User.findOne({
      email: cleanEmail,
    });

    // Same generic error whether the email doesn't exist or the password is
    // wrong — this avoids leaking which accounts exist (user enumeration).
    const genericError = { error: "Incorrect email or password." };

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // same timing as a real check
      return res.status(401).json(genericError);
    }

    // Account lockout: too many recent failures temporarily blocks login,
    // even with the correct password, to slow down brute-force attempts.
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: Math.max(1, Math.ceil((user.lockUntil - new Date()) / 1000)),
      });
    }

    // Compare password with hashed password
    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      // $inc is atomic: parallel wrong guesses can't undercount.
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: "after" }
      );
      if (updated && updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        const nextCount = (user.lockCount || 0) + 1;
        const lockMs = lockDurationMs(nextCount);
        // Only ONE request can apply the lock: the filter needs the counter
        // to still be at the limit, so parallel requests cannot double-escalate.
        const locked = await User.findOneAndUpdate(
          { _id: user._id, failedLoginAttempts: { $gte: MAX_FAILED_ATTEMPTS } },
          {
            $set: {
              failedLoginAttempts: 0,
              lockCount: nextCount,
              lockUntil: new Date(Date.now() + lockMs),
            },
          }
        );
        let seconds = Math.ceil(lockMs / 1000);
        if (!locked) {
          const fresh = await User.findById(user._id).select("lockUntil").lean();
          if (fresh?.lockUntil) {
            seconds = Math.max(1, Math.ceil((fresh.lockUntil - Date.now()) / 1000));
          }
        }
        return res.status(423).json({
          error: "Too many failed attempts. Please try again later.",
          retryAfterSeconds: seconds,
        });
      }
      return res.status(401).json(genericError);
    }

    // When email-based 2FA is enabled, do not create a session until its OTP is verified.
    if (user.twoFactorEnabled === true) {
      const config = checkEmailConfig();
      if (!config.ok) {
        console.error("[email] Cannot send login OTP:", config.problems.join("; "));
        return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
      }
      const lockKey = `login-otp:${String(user._id)}`;
      const lockToken = acquireSendLock(lockKey);
      if (!lockToken) {
        return res.status(429).json({ error: "A login code is already being sent. Please wait a moment." });
      }
      try {
        let challenge;
        try {
          challenge = await createAndSendEmailOtp({ user, purpose: "login", remember });
        } catch (err) {
          if (err instanceof OtpEmailDeliveryError) {
            console.error("Login OTP email failed:", describeMailError(err.original));
            return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
          }
          throw err;
        }
        return res.status(200).json({
          message: "Login verification code sent.",
          requiresTwoFactor: true,
          ...challenge,
        });
      } finally {
        releaseSendLock(lockKey, lockToken);
      }
    }

    // Successful login — reset lockout counters.
    if (user.failedLoginAttempts || user.lockUntil || user.lockCount) {
      await User.findByIdAndUpdate(user._id, {
        failedLoginAttempts: 0,
        lockCount: 0,
        lockUntil: null,
      });
    }

    // Remember Me -> 7-day token + persistent cookie.
    // Otherwise  -> 2-hour token + cookie that ends when the browser closes.
    const token = signToken(user, remember);
    setAuthCookie(res, token, remember);

    res.status(200).json({
      message: "Login successful.",
      user: publicUser(user),
    });

  } catch (err) {
    respondWithSafeError(res, err, "Login error");
  }
});

/* ---------------- LOGIN TWO-FACTOR OTP ---------------- */

app.post("/api/auth/login/verify-otp", otpLimiter, async (req, res) => {
  try {
    const { challengeId, code } = req.body || {};
    if (typeof challengeId !== "string" || !/^[a-f0-9]{64}$/i.test(challengeId) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Enter the 6-digit verification code." });
    }
    const challengeHash = hashEmailOtpChallenge(challengeId);
    const challenge = await EmailOtpChallenge.findOne({ challengeHash, purpose: "login" }).lean();
    if (!challenge || challenge.expiresAt <= new Date()) {
      if (challenge) await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({ error: "This login code has expired. Please log in again." });
    }
    if (challenge.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(429).json({ error: "Too many incorrect codes. Please log in again." });
    }

    const user = await User.findById(challenge.user);
    if (!user || user.twoFactorEnabled !== true || (user.tokenVersion || 0) !== (challenge.tokenVersion || 0)) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id }).catch(() => {});
      return res.status(400).json({ error: "This login verification is no longer valid. Please log in again." });
    }
    if (!emailOtpCodeMatches(user._id, "login", code, challenge.codeHash)) {
      const attempt = await recordWrongEmailOtp(challenge);
      if (attempt.blocked) return res.status(429).json({ error: "Too many incorrect codes. Please log in again." });
      return res.status(400).json({ error: `Incorrect code. ${attempt.attemptsLeft} ${attempt.attemptsLeft === 1 ? "try" : "tries"} left.` });
    }

    const consumed = await EmailOtpChallenge.findOneAndDelete({
      _id: challenge._id,
      codeHash: challenge.codeHash,
      attempts: challenge.attempts,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!consumed) return res.status(409).json({ error: "This code was already used or changed. Please try again." });

    user.failedLoginAttempts = 0;
    user.lockCount = 0;
    user.lockUntil = null;
    await user.save();
    setAuthCookie(res, signToken(user, challenge.remember === true), challenge.remember === true);
    return res.status(200).json({ message: "Login successful.", user: publicUser(user) });
  } catch (err) {
    respondWithSafeError(res, err, "Login OTP verification error");
  }
});

app.post("/api/auth/login/resend-otp", otpLimiter, async (req, res) => {
  try {
    const { challengeId } = req.body || {};
    if (typeof challengeId !== "string" || !/^[a-f0-9]{64}$/i.test(challengeId)) {
      return res.status(400).json({ error: "Please start the login process again." });
    }
    const challengeHash = hashEmailOtpChallenge(challengeId);
    const challenge = await EmailOtpChallenge.findOne({ challengeHash, purpose: "login" });
    if (!challenge || challenge.expiresAt <= new Date()) {
      if (challenge) await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({ error: "This login code has expired. Please log in again." });
    }
    const user = await User.findById(challenge.user);
    if (!user || user.twoFactorEnabled !== true || (user.tokenVersion || 0) !== (challenge.tokenVersion || 0)) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id }).catch(() => {});
      return res.status(400).json({ error: "This login verification is no longer valid. Please log in again." });
    }
    const waitMs = EMAIL_OTP_RESEND_MS - (Date.now() - new Date(challenge.lastSentAt).getTime());
    if (waitMs > 0) {
      return res.status(429).json({ error: "Please wait before requesting another code.", retryAfterSeconds: Math.ceil(waitMs / 1000) });
    }
    const lockKey = `login-otp-resend:${String(challenge.user)}`;
    const lockToken = acquireSendLock(lockKey);
    if (!lockToken) return res.status(429).json({ error: "A login code is already being sent. Please wait." });
    try {
      const config = checkEmailConfig();
      if (!config.ok) return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
      const result = await resendEmailOtpChallenge(challenge.toObject(), "login");
      if (result.conflict) return res.status(409).json({ error: "Your login code changed. Please try again." });
      if (result.expired) return res.status(400).json({ error: "Please log in again." });
      return res.json({ message: "A new login code was sent.", email: result.email, resendAfterSeconds: result.resendAfterSeconds });
    } catch (err) {
      if (err instanceof OtpEmailDeliveryError) {
        console.error("Login OTP resend failed:", describeMailError(err.original));
        return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
      }
      throw err;
    } finally {
      releaseSendLock(lockKey, lockToken);
    }
  } catch (err) {
    respondWithSafeError(res, err, "Login OTP resend error");
  }
});

/* ---------------- SESSION CHECK / LOGOUT ---------------- */

// Lets the frontend restore a session after a page refresh without
// storing the user object anywhere client-readable.
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Session no longer valid." });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    respondWithSafeError(res, err, "Session check error");
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out." });
});

/* ---------------- CHANGE PASSWORD (email OTP confirmation) ---------------- */

// Step 1: verify the current password, hash the proposed new password, and email an OTP.
app.post("/api/auth/change-password", authenticate, authLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ error: SAFE_MESSAGES.unprocessed });
    }
    const pwError = passwordError(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: "Session no longer valid." });
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: "Your current password is incorrect." });
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ error: "Your new password must be different from the current one." });
    }

    const config = checkEmailConfig();
    if (!config.ok) {
      console.error("[email] Cannot send password-change OTP:", config.problems.join("; "));
      return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
    }
    const lockKey = `change-password-otp:${String(user._id)}`;
    const lockToken = acquireSendLock(lockKey);
    if (!lockToken) return res.status(429).json({ error: "A password-change code is already being sent. Please wait." });
    try {
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      let challenge;
      try {
        challenge = await createAndSendEmailOtp({ user, purpose: "change_password", newPasswordHash });
      } catch (err) {
        if (err instanceof OtpEmailDeliveryError) {
          console.error("Password-change OTP email failed:", describeMailError(err.original));
          return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
        }
        throw err;
      }
      return res.status(200).json({ message: "Password-change verification code sent.", ...challenge });
    } finally {
      releaseSendLock(lockKey, lockToken);
    }
  } catch (err) {
    respondWithSafeError(res, err, "Change password request error");
  }
});

// Step 2: the new password is not saved until the email OTP is correct.
app.post("/api/auth/change-password/verify-otp", authenticate, otpLimiter, async (req, res) => {
  try {
    const { challengeId, code } = req.body || {};
    if (typeof challengeId !== "string" || !/^[a-f0-9]{64}$/i.test(challengeId) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Enter the 6-digit verification code." });
    }
    const challengeHash = hashEmailOtpChallenge(challengeId);
    const challenge = await EmailOtpChallenge.findOne({
      challengeHash,
      purpose: "change_password",
      user: req.user.id,
    }).lean();
    if (!challenge || challenge.expiresAt <= new Date()) {
      if (challenge) await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({ error: "This password-change code has expired. Please start again." });
    }
    if (challenge.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(429).json({ error: "Too many incorrect codes. Please request a new code." });
    }
    const user = await User.findById(req.user.id);
    if (!user || (user.tokenVersion || 0) !== (challenge.tokenVersion || 0)) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id }).catch(() => {});
      return res.status(401).json({ error: "Your session changed. Please start the password-change process again." });
    }
    if (!challenge.newPasswordHash) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id }).catch(() => {});
      return res.status(400).json({ error: "Please start the password-change process again." });
    }
    if (!emailOtpCodeMatches(user._id, "change_password", code, challenge.codeHash)) {
      const attempt = await recordWrongEmailOtp(challenge);
      if (attempt.blocked) return res.status(429).json({ error: "Too many incorrect codes. Please request a new code." });
      return res.status(400).json({ error: `Incorrect code. ${attempt.attemptsLeft} ${attempt.attemptsLeft === 1 ? "try" : "tries"} left.` });
    }

    const consumed = await EmailOtpChallenge.findOneAndDelete({
      _id: challenge._id,
      codeHash: challenge.codeHash,
      attempts: challenge.attempts,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!consumed) return res.status(409).json({ error: "This code was already used or changed. Please try again." });

    user.password = challenge.newPasswordHash;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lockCount = 0;
    await user.save();
    await EmailOtpChallenge.deleteMany({ user: user._id }).catch(() => {});
    // Keep this device signed in with a fresh token; all other sessions are invalidated by tokenVersion.
    setAuthCookie(res, signToken(user));
    return res.json({ message: "Password changed successfully." });
  } catch (err) {
    respondWithSafeError(res, err, "Change password verification error");
  }
});

app.post("/api/auth/change-password/resend-otp", authenticate, otpLimiter, async (req, res) => {
  try {
    const { challengeId } = req.body || {};
    if (typeof challengeId !== "string" || !/^[a-f0-9]{64}$/i.test(challengeId)) {
      return res.status(400).json({ error: "Please start the password-change process again." });
    }
    const challenge = await EmailOtpChallenge.findOne({
      challengeHash: hashEmailOtpChallenge(challengeId),
      purpose: "change_password",
      user: req.user.id,
    });
    if (!challenge || challenge.expiresAt <= new Date()) {
      if (challenge) await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({ error: "This code has expired. Please start the password-change process again." });
    }
    const user = await User.findById(req.user.id);
    if (!user || (user.tokenVersion || 0) !== (challenge.tokenVersion || 0)) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id }).catch(() => {});
      return res.status(401).json({ error: "Your session changed. Please start again." });
    }
    const waitMs = EMAIL_OTP_RESEND_MS - (Date.now() - new Date(challenge.lastSentAt).getTime());
    if (waitMs > 0) {
      return res.status(429).json({ error: "Please wait before requesting another code.", retryAfterSeconds: Math.ceil(waitMs / 1000) });
    }
    const lockKey = `change-password-otp-resend:${String(user._id)}`;
    const lockToken = acquireSendLock(lockKey);
    if (!lockToken) return res.status(429).json({ error: "A code is already being sent. Please wait." });
    try {
      const result = await resendEmailOtpChallenge(challenge.toObject(), "change_password");
      if (result.conflict) return res.status(409).json({ error: "Your code changed. Please try again." });
      if (result.expired) return res.status(400).json({ error: "Please start again." });
      return res.json({ message: "A new password-change code was sent.", email: result.email, resendAfterSeconds: result.resendAfterSeconds });
    } catch (err) {
      if (err instanceof OtpEmailDeliveryError) {
        console.error("Password-change OTP resend failed:", describeMailError(err.original));
        return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
      }
      throw err;
    } finally {
      releaseSendLock(lockKey, lockToken);
    }
  } catch (err) {
    respondWithSafeError(res, err, "Password-change OTP resend error");
  }
});

/* ---------------- FORGOT PASSWORD ---------------- */

// POST /api/auth/forgot/send-otp
// POST /api/auth/forgot/verify-otp
// POST /api/auth/forgot/reset-password

app.use(
  "/api/auth",
  createForgotRouter({ User })
);
app.use("/api/supplies", createSupplyRouter());
app.use("/api/demands", createDemandRouter());
app.use("/api/admin", createAdminRouter({ User }));
app.use("/api/matches", createMatchRouter());
app.use("/api/farmlink", createFarmlinkRouter({ User }));
app.use("/api/notifications", createNoticeRouter());
app.use("/api/role-applications", createRoleApplicationRouter({ User }));
app.use("/api/farmers", createFarmerProfileRouter());
app.use("/api/profile", createProfileRouter({ User })); // profile page data (MongoDB "profiles")
app.use("/api/settings", createSettingsRouter({ User })); // Settings page (all roles) — must stay BELOW "const User" and ABOVE the 404 handler
app.use("/api/requests", createRequestRouter()); // Pre-orders: buyer sends, farmer accepts or declines — must stay ABOVE the 404 handler
console.log("Requests route ready: /api/requests");
app.use("/api/order-photos", createOrderPhotoRouter()); // Buyer's photo of the products on an order (saved in MongoDB) — must stay ABOVE the 404 handler
console.log("Order photos route ready: /api/order-photos");

/* ---------------- 404 HANDLER ---------------- */

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

/* ---------------- CENTRALIZED ERROR HANDLER ----------------
   Any error passed to next(err), or thrown in a synchronous handler,
   ends up here. The client always gets a plain, friendly message — never
   a stack trace or internal details — while the real error is logged
   server-side for debugging. ---------------- */

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  // Broken or oversized JSON sent to the API
  if (err && (err.type === "entity.parse.failed" || err.type === "entity.too.large")) {
    return res
      .status(err.type === "entity.too.large" ? 413 : 400)
      .json({ error: SAFE_MESSAGES.unprocessed });
  }

  if (isDatabaseUnavailable(err)) {
    return res.status(503).json({ error: SAFE_MESSAGES.unavailable });
  }

  res.status(500).json({ error: SAFE_MESSAGES.generic });
});

/* ---------------- MONGODB CONNECTION ---------------- */

// Collections used by orders, reviews, photos and requirement delivery. Photos and
// reviews are saved in these collections, so they stay after logging out and in.
const FEATURE_MODELS = [
  "PreOrderRequest",
  "MatchOrder",
  "MatchPhoto",
  "ProductReview",
  "DemandDelivery",
  "OrderPhoto",
];

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");

    // Accounts with NO role at all become plain registered accounts. Accounts that
    // already have a role (farmer, buyer, admin) are never touched here.
    const fixed = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: "user", verificationStatus: "none" } }
    );
    if (fixed.modifiedCount) {
      console.log(`Set role "user" on ${fixed.modifiedCount} account(s) that had no role`);
    }

    // Make sure the feature collections have their indexes (for example "one photo per
    // order" and "one review per order"). This only adds missing indexes: it never
    // deletes data.
    for (const name of FEATURE_MODELS) {
      try {
        await mongoose.models[name]?.createIndexes();
      } catch (err) {
        console.error(`Index setup problem for ${name}:`, err?.message || err);
      }
    }

    // Old accepted orders that have no step yet start at "Accepted".
    try {
      const filled = await mongoose.models.PreOrderRequest?.updateMany(
        { status: "confirmed", $or: [{ orderStatus: { $exists: false } }, { orderStatus: "" }] },
        { $set: { orderStatus: "accepted" } }
      );
      if (filled?.modifiedCount) {
        console.log(`Set the "accepted" step on ${filled.modifiedCount} older order(s)`);
      }
    } catch (err) {
      console.error("Order step update problem:", err?.message || err);
    }

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });
  })
  .catch((err) => {
    // Full details go to the server console only. Users never see this.
    console.error("MongoDB connection error:", err);
  });