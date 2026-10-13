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
import createFarmlinkRouter from "./FarmlinkRoutes.js";
import createNoticeRouter from "./noticeRoutes.js";
import createRoleApplicationRouter from "./roleApplicationRoutes.js";
import createFarmerProfileRouter from "./farmerProfileRoutes.js";
import createProfileRouter from "./profileRoutes.js";


import createForgotRouter, {
  isGmail,
  passwordError,
} from "./forgotroutes.js";

import {
  authenticate,
  requireRole,
  authLimiter,
  loginLimiter,
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

app.use(express.json({ limit: "100kb" })); // small limit: this app never needs huge payloads
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

// Development "email": the code is printed in the terminal running this server.
// For production, replace this function with a real email sender.
function announceSignupCode(email, code) {
  console.log("");
  console.log("==============================================");
  console.log(" FarmLink signup verification code");
  console.log(` Email : ${email}`);
  console.log(` Code  : ${code}   (valid for 10 minutes)`);
  console.log("==============================================");
  console.log("");
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

    // Gmail validation
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error:
          "Email must be a valid Gmail address ending with @gmail.com.",
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

    // Hash password now, so the plain password is never stored anywhere.
    const passwordHash = await bcrypt.hash(password, 10);

    // Make a 6-digit code and keep ONLY its hash. Signing up again with the
    // same email simply replaces the older pending sign-up.
    const code = newSignupCode();
    const now = new Date();
    await PendingSignup.findOneAndUpdate(
      { email: cleanEmail },
      {
        $set: {
          name: name.trim(),
          passwordHash,
          codeHash: hashSignupCode(cleanEmail, code),
          attempts: 0,
          lastSentAt: now,
          consentAt: now,
          expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    announceSignupCode(cleanEmail, code);

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
        { new: true }
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

    const code = newSignupCode();
    const now = new Date();
    pending.codeHash = hashSignupCode(cleanEmail, code);
    pending.attempts = 0;
    pending.lastSentAt = now;
    pending.expiresAt = new Date(now.getTime() + SIGNUP_CODE_TTL_MS);
    await pending.save();

    announceSignupCode(cleanEmail, code);

    res.json({
      message: "A new code was sent.",
      resendAfterSeconds: SIGNUP_RESEND_MS / 1000,
    });
  } catch (err) {
    respondWithSafeError(res, err, "Signup resend error");
  }
});

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
          "Email must be a valid Gmail address ending with @gmail.com.",
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
        { new: true }
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

/* ---------------- CHANGE PASSWORD (logged-in users) ---------------- */
// Used by the Change Password forms on the Profile pages.

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

    user.password = await bcrypt.hash(newPassword, 10);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // logs out other devices
    await user.save();

    // Keep THIS device logged in with a fresh token.
    setAuthCookie(res, signToken(user));
    res.json({ message: "Password changed." });
  } catch (err) {
    respondWithSafeError(res, err, "Change password error");
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