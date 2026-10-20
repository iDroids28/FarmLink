import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { authenticate, authLimiter, writeLimiter } from "./security.js";
import { isGmail } from "./forgotroutes.js";
import { SAFE_MESSAGES, respondWithSafeError } from "./safeErrors.js";
import { EmailOtpChallenge } from "./emailOtpChallengeModel.js";
import { checkEmailConfig, EMAIL_SEND_FAILED_BODY } from "./emailService.js";

/* SETTINGS API (mounted at /api/settings)
     GET  /          -> this user's settings (defaults filled in)
     PUT  /          -> save security / notifications / privacy / preferences
     POST /email     -> change the account email (needs current password)
   Password change already exists: POST /api/auth/change-password */

const ROLE_NOTIFICATIONS = {
  buyer: ["match", "requirement", "supply", "application", "system"],
  farmer: ["match", "supply", "businessRequests", "application", "system"],
  admin: ["applications", "matches", "system"],
  user: ["application", "system"],
};

const VISIBILITY = ["only_me", "members"];
const LANGUAGES = ["en", "fil"];
const THEMES = ["light", "dark", "system"];
const UNITS = ["metric", "imperial"];

const settingsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    phone: { type: String, default: "" },
    notifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    privacy: {
      profileVisibility: { type: String, enum: VISIBILITY, default: "only_me" },
      showActivity: { type: Boolean, default: false },
    },
    preferences: {
      language: { type: String, enum: LANGUAGES, default: "en" },
      theme: { type: String, enum: THEMES, default: "light" },
      units: { type: String, enum: UNITS, default: "metric" },
    },
  },
  { timestamps: true }
);

const UserSettings =
  mongoose.models.UserSettings || mongoose.model("UserSettings", settingsSchema);

function buildSettings(role, doc, userDoc = null) {
  const keys = ROLE_NOTIFICATIONS[role] || ROLE_NOTIFICATIONS.user;
  const stored = doc?.notifications || {};
  const notifications = {};
  for (const k of keys) notifications[k] = typeof stored[k] === "boolean" ? stored[k] : true;
  return {
    twoFactorEnabled: userDoc?.twoFactorEnabled === true,
    notifications,
    privacy: {
      profileVisibility: doc?.privacy?.profileVisibility || "only_me",
      showActivity: !!doc?.privacy?.showActivity,
    },
    preferences: {
      language: doc?.preferences?.language || "en",
      theme: doc?.preferences?.theme || "light",
      units: doc?.preferences?.units || "metric",
    },
  };
}


export default function createSettingsRouter({ User }) {
  const router = express.Router();
  router.use(authenticate);

  router.get("/", async (req, res) => {
    try {
      const [doc, userDoc] = await Promise.all([
        UserSettings.findOne({ user: req.user.id }).lean(),
        User.findById(req.user.id).select("twoFactorEnabled").lean(),
      ]);
      res.json({ settings: buildSettings(req.user.role, doc, userDoc) });
    } catch (err) {
      respondWithSafeError(res, err, "Load settings error");
    }
  });

  router.put("/", writeLimiter, async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const $set = {};

      if ("twoFactorEnabled" in body) {
        if (typeof body.twoFactorEnabled !== "boolean") {
          return res.status(400).json({ error: SAFE_MESSAGES.unprocessed });
        }
        if (body.twoFactorEnabled) {
          const config = checkEmailConfig();
          if (!config.ok) {
            console.error("[email] Cannot enable two-factor authentication:", config.problems.join("; "));
            return res.status(503).json({ ...EMAIL_SEND_FAILED_BODY });
          }
        }
        await User.findByIdAndUpdate(req.user.id, { $set: { twoFactorEnabled: body.twoFactorEnabled } });
        if (!body.twoFactorEnabled) {
          await EmailOtpChallenge.deleteMany({ user: req.user.id, purpose: "login" }).catch(() => {});
        }
      }

      if (body.notifications && typeof body.notifications === "object") {
        const allowed = ROLE_NOTIFICATIONS[req.user.role] || ROLE_NOTIFICATIONS.user;
        for (const k of allowed) {
          if (typeof body.notifications[k] === "boolean") {
            $set[`notifications.${k}`] = body.notifications[k];
          }
        }
      }

      if (body.privacy && typeof body.privacy === "object" && req.user.role !== "admin") {
        if (VISIBILITY.includes(body.privacy.profileVisibility)) {
          $set["privacy.profileVisibility"] = body.privacy.profileVisibility;
        }
        if (typeof body.privacy.showActivity === "boolean") {
          $set["privacy.showActivity"] = body.privacy.showActivity;
        }
      }

      if (body.preferences && typeof body.preferences === "object") {
        const p = body.preferences;
        if (LANGUAGES.includes(p.language)) $set["preferences.language"] = p.language;
        if (THEMES.includes(p.theme)) $set["preferences.theme"] = p.theme;
        if (UNITS.includes(p.units)) $set["preferences.units"] = p.units;
      }

      let doc;
      if (Object.keys($set).length === 0) {
        doc = await UserSettings.findOne({ user: req.user.id }).lean();
      } else {
        doc = await UserSettings.findOneAndUpdate(
          { user: req.user.id },
          { $set },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean();
      }
      const userDoc = await User.findById(req.user.id).select("twoFactorEnabled").lean();
      res.json({ settings: buildSettings(req.user.role, doc, userDoc) });
    } catch (err) {
      respondWithSafeError(res, err, "Save settings error");
    }
  });

  router.post("/email", authLimiter, async (req, res) => {
    try {
      const { newEmail, password } = req.body || {};
      if (typeof newEmail !== "string" || typeof password !== "string" || password.length > 128) {
        return res.status(400).json({ error: SAFE_MESSAGES.unprocessed });
      }
      const cleanEmail = newEmail.trim().toLowerCase();
      if (!isGmail(cleanEmail)) {
        return res.status(400).json({
          error: "Email must be a valid Gmail address ending with @gmail.com.",
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) return res.status(401).json({ error: "Session no longer valid." });

      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: "Your current password is incorrect." });
      }
      if (user.email === cleanEmail) {
        return res.status(400).json({ error: "That is already your email address." });
      }
      if (await User.findOne({ email: cleanEmail }).select("_id").lean()) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }

      user.email = cleanEmail;
      await user.save();
      res.json({ message: "Email updated.", email: cleanEmail });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }
      respondWithSafeError(res, err, "Change email error");
    }
  });

  return router;
}