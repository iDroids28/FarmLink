// Supplies (My Supply / Find Supply) and Pre-orders.
// Mount it with the SAME auth middleware you use for /requirements/mine.
const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");

const CATEGORIES = ["Vegetables", "Fruits", "Grains", "Root Crops", "Livestock & Poultry", "Others"];
const UNITS = ["kg", "sack", "piece", "bundle"];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const makeCode = (prefix) => `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;

const supplySchema = new mongoose.Schema(
  {
    code: String,
    farmerId: { type: String, index: true },
    farmerName: String,
    product: String,
    category: String,
    quantity: Number,
    unit: String,
    price: Number,
    availableDate: String,
    location: String,
    description: { type: String, default: "" },
    status: { type: String, default: "Available" }, // Available | Sold Out | Removed
  },
  { timestamps: true }
);

const preorderSchema = new mongoose.Schema(
  {
    code: String,
    supplyId: String,
    buyerId: { type: String, index: true },
    buyerName: String,
    farmerId: { type: String, index: true },
    farmerName: String,
    product: String,
    category: String,
    unit: String,
    price: Number,
    quantity: Number,
    total: Number,
    neededDate: String,
    notes: { type: String, default: "" },
    status: { type: String, default: "Pending" }, // Pending | Accepted | Declined | Cancelled
  },
  { timestamps: true }
);

const Supply = mongoose.models.MarketSupply || mongoose.model("MarketSupply", supplySchema, "market_supplies");
const Preorder = mongoose.models.MarketPreorder || mongoose.model("MarketPreorder", preorderSchema, "market_preorders");

const json = (doc) => {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  o.id = String(o._id);
  delete o._id;
  delete o.__v;
  return o;
};

const uid = (req) => String(req.user?.id || req.user?._id);
const uname = (req) => req.user?.name || req.user?.email || "User";
const isFarmer = (req) => String(req.user?.role || "").toLowerCase() === "farmer";

module.exports = function marketRoutes(requireAuth) {
  const router = express.Router();
  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Server error. Please try again.", error: "Server error. Please try again." });
    });
  const fail = (res, status, message) => res.status(status).json({ message, error: message });

  // ---------------- SUPPLIES ----------------

  // Find Supply: every farmer's available products, visible to everyone.
  router.get("/supplies/available", requireAuth, wrap(async (req, res) => {
    const list = await Supply.find({ status: "Available", quantity: { $gt: 0 } }).sort({ createdAt: -1 });
    res.json({ supplies: list.map((s) => ({ ...json(s), mine: s.farmerId === uid(req) })) });
  }));

  // My Supply: the farmer's own products.
  router.get("/supplies/mine", requireAuth, wrap(async (req, res) => {
    const list = await Supply.find({ farmerId: uid(req), status: { $ne: "Removed" } }).sort({ createdAt: -1 });
    res.json({ supplies: list.map(json) });
  }));

  // My Supply: post a product.
  router.post("/supplies", requireAuth, wrap(async (req, res) => {
    if (!isFarmer(req)) return fail(res, 403, "Only approved farmers can post supply.");
    const b = req.body || {};
    const product = String(b.product || "").trim();
    const location = String(b.location || "").trim();
    const quantity = Number(b.quantity);
    const price = Number(b.price);

    if (!CATEGORIES.includes(b.category)) return fail(res, 400, "Select a valid category.");
    if (!/^[A-Za-zÑñ][A-Za-zÑñ\s\-']{1,39}$/.test(product)) return fail(res, 400, "Product name must be letters only (2-40 characters).");
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100000) return fail(res, 400, "Quantity must be a whole number above 0.");
    if (!UNITS.includes(b.unit)) return fail(res, 400, "Select a valid unit.");
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) return fail(res, 400, "Price must be above 0.");
    if (!b.availableDate || b.availableDate < today()) return fail(res, 400, "Available date cannot be in the past.");
    if (location.length < 3) return fail(res, 400, "Enter the farm location.");

    const doc = await Supply.create({
      code: makeCode("SUP"),
      farmerId: uid(req),
      farmerName: uname(req),
      product,
      category: b.category,
      quantity,
      unit: b.unit,
      price,
      availableDate: b.availableDate,
      location,
      description: String(b.description || "").trim().slice(0, 300),
    });
    res.status(201).json({ supply: json(doc) });
  }));

  // My Supply: remove a product.
  router.patch("/supplies/:id/remove", requireAuth, wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Not found.");
    const s = await Supply.findOne({ _id: req.params.id, farmerId: uid(req) });
    if (!s) return fail(res, 404, "Supply not found.");
    s.status = "Removed";
    await s.save();
    res.json({ supply: json(s) });
  }));

  // ---------------- PRE-ORDERS ----------------

  // Find Supply: buyer sends a pre-order.
  router.post("/preorders", requireAuth, wrap(async (req, res) => {
    const b = req.body || {};
    if (!mongoose.isValidObjectId(b.supplyId)) return fail(res, 400, "Invalid product.");
    const qty = Number(b.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return fail(res, 400, "Enter a whole number quantity.");
    if (!b.neededDate || b.neededDate < today()) return fail(res, 400, "Needed date cannot be in the past.");

    const s = await Supply.findById(b.supplyId);
    if (!s || s.status !== "Available" || s.quantity <= 0) return fail(res, 404, "This product is no longer available.");
    if (s.farmerId === uid(req)) return fail(res, 400, "You cannot pre-order your own product.");
    if (qty > s.quantity) return fail(res, 400, `Only ${s.quantity} ${s.unit} available.`);

    const doc = await Preorder.create({
      code: makeCode("PRE"),
      supplyId: String(s._id),
      buyerId: uid(req),
      buyerName: uname(req),
      farmerId: s.farmerId,
      farmerName: s.farmerName,
      product: s.product,
      category: s.category,
      unit: s.unit,
      price: s.price,
      quantity: qty,
      total: Math.round(qty * s.price * 100) / 100,
      neededDate: b.neededDate,
      notes: String(b.notes || "").trim().slice(0, 300),
    });
    res.status(201).json({ preorder: json(doc) });
  }));

  // My Request: the buyer's pre-orders.
  router.get("/preorders/mine", requireAuth, wrap(async (req, res) => {
    const list = await Preorder.find({ buyerId: uid(req) }).sort({ createdAt: -1 });
    res.json({ preorders: list.map(json) });
  }));

  // My Request: buyer cancels a Pending pre-order.
  router.patch("/preorders/:id/cancel", requireAuth, wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Not found.");
    const p = await Preorder.findOne({ _id: req.params.id, buyerId: uid(req) });
    if (!p) return fail(res, 404, "Pre-order not found.");
    if (p.status !== "Pending") return fail(res, 400, "Only Pending pre-orders can be cancelled.");
    p.status = "Cancelled";
    await p.save();
    res.json({ preorder: json(p) });
  }));

  // My Supply: pre-orders sent to this farmer.
  router.get("/preorders/incoming", requireAuth, wrap(async (req, res) => {
    const list = await Preorder.find({ farmerId: uid(req) }).sort({ createdAt: -1 });
    res.json({ preorders: list.map(json) });
  }));

  // My Supply: farmer accepts or declines.
  router.patch("/preorders/:id/decision", requireAuth, wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "Not found.");
    const decision = req.body?.decision;
    if (!["Accepted", "Declined"].includes(decision)) return fail(res, 400, "Invalid decision.");
    const p = await Preorder.findOne({ _id: req.params.id, farmerId: uid(req) });
    if (!p) return fail(res, 404, "Pre-order not found.");
    if (p.status !== "Pending") return fail(res, 400, "This pre-order was already handled.");

    if (decision === "Accepted") {
      // Take the stock atomically so two accepts cannot oversell.
      const s = await Supply.findOneAndUpdate(
        { _id: p.supplyId, quantity: { $gte: p.quantity } },
        { $inc: { quantity: -p.quantity } },
        { new: true }
      );
      if (!s) return fail(res, 400, "Not enough stock left to accept this pre-order.");
      if (s.quantity === 0) {
        s.status = "Sold Out";
        await s.save();
      }
    }
    p.status = decision;
    await p.save();
    res.json({ preorder: json(p) });
  }));

  return router;
};