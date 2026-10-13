import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { SAFE_MESSAGES, isDatabaseUnavailable } from "./safeErrors.js";

/* =====================================================================
   SESSION & ACCOUNT SECURITY — JWT issued as an httpOnly cookie.
   ===================================================================== */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add a long random value to your .env file."
  );
}
if (JWT_SECRET.length < 32 && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is too short. Use at least 32 random characters.");
}

const SESSION_TTL = "2h"; // normal login (cookie ends when the browser closes)
const REMEMBER_TTL = "7d"; // "Remember Me"
const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;

export const COOKIE_NAME = "farmlink_token";

// "tv" = the user's tokenVersion. Changing a password increments it, which
// instantly invalidates every older token (all other devices are logged out).
export function signToken(user, remember = false) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, tv: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: remember ? REMEMBER_TTL : SESSION_TTL, algorithm: "HS256" }
  );
}

export function setAuthCookie(res, token, remember = false) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
  if (remember) options.maxAge = REMEMBER_MS;
  res.cookie(COOKIE_NAME, token, options);
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

/* =====================================================================
   AUTHENTICATION MIDDLEWARE
   1) verifies the JWT signature + expiry
   2) re-checks the user in the database, so a deleted user, a changed role
      or a revoked token (tokenVersion) stops working immediately.
   server.js registers the lookup with setUserLookup(...).
   ===================================================================== */

let userLookup = null;
export function setUserLookup(fn) {
  userLookup = fn;
}

export async function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Please log in to continue." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Your session has expired. Please log in again." });
  }

  try {
    const user = userLookup ? await userLookup(payload.sub) : null;
    if (userLookup) {
      if (!user || (user.tokenVersion || 0) !== (payload.tv || 0)) {
        clearAuthCookie(res);
        return res
          .status(401)
          .json({ error: "Your session has expired. Please log in again." });
      }
      // The role comes from the database, not from the token.
      req.user = { id: payload.sub, role: user.role };
    } else {
      req.user = { id: payload.sub, role: payload.role };
    }
    return next();
  } catch (err) {
    console.error("Authenticate error:", err);
    if (isDatabaseUnavailable(err)) {
      return res.status(503).json({ error: SAFE_MESSAGES.unavailable });
    }
    return res.status(500).json({ error: SAFE_MESSAGES.generic });
  }
}

/* =====================================================================
   AUTHORIZATION MIDDLEWARE (role-based access control)
   ===================================================================== */

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

/* =====================================================================
   RATE LIMITING
   ===================================================================== */

const limiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

export const authLimiter = limiter(20, "Too many attempts. Please try again later.");
export const loginLimiter = limiter(10, "Too many login attempts. Please try again later.");
export const otpLimiter = limiter(15, "Too many OTP attempts. Please try again later.");
export const writeLimiter = limiter(
  60,
  "Too many requests. Please try again later."
);
/* =====================================================================
   INPUT SANITIZATION (NoSQL operator injection)
   ===================================================================== */

function stripOperators(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(stripOperators);
    return obj;
  }
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key];
      } else {
        stripOperators(obj[key]);
      }
    }
  }
  return obj;
}

export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    stripOperators(req.body);
  }
  next();
}