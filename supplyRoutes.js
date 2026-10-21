import express from "express";
import mongoose from "mongoose";
import { Supply, Demand } from "./farmModels.js";
import { PreOrderRequest } from "./requestRoutes.js";
import { authenticate, requireRole, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { isValidId, round2 } from "./farmValidation.js";
import { matchSupplySafe } from "./matchingEngine.js";

const MAX_ACTIVE_LISTINGS = 100;
const NOT_FOUND = { error: "Supply not found." };

// Shared category and unit choices for supply creation and public listings.
export const CATEGORIES = [
  "Vegetables", "Fruits", "Rice", "Corn & Grains", "Root Crops", "Legumes & Beans",
  "Herbs & Spices", "Mushrooms", "Coconut Products", "Coffee & Cacao", "Sugarcane",
  "Dairy & Milk", "Eggs", "Livestock", "Poultry", "Meat", "Fish & Seafood",
  "Honey & Bee Products", "Seeds & Seedlings", "Flowers & Ornamental Plants",
  "Fiber Crops", "Farm By-products", "Other Farm Products",
];
const UNITS = ["kg", "ton", "sack", "crate", "piece", "bundle", "ml", "liter", "gal", "bottle", "tray", "dozen"];
const PRODUCT_NAME_RE = /^\p{L}{2,60}$/u;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKeyInManila(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function dateKeyOffset(dayKey, offset) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}
function isOnHandExpired(supply) {
  if (!supply || supply.supplyType !== "onhand") return false;
  const expiryKey = supply.expiresAt
    ? dayKeyInManila(new Date(supply.expiresAt))
    : supply.createdAt ? dateKeyOffset(dayKeyInManila(new Date(supply.createdAt)), 4) : "";
  return Boolean(expiryKey && expiryKey < dayKeyInManila());
}
function onHandExpiryListingFilter() {
  const today = dayKeyInManila();
  const todayStart = parseDateOnly(today);
  const legacyCutoff = new Date(Date.now() - 4 * DAY_MS);
  return {
    $or: [
      { supplyType: { $ne: "onhand" } },
      { supplyType: "onhand", expiresAt: { $gte: todayStart } },
      { supplyType: "onhand", $or: [
        { expiresAt: { $exists: false }, createdAt: { $gte: legacyCutoff } },
        { expiresAt: null, createdAt: { $gte: legacyCutoff } },
      ] },
    ],
  };
}
async function expireOldOnHandListings() {
  const todayStart = parseDateOnly(dayKeyInManila());
  const legacyCutoff = new Date(Date.now() - 4 * DAY_MS);
  const unreserved = { $or: [{ reservedQuantity: { $lte: 0 } }, { reservedQuantity: null }, { reservedQuantity: { $exists: false } }] };
  await Supply.updateMany({
    status: "available",
    supplyType: "onhand",
    $and: [unreserved, { $or: [
      { expiresAt: { $lt: todayStart } },
      { $and: [ { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] }, { createdAt: { $lt: legacyCutoff } } ] },
    ] }],
  }, { $set: { status: "expired", availableQuantity: 0 } });
}
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 1_500_000; // the browser shrinks photos before upload

const MATCH_TYPES = ["match_created", "match_confirmed", "match_declined", "match_cancelled"];
const BUYER_REQUEST_TYPES = ["request_confirmed", "request_declined"];
const SUPPLY_RESULT_TYPES = ["supply_approved", "supply_rejected", "product_rated"];

const baseQuantity = (s) => (s.supplyType === "onhand" ? s.actualQuantity : s.estimatedQuantity);

/* ---------------- Delivery fee (Pick Up is always free) ---------------- */

// 1-10 kg = 80, over 10 up to 50 kg = 120, over 50 up to 100 kg = 250,
// over 100 kg = 250 for every 100 kg (rounded up). Change the numbers here only.
export function deliveryFee(kg, fulfillment) {
  if (fulfillment !== "delivery") return 0;
  const q = Number(kg);
  if (!(q > 0)) return 0;
  if (q <= 10) return 80;
  if (q <= 50) return 120;
  if (q <= 100) return 250;
  return 250 * Math.ceil(q / 100);
}

/* ---------------- Reviews and requirement delivery (own collections) ---------------- */

const reviewSchema = new mongoose.Schema(
  {
    supply: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // one review per order
    farmer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true }
);
const ProductReview =
  mongoose.models.ProductReview || mongoose.model("ProductReview", reviewSchema, "product_reviews");

const demandDeliverySchema = new mongoose.Schema(
  {
    demand: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    fulfillment: { type: String, enum: ["pickup", "delivery"], default: "pickup" },
    deliveryAddress: { type: String, default: "", maxlength: 200 },
    deliveryFee: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);
const DemandDelivery =
  mongoose.models.DemandDelivery || mongoose.model("DemandDelivery", demandDeliverySchema, "demand_deliveries");

const round1 = (n) => Math.round(Number(n) * 10) / 10;
const NO_RATING = { avg: 0, count: 0 };

// Average rating and number of reviews for a list of supply ids (ObjectIds).
async function ratingsFor(ids) {
  if (!ids.length) return new Map();
  const rows = await ProductReview.aggregate([
    { $match: { supply: { $in: ids } } },
    { $group: { _id: "$supply", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg: round1(r.avg), count: r.count }]));
}

/* ---------------- Order steps (what the farmer moves an order through) ---------------- */

const STEPS = {
  delivery: [
    { id: "accepted", label: "Order Accepted", text: "Farmer confirmed your pre-order." },
    { id: "preparing", label: "Preparing Products", text: "Products are being harvested and packed." },
    { id: "ready_delivery", label: "Ready for Delivery", text: "Products are packed and awaiting dispatch." },
    { id: "out_for_delivery", label: "Out for Delivery", text: "Products have been dispatched." },
    { id: "delivered", label: "Delivered", text: "Your products were delivered." },
  ],
  pickup: [
    { id: "accepted", label: "Accepted", text: "Farmer confirmed your pre-order." },
    { id: "preparing", label: "Preparing", text: "Products are being harvested and packed." },
    { id: "packed", label: "Packed", text: "Your products are packed." },
    { id: "ready_pickup", label: "Ready for Pickup", text: "Your products are ready. You can pick them up now." },
    { id: "collected", label: "Collected", text: "You collected your products." },
    { id: "completed", label: "Completed", text: "This order is completed." },
  ],
};
const stepsFor = (r) => STEPS[r.fulfillment === "delivery" ? "delivery" : "pickup"];

function orderDto(r, extra = {}) {
  const steps = stepsFor(r);
  const current = r.orderStatus || (r.status === "confirmed" ? "accepted" : "");
  return {
    id: String(r._id),
    supplyId: String(r.supply),
    product: r.product,
    unit: r.unit,
    quantity: r.quantity,
    neededDate: r.neededDate,
    notes: r.notes,
    location: r.location,
    status: r.status,
    fulfillment: r.fulfillment === "delivery" ? "delivery" : "pickup",
    deliveryAddress: r.deliveryAddress || "",
    deliveryFee: Number(r.deliveryFee || 0),
    orderStatus: current,
    currentStep: steps.findIndex((s) => s.id === current),
    steps: steps.map(({ id, label }) => ({ id, label })),
    history: (r.orderHistory || []).map((h) => ({ status: h.status, at: h.at })),
    review: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ...extra,
  };
}

const reviewDto = (v) => (v ? { rating: v.rating, message: v.message || "", createdAt: v.createdAt } : null);

/* ---------------- Validation for the "Add Product" form ---------------- */
function readProductInput(body, { imageRequired }) {
  const b = body || {};
  const product = String(b.product || "").trim();
  if (!PRODUCT_NAME_RE.test(product)) {
    return { error: "Product name must use letters only, with no spaces, numbers, or special characters (2-60 letters)." };
  }
  if (!CATEGORIES.includes(b.category)) return { error: "Select a valid farm-product category." };
  const pricePerUnit = round2(Number(b.pricePerUnit));
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) return { error: "Enter a price greater than 0." };
  const unit = String(b.unit || "");
  if (!UNITS.includes(unit)) return { error: "Choose a valid quantity unit." };
  const supplyType = b.supplyType === "expected" ? "expected" : b.supplyType === "onhand" ? "onhand" : null;
  if (!supplyType) return { error: "Choose On Hand or Expected Harvest." };
  const quantity = round2(Number(b.quantity));
  if (!Number.isFinite(quantity) || quantity < 10) return { error: `Minimum quantity is 10 ${unit}.` };
  const location = String(b.location || "").trim();
  if (!location || location.length > 120) return { error: "Select a location." };

  const today = dayKeyInManila();
  const availabilityKey = String(b.availabilityDate || "");
  let availabilityDate;
  let expiresAt = null;
  if (supplyType === "expected") {
    availabilityDate = parseDateOnly(availabilityKey);
    if (!availabilityDate) return { error: "Harvest date is required for Expected Harvest." };
    if (availabilityKey < today) return { error: "Harvest date cannot be in the past." };
  } else {
    availabilityDate = parseDateOnly(today);
    const expiryKey = String(b.expiresAt || "");
    expiresAt = parseDateOnly(expiryKey);
    if (!expiresAt) return { error: "Expiry date is required for On Hand products." };
    if (expiryKey < today) return { error: "Expiry date cannot be in the past." };
    if (expiryKey > dateKeyOffset(today, 4)) return { error: "On Hand products can be listed for a maximum of 4 days." };
  }

  const description = String(b.description || "").trim().slice(0, 200);

  let image = b.image;
  if (image) {
    if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image)) {
      return { error: "Upload a JPG, PNG or WEBP image." };
    }
  } else if (imageRequired) {
    return { error: "Upload a product image." };
  } else {
    image = undefined; // keep the old image when editing
  }

  return {
    value: { product, category: b.category, pricePerUnit, unit, supplyType, quantity, location, availabilityDate, expiresAt, description, image },
  };
}

async function sendNotice(userId, type, title, message, id) {
  try {
    const mod = await import("./noticeModel.js");
    if (typeof mod.notify === "function") {
      await mod.notify(userId, type, title, String(message).slice(0, 300), null, id);
    }
  } catch (err) {
    console.error("Notice not sent:", err?.message || err);
  }
}

// Tells every admin that a product is waiting for approval.
async function notifyAdmins(title, message, id) {
  try {
    const admins = await mongoose.model("User").find({ role: "admin" }).select("_id").lean();
    await Promise.all(admins.map((a) => sendNotice(a._id, "supply_submitted", title, message, id)));
  } catch (err) {
    console.error("Admin notice not sent:", err?.message || err);
  }
}

async function userName(id, fallback) {
  try {
    const u = await mongoose.model("User").findById(id).select("name").lean();
    return u?.name || fallback;
  } catch {
    return fallback;
  }
}
const farmerName = (id) => userName(id, "A farmer");

async function namesFor(rows) {
  const ids = [...new Set(rows.map((r) => String(r.farmer)))];
  const users = ids.length
    ? await mongoose.model("User").find({ _id: { $in: ids } }).select("name").lean()
    : [];
  return new Map(users.map((u) => [String(u._id), u.name]));
}

/* ---------------- Farmer personal information ---------------- */

const REF_KEYS = ["user", "userId", "farmer", "owner", "account"];

async function loadFarmerProfile(farmerId) {
  const u = await mongoose.model("User").findById(farmerId).lean();
  if (!u) return null;

  const sources = [u];
  for (const [name, Model] of Object.entries(mongoose.models)) {
    if (!/profile|application/i.test(name)) continue;
    const keys = REF_KEYS.filter((k) => Model.schema.path(k));
    if (!keys.length) continue;
    try {
      const docs = await Model.find({ $or: keys.map((k) => ({ [k]: u._id })) })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      for (const doc of docs) {
        if (doc.type === "buyer") continue;
        sources.push(doc, doc.farmerProfile, doc.details, doc.data);
      }
    } catch {
      /* ignore this collection */
    }
  }

  const list = sources.filter(Boolean);
  const pick = (...keys) => {
    for (const o of list) {
      for (const k of keys) {
        let v = o[k];
        if (Array.isArray(v)) v = v.filter((x) => typeof x === "string" || typeof x === "number").join(", ");
        if (v === undefined || v === null || typeof v === "object") continue;
        if (String(v).trim() !== "") return String(v);
      }
    }
    return "";
  };

  return {
    id: String(u._id),
    name: pick("name", "fullName"),
    businessName: pick("businessName", "business", "farmName", "farm", "companyName"),
    email: pick("email"),
    phone: pick("phone", "mobile", "mobileNumber", "contactNumber", "phoneNumber"),
    address: pick("address", "farmAddress", "barangay"),
    location: pick("location", "farmLocation", "municipality", "city", "province"),
    farmSize: pick("farmSize", "farmArea", "landSize"),
    farmingType: pick("farmingType", "typeOfFarming"),
    crops: pick("crops", "mainCrops", "products"),
    about: pick("about", "description", "bio"),
    memberSince: u.createdAt || null,
  };
}

/* ---------------- Views ---------------- */

// What the owning farmer (or admin) sees.
function ownerView(s) {
  return {
    id: String(s._id),
    product: s.product,
    category: s.category,
    pricePerUnit: s.pricePerUnit,
    description: s.description,
    image: s.image,
    supplyType: s.supplyType,
    quantity: baseQuantity(s),
    estimatedQuantity: s.estimatedQuantity,
    actualQuantity: s.actualQuantity,
    reservedQuantity: s.reservedQuantity,
    availableQuantity: s.availableQuantity,
    unit: s.unit,
    availabilityDate: s.availabilityDate,
    expiresAt: s.expiresAt || null,
    location: s.location,
    status: s.status,
    approvalStatus: s.approvalStatus || "approved", // old records count as approved
    rejectionReason: s.rejectionReason || "",
    isOffer: Boolean(s.targetDemand),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// What buyers see: display name only (no id, email or phone).
function publicView(s, farmerName, rating) {
  return {
    id: String(s._id),
    farmerName: farmerName || "Farmer",
    product: s.product,
    category: s.category,
    pricePerUnit: s.pricePerUnit,
    description: s.description,
    image: s.image,
    supplyType: s.supplyType,
    availableQuantity: s.availableQuantity,
    unit: s.unit,
    availabilityDate: s.availabilityDate,
    expiresAt: s.expiresAt || null,
    location: s.location,
    status: s.status,
    rating: rating || NO_RATING,
    createdAt: s.createdAt,
  };
}

function applyInput(doc, v) {
  doc.product = v.product;
  doc.category = v.category;
  doc.pricePerUnit = v.pricePerUnit;
  doc.description = v.description;
  if (v.image) doc.image = v.image;
  doc.supplyType = v.supplyType;
  doc.unit = v.unit;
  doc.availabilityDate = v.availabilityDate;
  doc.expiresAt = v.expiresAt || null;
  doc.location = v.location;
  if (v.supplyType === "onhand") {
    doc.actualQuantity = v.quantity;
  } else {
    doc.estimatedQuantity = v.quantity;
    doc.actualQuantity = null;
  }
  doc.availableQuantity = Math.max(0, round2(baseQuantity(doc) - (doc.reservedQuantity || 0)));
}

export default function createSupplyRouter() {
  const router = express.Router();
  router.use(authenticate);

  // Red numbers on the sidebar. 0 means "show nothing".
  router.get("/counts", async (req, res) => {
    try {
      const out = { notifications: 0, matches: 0, requests: 0, supply: 0, supplyApprovals: 0, preorders: 0 };
      const role = req.user.role;

      let Notice = null;
      try {
        ({ Notice } = await import("./noticeModel.js"));
      } catch {
        /* notices not available: the numbers stay 0 */
      }
      const unread = async (types) =>
        Notice
          ? Notice.countDocuments({ user: req.user.id, read: false, ...(types ? { type: { $in: types } } : {}) })
          : 0;

      out.notifications = await unread();

      if (role === "buyer") {
        out.matches = await unread(MATCH_TYPES);
        out.requests = await unread(BUYER_REQUEST_TYPES); // My Requests: accepted / declined
        out.preorders = await unread(["order_status"]); // My Pre Orders: new order steps
      }

      if (role === "farmer") {
        out.matches = await unread(MATCH_TYPES);
        out.supply = await unread(SUPPLY_RESULT_TYPES); // My Supply: approved / rejected / rated
        out.requests = await PreOrderRequest.countDocuments({ owner: req.user.id, status: "pending_confirmation" });
      }

      if (role === "admin") {
        out.supplyApprovals = await Supply.countDocuments({ approvalStatus: "pending", targetDemand: null });
      }

      res.json(out);
    } catch (err) {
      respondWithSafeError(res, err, "Load counts error");
    }
  });

  /* ---------- Requirement delivery (Add Requirement: Pick Up or Delivery) ---------- */

  // Called right after a requirement is created. It saves the choice on the
  // buyer's newest requirement (created in the last 10 minutes).
  router.post("/demand-delivery", writeLimiter, requireRole("buyer"), async (req, res) => {
    try {
      const fulfillment = req.body?.fulfillment === "delivery" ? "delivery" : "pickup";
      const address = String(req.body?.deliveryAddress || "").trim().slice(0, 200);
      if (fulfillment === "delivery" && address.length < 5) {
        return res.status(400).json({ error: "Enter the delivery address." });
      }

      const demand = await Demand.findOne({ buyer: req.user.id }).sort({ createdAt: -1 }).select("_id quantity createdAt").lean();
      if (!demand || Date.now() - new Date(demand.createdAt).getTime() > 10 * 60 * 1000) {
        return res.status(404).json({ error: "No new requirement found." });
      }

      const fee = deliveryFee(demand.quantity, fulfillment);
      const doc = await DemandDelivery.findOneAndUpdate(
        { demand: demand._id },
        { $set: { buyer: req.user.id, fulfillment, deliveryAddress: fulfillment === "delivery" ? address : "", deliveryFee: fee } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.status(201).json({
        delivery: { demandId: String(doc.demand), fulfillment: doc.fulfillment, deliveryAddress: doc.deliveryAddress, deliveryFee: doc.deliveryFee },
      });
    } catch (err) {
      respondWithSafeError(res, err, "Save requirement delivery error");
    }
  });

  // My Requirements: the delivery choice of each requirement, keyed by requirement id.
  router.get("/demand-delivery", requireRole("buyer"), async (req, res) => {
    try {
      const rows = await DemandDelivery.find({ buyer: req.user.id }).limit(500).lean();
      const delivery = {};
      for (const d of rows) {
        delivery[String(d.demand)] = { fulfillment: d.fulfillment, deliveryAddress: d.deliveryAddress || "", deliveryFee: d.deliveryFee || 0 };
      }
      res.json({ delivery });
    } catch (err) {
      respondWithSafeError(res, err, "Load requirement delivery error");
    }
  });

  /* ---------- Pre-orders (buyer) and Order Management (farmer) ---------- */

  // Buyer sends a pre-order. The quantity is held right away, so Available drops.
  router.post("/orders", writeLimiter, requireRole("buyer"), async (req, res) => {
    try {
      await expireOldOnHandListings();
      const b = req.body || {};
      if (!isValidId(b.supplyId)) return res.status(404).json({ error: "Supply not found." });

      const qty = round2(Number(b.quantity));
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "Enter a quantity greater than 0." });

      const neededDate = String(b.neededDate || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(neededDate)) return res.status(400).json({ error: "Select the date you need it." });
      if (neededDate < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: "Date cannot be in the past." });

      const fulfillment = b.fulfillment === "delivery" ? "delivery" : b.fulfillment === "pickup" ? "pickup" : null;
      if (!fulfillment) return res.status(400).json({ error: "Choose Pick Up or Delivery." });
      const deliveryAddress = String(b.deliveryAddress || "").trim().slice(0, 200);
      if (fulfillment === "delivery" && deliveryAddress.length < 5) {
        return res.status(400).json({ error: "Enter the delivery address." });
      }
      const fee = deliveryFee(qty, fulfillment); // set by the server, never by the browser

      const supply = await Supply.findById(b.supplyId).lean();
      if (supply && isOnHandExpired(supply)) {
        if (Number(supply.reservedQuantity || 0) <= 0) {
          await Supply.updateOne({ _id: supply._id, status: "available" }, { $set: { status: "expired", availableQuantity: 0 } });
        }
        return res.status(404).json({ error: "This supply listing has expired." });
      }
      const approved = !supply?.approvalStatus || supply.approvalStatus === "approved";
      if (!supply || supply.status !== "available" || supply.targetDemand || !approved) {
        return res.status(404).json({ error: "This supply is no longer available." });
      }

      const dup = await PreOrderRequest.exists({ supply: supply._id, requester: req.user.id, status: "pending_confirmation" });
      if (dup) return res.status(409).json({ error: "You already have a pending pre-order on this product." });

      // Take the quantity off the supply in one step (so two buyers cannot take the same kg).
      const held = await Supply.findOneAndUpdate(
        {
          _id: supply._id,
          status: "available",
          targetDemand: null,
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
          availableQuantity: { $gte: qty },
        },
        { $inc: { reservedQuantity: qty, availableQuantity: -qty } },
        { new: true }
      );
      if (!held) {
        const left = Number(supply.availableQuantity || 0);
        return res.status(400).json({ error: left > 0 ? `Only ${left} ${supply.unit} is available.` : "This product is out of stock." });
      }

      let doc;
      try {
        doc = await PreOrderRequest.create({
          supply: supply._id,
          owner: supply.farmer,
          requester: req.user.id,
          kind: "preorder",
          product: supply.product,
          unit: supply.unit,
          supplyType: supply.supplyType || "onhand",
          location: supply.location || "",
          quantity: qty,
          neededDate,
          notes: String(b.notes || "").trim().slice(0, 300),
          held: true,
          fulfillment,
          deliveryAddress: fulfillment === "delivery" ? deliveryAddress : "",
          deliveryFee: fee,
        });
      } catch (err) {
        await Supply.updateOne({ _id: supply._id }, { $inc: { reservedQuantity: -qty, availableQuantity: qty } });
        throw err;
      }

      const how = fulfillment === "delivery" ? `delivery, fee ₱${fee}` : "pick up";
      const msg = doc.notes ? ` Message: "${doc.notes}"` : "";
      await sendNotice(supply.farmer, "request_created", "New pre-order",
        `A buyer wants ${qty} ${supply.unit} of ${supply.product} (${how}), needed by ${neededDate}.${msg}`, doc._id);

      res.status(201).json({ order: orderDto(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Create order error");
    }
  });

  // Buyer: My Pre Orders (tracker).
  router.get("/orders/mine", requireRole("buyer"), async (req, res) => {
    try {
      const rows = await PreOrderRequest.find({ requester: req.user.id }).sort({ createdAt: -1 }).limit(200).lean();
      const supplies = rows.length
        ? await Supply.find({ _id: { $in: rows.map((r) => r.supply) } }).select("image pricePerUnit farmer category").lean()
        : [];
      const bySupply = new Map(supplies.map((s) => [String(s._id), s]));
      const names = await namesFor(supplies);
      const reviews = rows.length
        ? await ProductReview.find({ order: { $in: rows.map((r) => r._id) } }).lean()
        : [];
      const byOrder = new Map(reviews.map((v) => [String(v.order), v]));
      res.json({
        orders: rows.map((r) => {
          const s = bySupply.get(String(r.supply));
          return orderDto(r, {
            image: s?.image || "",
            category: s?.category || "",
            pricePerUnit: s?.pricePerUnit || 0,
            farmerName: s ? names.get(String(s.farmer)) || "Farmer" : "Farmer",
            review: reviewDto(byOrder.get(String(r._id))),
          });
        }),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load my orders error");
    }
  });

  // Farmer: Order Management (accepted orders only).
  router.get("/orders/incoming", requireRole("farmer"), async (req, res) => {
    try {
      const rows = await PreOrderRequest.find({ owner: req.user.id, status: "confirmed" }).sort({ updatedAt: -1 }).limit(200).lean();
      const supplies = rows.length
        ? await Supply.find({ _id: { $in: rows.map((r) => r.supply) } }).select("image pricePerUnit").lean()
        : [];
      const bySupply = new Map(supplies.map((s) => [String(s._id), s]));
      const buyerIds = [...new Set(rows.map((r) => String(r.requester)))];
      const buyers = buyerIds.length
        ? await mongoose.model("User").find({ _id: { $in: buyerIds } }).select("name").lean()
        : [];
      const buyerName = new Map(buyers.map((u) => [String(u._id), u.name]));
      const reviews = rows.length
        ? await ProductReview.find({ order: { $in: rows.map((r) => r._id) } }).lean()
        : [];
      const byOrder = new Map(reviews.map((v) => [String(v.order), v]));
      res.json({
        orders: rows.map((r) => {
          const s = bySupply.get(String(r.supply));
          return orderDto(r, {
            image: s?.image || "",
            pricePerUnit: s?.pricePerUnit || 0,
            buyerName: buyerName.get(String(r.requester)) || "Buyer",
            review: reviewDto(byOrder.get(String(r._id))),
          });
        }),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load incoming orders error");
    }
  });

  // Farmer moves an accepted order to a later step. The buyer is notified.
  router.post("/orders/:id/status", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Order not found." });
      const order = await PreOrderRequest.findOne({ _id: req.params.id, owner: req.user.id, status: "confirmed" });
      if (!order) return res.status(404).json({ error: "Order not found." });

      const steps = stepsFor(order);
      const currentIdx = steps.findIndex((s) => s.id === (order.orderStatus || "accepted"));
      const nextIdx = steps.findIndex((s) => s.id === req.body?.status);
      if (nextIdx < 0) return res.status(400).json({ error: "Choose a valid status." });
      if (nextIdx <= currentIdx) return res.status(409).json({ error: "Choose a step after the current one." });
      const next = steps[nextIdx];

      const r = await PreOrderRequest.findOneAndUpdate(
        { _id: order._id, status: "confirmed" },
        { $set: { orderStatus: next.id }, $push: { orderHistory: { status: next.id, at: new Date() } } },
        { new: true }
      );
      if (!r) return res.status(409).json({ error: "This order can no longer be updated." });

      await sendNotice(r.requester, "order_status", next.label,
        `Your pre-order of ${r.quantity} ${r.unit} of ${r.product}: ${next.text}`);

      res.json({ order: orderDto(r) });
    } catch (err) {
      respondWithSafeError(res, err, "Update order status error");
    }
  });

  // Buyer rates a product (1-5 stars + message) once the order is complete.
  router.post("/orders/:id/review", writeLimiter, requireRole("buyer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Order not found." });
      const rating = Math.round(Number(req.body?.rating));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Choose a rating from 1 to 5 stars." });
      }
      const message = String(req.body?.message || "").trim().slice(0, 300);

      const order = await PreOrderRequest.findOne({ _id: req.params.id, requester: req.user.id, status: "confirmed" });
      if (!order) return res.status(404).json({ error: "Order not found." });
      const steps = stepsFor(order);
      if ((order.orderStatus || "accepted") !== steps[steps.length - 1].id) {
        return res.status(409).json({ error: "You can rate a product after the order is complete." });
      }

      let review;
      try {
        review = await ProductReview.create({
          supply: order.supply,
          order: order._id,
          farmer: order.owner,
          buyer: req.user.id,
          rating,
          message,
        });
      } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ error: "You already rated this order." });
        throw err;
      }

      const who = await userName(req.user.id, "A buyer");
      await sendNotice(order.owner, "product_rated", "New product rating",
        `${who} rated ${order.product} ${rating}/5.${message ? ` "${message}"` : ""}`);

      res.status(201).json({ review: reviewDto(review) });
    } catch (err) {
      respondWithSafeError(res, err, "Rate order error");
    }
  });

  // Farmer: own listings only (pending, approved and rejected), with ratings.
  router.get("/mine", requireRole("farmer"), async (req, res) => {
    try {
      await expireOldOnHandListings();
      const rows = await Supply.find({ farmer: req.user.id, targetDemand: null }).sort({ createdAt: -1 }).limit(200).lean();
      const ratings = await ratingsFor(rows.map((s) => s._id));
      res.json({ supplies: rows.map((s) => ({ ...ownerView(s), rating: ratings.get(String(s._id)) || NO_RATING })) });
    } catch (err) {
      respondWithSafeError(res, err, "Load own supply error");
    }
  });

  // Buyer/Admin: APPROVED supply, oldest first (FIFO). Sold-out products stay
  // in the list so they can be shown as "Out of Stock".
  router.get("/available", requireRole("buyer", "admin"), async (req, res) => {
    try {
      await expireOldOnHandListings();
      const rows = await Supply.find({
        status: "available",
        approvalStatus: "approved",
        targetDemand: null,
        ...onHandExpiryListingFilter(),
      })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      const names = await namesFor(rows);
      const ratings = await ratingsFor(rows.map((s) => s._id));
      res.json({ supplies: rows.map((s) => publicView(s, names.get(String(s.farmer)), ratings.get(String(s._id)))) });
    } catch (err) {
      respondWithSafeError(res, err, "Load available supply error");
    }
  });

  // Buyer/Admin/owner: every review of one product, with the buyers' names.
  router.get("/:id/reviews", requireRole("buyer", "farmer", "admin"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const supply = await Supply.findById(req.params.id).select("farmer product approvalStatus").lean();
      if (!supply) return res.status(404).json(NOT_FOUND);
      if (req.user.role === "farmer" && String(supply.farmer) !== String(req.user.id)) return res.status(404).json(NOT_FOUND);
      const approved = !supply.approvalStatus || supply.approvalStatus === "approved";
      if (req.user.role === "buyer" && !approved) return res.status(404).json(NOT_FOUND);

      const rows = await ProductReview.find({ supply: supply._id }).sort({ createdAt: -1 }).limit(100).lean();
      const ids = [...new Set(rows.map((r) => String(r.buyer)))];
      const users = ids.length
        ? await mongoose.model("User").find({ _id: { $in: ids } }).select("name").lean()
        : [];
      const names = new Map(users.map((u) => [String(u._id), u.name]));
      const total = rows.reduce((sum, r) => sum + r.rating, 0);

      res.json({
        product: supply.product,
        summary: { avg: rows.length ? round1(total / rows.length) : 0, count: rows.length },
        reviews: rows.map((r) => ({
          id: String(r._id),
          buyerName: names.get(String(r.buyer)) || "Buyer",
          rating: r.rating,
          message: r.message || "",
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load reviews error");
    }
  });

  // Buyer/Admin: the farmer who owns this supply: personal information, farm name,
  // and every approved product that farmer has uploaded (with ratings).
  router.get("/farmer/:id", requireRole("buyer", "admin"), async (req, res) => {
    try {
      await expireOldOnHandListings();
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const supply = await Supply.findById(req.params.id).lean();
      if (!supply) return res.status(404).json(NOT_FOUND);
      const approved = !supply.approvalStatus || supply.approvalStatus === "approved";
      if (req.user.role === "buyer" && !approved) return res.status(404).json(NOT_FOUND);

      const farmer = await loadFarmerProfile(supply.farmer);
      if (!farmer) return res.status(404).json({ error: "Farmer not found." });

      const rows = await Supply.find({
        farmer: supply.farmer,
        status: "available",
        approvalStatus: "approved",
        targetDemand: null,
        ...onHandExpiryListingFilter(),
      })
        .sort({ createdAt: 1 })
        .limit(60)
        .lean();
      const ratings = await ratingsFor(rows.map((s) => s._id));

      res.json({ farmer, products: rows.map((s) => publicView(s, farmer.name, ratings.get(String(s._id)))) });
    } catch (err) {
      respondWithSafeError(res, err, "Load farmer profile error");
    }
  });

  /* ---------- Admin: Supply Approvals + Supply Management ---------- */

  router.get("/admin/pending", requireRole("admin"), async (req, res) => {
    try {
      const rows = await Supply.find({ approvalStatus: "pending", targetDemand: null }).sort({ createdAt: 1 }).limit(200).lean();
      const names = await namesFor(rows);
      res.json({ supplies: rows.map((r) => ({ ...ownerView(r), farmerName: names.get(String(r.farmer)) || "Farmer" })) });
    } catch (err) {
      respondWithSafeError(res, err, "Load pending supply error");
    }
  });

  router.get("/admin/managed", requireRole("admin"), async (req, res) => {
    try {
      const rows = await Supply.find({ approvalStatus: "approved", targetDemand: null }).sort({ updatedAt: -1 }).limit(300).lean();
      const names = await namesFor(rows);
      res.json({ supplies: rows.map((r) => ({ ...ownerView(r), farmerName: names.get(String(r.farmer)) || "Farmer" })) });
    } catch (err) {
      respondWithSafeError(res, err, "Load managed supply error");
    }
  });

  router.post("/admin/:id/approve", writeLimiter, requireRole("admin"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const doc = await Supply.findOneAndUpdate(
        { _id: req.params.id, approvalStatus: "pending" },
        { approvalStatus: "approved", rejectionReason: "" },
        { new: true }
      );
      if (!doc) return res.status(409).json({ error: "This supply is no longer waiting for approval." });
      await matchSupplySafe(doc._id); // matching starts only after approval
      await sendNotice(doc.farmer, "supply_approved", "Supply approved",
        `Your ${doc.product} listing is approved and now visible to buyers.`, doc._id);
      res.json({ supply: ownerView(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Approve supply error");
    }
  });

  router.post("/admin/:id/reject", writeLimiter, requireRole("admin"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const reason = String(req.body?.reason || "").trim().slice(0, 200);
      const doc = await Supply.findOneAndUpdate(
        { _id: req.params.id, approvalStatus: "pending" },
        { approvalStatus: "rejected", rejectionReason: reason },
        { new: true }
      );
      if (!doc) return res.status(409).json({ error: "This supply is no longer waiting for approval." });
      await sendNotice(doc.farmer, "supply_rejected", "Supply rejected",
        `Your ${doc.product} listing was rejected.${reason ? " Reason: " + reason : ""}`, doc._id);
      res.json({ supply: ownerView(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Reject supply error");
    }
  });

  // Admin takes an approved listing off the marketplace (only if nothing is reserved).
  router.post("/admin/:id/remove", writeLimiter, requireRole("admin"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const doc = await Supply.findOneAndUpdate(
        { _id: req.params.id, approvalStatus: "approved", status: "available", reservedQuantity: 0 },
        { status: "cancelled", availableQuantity: 0 },
        { new: true }
      );
      if (!doc) return res.status(409).json({ error: "This supply has reservations or is already removed." });
      res.json({ supply: ownerView(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Remove supply error");
    }
  });

  /* ---------- Farmer ---------- */

  // One listing: the owner, or an admin. Anyone else gets "not found".
  router.get("/:id", requireRole("farmer", "admin"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const filter = req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, farmer: req.user.id };
      const row = await Supply.findOne(filter).lean();
      if (!row) return res.status(404).json(NOT_FOUND);
      res.json({ supply: ownerView(row) });
    } catch (err) {
      respondWithSafeError(res, err, "Load supply error");
    }
  });

  router.post("/", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      await expireOldOnHandListings();
      const { value, error } = readProductInput(req.body, { imageRequired: true });
      if (error) return res.status(400).json({ error });

      const active = await Supply.countDocuments({ farmer: req.user.id, status: "available" });
      if (active >= MAX_ACTIVE_LISTINGS) {
        return res.status(400).json({ error: "You have reached the limit of active supply listings." });
      }

      // Owner, status and approval are set by the server, never by the request.
      const doc = new Supply({ farmer: req.user.id, status: "available", approvalStatus: "pending" });
      applyInput(doc, value);
      await doc.save();

      const who = await farmerName(req.user.id);
      await notifyAdmins("New supply to approve", `${who} submitted ${doc.product} (${doc.category}). Open Supply Approvals to accept or reject it.`, doc._id);

      res.status(201).json({ supply: ownerView(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Create supply error");
    }
  });

  router.patch("/:id", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const { value, error } = readProductInput(req.body, { imageRequired: false });
      if (error) return res.status(400).json({ error });

      const doc = await Supply.findOne({ _id: req.params.id, farmer: req.user.id });
      if (!doc) return res.status(404).json(NOT_FOUND);
      if (doc.targetDemand) {
        return res.status(409).json({ error: "An offer made for a request cannot be edited." });
      }
      if (!["available", "expired"].includes(doc.status) || doc.reservedQuantity > 0) {
        return res.status(409).json({ error: "This supply can no longer be edited." });
      }

      applyInput(doc, value);
      doc.status = "available";
      doc.approvalStatus = "pending"; // every edit goes back to the admin
      doc.rejectionReason = "";
      await doc.save();

      const who = await farmerName(req.user.id);
      await notifyAdmins("Updated supply to approve", `${who} edited ${doc.product}. It is waiting for your approval again.`, doc._id);

      res.json({ supply: ownerView(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Update supply error");
    }
  });

  // "Cancel" keeps the record (status = cancelled) so history is not lost.
  router.post("/:id/cancel", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const doc = await Supply.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id, status: { $in: ["available", "expired"] }, reservedQuantity: 0 },
        { status: "cancelled", availableQuantity: 0 },
        { new: true }
      );
      if (doc) return res.json({ supply: ownerView(doc) });

      const exists = await Supply.exists({ _id: req.params.id, farmer: req.user.id });
      if (!exists) return res.status(404).json(NOT_FOUND);
      res.status(409).json({ error: "This supply can no longer be cancelled." });
    } catch (err) {
      respondWithSafeError(res, err, "Cancel supply error");
    }
  });

  return router;
}