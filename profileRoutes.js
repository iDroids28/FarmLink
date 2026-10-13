import express from "express";
import mongoose from "mongoose";
import { authenticate } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";

/* ---------------- PROFILE MODEL (MongoDB: "profiles" collection) ---------------- */

const profileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // Personal information (all roles)
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    address: { type: String, trim: true, maxlength: 200, default: "" },
    photo: { type: String, default: "" }, // small JPEG data URL (resized in the browser)

    // Buyer only
    business: {
      name: { type: String, trim: true, maxlength: 100, default: "" },
      orgType: { type: String, trim: true, maxlength: 60, default: "" },
      address: { type: String, trim: true, maxlength: 200, default: "" },
      contactPerson: { type: String, trim: true, maxlength: 100, default: "" },
    },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      requestMatch: { type: Boolean, default: true },
      preorder: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
    },

    // Farmer only
    farm: {
      name: { type: String, trim: true, maxlength: 100, default: "" },
      location: { type: String, trim: true, maxlength: 200, default: "" },
      products: { type: String, trim: true, maxlength: 200, default: "" },
      size: { type: String, trim: true, maxlength: 60, default: "" },
      expectedHarvest: { type: String, trim: true, maxlength: 80, default: "" },
    },
  },
  { timestamps: true }
);

const Profile = mongoose.models.Profile || mongoose.model("Profile", profileSchema);

/* ---------------- HELPERS ---------------- */

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const bool = (v) => (typeof v === "boolean" ? v : undefined);

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// Photo must be a small image data URL (global body limit is 100kb).
function cleanPhoto(v) {
  if (v === "") return "";
  if (typeof v !== "string") return undefined;
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return undefined;
  if (v.length > 80000) return undefined;
  return v;
}

function accountId(user) {
  const tail = String(user._id).slice(-3).toUpperCase();
  if (user.role === "admin") return `AD-${tail.padStart(4, "0")}`;
  const d = new Date(user.createdAt || Date.now());
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `FL-${ymd}-${tail}`;
}

function accountTypeLabel(role) {
  return (
    { buyer: "Buyer Only", farmer: "Farmer / Seller", admin: "Administrator", user: "Registered account" }[role] || role
  );
}

function shape(user, profile) {
  const p = profile ? profile.toObject() : {};
  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    profile: {
      phone: p.phone || "",
      address: p.address || "",
      photo: p.photo || "",
      business: { name: "", orgType: "", address: "", contactPerson: "", ...(p.business || {}) },
      notificationPrefs: {
        email: true,
        requestMatch: true,
        preorder: false,
        marketing: false,
        ...(p.notificationPrefs || {}),
      },
      farm: { name: "", location: "", products: "", size: "", expectedHarvest: "", ...(p.farm || {}) },
    },
    account: {
      accountId: accountId(user),
      role: user.role,
      accountType: accountTypeLabel(user.role),
      createdAt: user.createdAt,
      status: user.lockUntil && user.lockUntil > new Date() ? "Locked" : "Active",
      verificationStatus: user.verificationStatus,
    },
  };
}

/* ---------------- ROUTER ---------------- */

export default function createProfileRouter({ User }) {
  const router = express.Router();

  // GET /api/profile/me -> the logged-in user's own profile
  router.get("/me", authenticate, async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(401).json({ error: "Session no longer valid." });
      const profile = await Profile.findOne({ userId: user._id });
      res.json(shape(user, profile));
    } catch (err) {
      respondWithSafeError(res, err, "Load profile error");
    }
  });

  // PUT /api/profile/me -> update own profile.
  // Accepted fields depend on the role stored in the database, never on the client.
  router.put("/me", authenticate, async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(401).json({ error: "Session no longer valid." });

      const b = req.body || {};
      const set = {};

      // --- shared (all roles) ---
      const phone = str(b.phone, 20);
      if (phone !== undefined) {
        if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
          return res.status(400).json({ error: "Enter a valid contact number." });
        }
        set.phone = phone;
      }
      const address = str(b.address, 200);
      if (address !== undefined) set.address = address;

      if (b.photo !== undefined) {
        const photo = cleanPhoto(b.photo);
        if (photo === undefined) {
          return res.status(400).json({ error: "That photo is too large or not a supported image." });
        }
        set.photo = photo;
      }

      // Name lives on the User model.
      if (b.name !== undefined) {
        const name = str(b.name, 100);
        if (!name || !/^[a-zA-Z\s'-]+$/.test(name)) {
          return res.status(400).json({ error: "Name can only contain letters, spaces, ' and -." });
        }
        user.name = name;
        await user.save();
      }

      // --- buyer only ---
      if (user.role === "buyer") {
        const biz = b.business || {};
        const business = clean({
          name: str(biz.name, 100),
          orgType: str(biz.orgType, 60),
          address: str(biz.address, 200),
          contactPerson: str(biz.contactPerson, 100),
        });
        for (const [k, v] of Object.entries(business)) set[`business.${k}`] = v;

        const n = b.notificationPrefs || {};
        const prefs = clean({
          email: bool(n.email),
          requestMatch: bool(n.requestMatch),
          preorder: bool(n.preorder),
          marketing: bool(n.marketing),
        });
        for (const [k, v] of Object.entries(prefs)) set[`notificationPrefs.${k}`] = v;
      }

      // --- farmer only ---
      if (user.role === "farmer") {
        const f = b.farm || {};
        const farm = clean({
          name: str(f.name, 100),
          location: str(f.location, 200),
          products: str(f.products, 200),
          size: str(f.size, 60),
          expectedHarvest: str(f.expectedHarvest, 80),
        });
        for (const [k, v] of Object.entries(farm)) set[`farm.${k}`] = v;
      }

      const profile = await Profile.findOneAndUpdate(
        { userId: user._id },
        Object.keys(set).length ? { $set: set } : { $setOnInsert: {} },
        { new: true, upsert: true, runValidators: true }
      );

      res.json(shape(user, profile));
    } catch (err) {
      respondWithSafeError(res, err, "Update profile error");
    }
  });

  return router;
}