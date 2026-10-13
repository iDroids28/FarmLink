import express from "express";
import mongoose from "mongoose";
import { authenticate, requireRole, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { Requirement, Supply, PreOrder } from "./marketModels.js";

const CATEGORIES = ["Vegetables", "Fruits", "Grains", "Root Crops", "Livestock & Poultry", "Others"];
const UNITS = ["kg", "sack", "piece", "bundle"];
const MAX_QTY = 100000;

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Philippine date (UTC+8) so "today" is correct even if the server runs in UTC.
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const code = (p, id) => `${p}-${String(id).slice(-6).toUpperCase()}`;
const isId = (id) => mongoose.isValidObjectId(id);
const NAME_RE = /^[A-Za-zÑñ][A-Za-zÑñ\s\-']*$/;

const reqOut = (r) => ({
  id: r._id, code: code("REQ", r._id), category: r.category, product: r.product,
  quantity: r.quantity, unit: r.unit, neededDate: r.neededDate, location: r.location,
  targetPrice: r.targetPrice, notes: r.notes, status: r.status, matched: r.matched || 0,
  createdAt: r.createdAt,
});
const supplyOut = (s) => ({
  id: s._id, code: code("SUP", s._id), category: s.category, product: s.product,
  quantity: s.quantity, unit: s.unit, price: s.price, availableDate: s.availableDate,
  location: s.location, description: s.description, status: s.status,
  farmerName: s.farmerName, createdAt: s.createdAt,
});
const orderOut = (o) => ({
  id: o._id, code: code("PRE", o._id), supplyId: o.supply, product: o.product,
  unit: o.unit, price: o.price, quantity: o.quantity, total: o.price * o.quantity,
  neededDate: o.neededDate, notes: o.notes, status: o.status,
  buyerName: o.buyerName, farmerName: o.farmerName, createdAt: o.createdAt,
});

function checkProduct(product) {
  if (!product) return "Please enter the product name.";
  if (product.length < 2) return "Product name is too short.";
  if (!NAME_RE.test(product)) return "Product name: letters only.";
  return null;
}
function checkQty(q) {
  if (!Number.isInteger(q) || q <= 0) return "Quantity must be a whole number greater than 0.";
  if (q > MAX_QTY) return `Quantity cannot be more than ${MAX_QTY}.`;
  return null;
}

export default function createMarketRouter() {
  const router = express.Router();

  /* ================= BUYER REQUIREMENTS ================= */

  router.get("/requirements/mine", authenticate, async (req, res) => {
    try {
      const list = await Requirement.find({ buyer: req.user.id }).sort({ createdAt: -1 });
      res.json({ requirements: list.map(reqOut) });
    } catch (err) { respondWithSafeError(res, err, "Load requirements error"); }
  });

  router.post("/requirements", authenticate, writeLimiter, async (req, res) => {
    try {
      const b = req.body || {};
      const product = clean(b.product, 40);
      const location = clean(b.location, 100);
      const qty = Number(b.quantity);
      const price = b.targetPrice === undefined || b.targetPrice === "" || b.targetPrice === null
        ? undefined : Number(b.targetPrice);

      const err =
        (!CATEGORIES.includes(b.category) && "Please select a category.") ||
        checkProduct(product) ||
        checkQty(qty) ||
        (!UNITS.includes(b.unit) && "Please select a unit.") ||
        (!isDate(b.neededDate) && "Please select the needed date.") ||
        (b.neededDate < today() && "Needed date cannot be in the past.") ||
        (location.length < 3 && "Please enter the delivery location.") ||
        (price !== undefined && (!Number.isFinite(price) || price < 0 || price > 1000000) && "Invalid target price.");
      if (err) return res.status(400).json({ error: err });

      const doc = await Requirement.create({
        buyer: req.user.id, category: b.category, product, quantity: qty, unit: b.unit,
        neededDate: b.neededDate, location, targetPrice: price, notes: clean(b.notes, 300),
      });
      res.status(201).json({ requirement: reqOut(doc) });
    } catch (err) { respondWithSafeError(res, err, "Create requirement error"); }
  });

  router.patch("/requirements/:id/close", authenticate, async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(400).json({ error: "Invalid request." });
      const doc = await Requirement.findOneAndUpdate(
        { _id: req.params.id, buyer: req.user.id },
        { status: "Closed" }, { new: true }
      );
      if (!doc) return res.status(404).json({ error: "Requirement not found." });
      res.json({ requirement: reqOut(doc) });
    } catch (err) { respondWithSafeError(res, err, "Close requirement error"); }
  });

  /* ================= FARMER SUPPLY ================= */

  router.get("/supplies/mine", authenticate, requireRole("farmer", "admin"), async (req, res) => {
    try {
      const list = await Supply.find({ farmer: req.user.id, status: { $ne: "Removed" } }).sort({ createdAt: -1 });
      res.json({ supplies: list.map(supplyOut) });
    } catch (err) { respondWithSafeError(res, err, "Load my supply error"); }
  });

  router.post("/supplies", authenticate, requireRole("farmer", "admin"), writeLimiter, async (req, res) => {
    try {
      const b = req.body || {};
      const product = clean(b.product, 40);
      const location = clean(b.location, 100);
      const qty = Number(b.quantity);
      const price = Number(b.price);

      const err =
        (!CATEGORIES.includes(b.category) && "Please select a category.") ||
        checkProduct(product) ||
        checkQty(qty) ||
        (!UNITS.includes(b.unit) && "Please select a unit.") ||
        (!Number.isFinite(price) || price <= 0 || price > 1000000 ? "Enter a valid price per unit." : null) ||
        (!isDate(b.availableDate) && "Please select the available date.") ||
        (b.availableDate < today() && "Available date cannot be in the past.") ||
        (location.length < 3 && "Please enter the location.");
      if (err) return res.status(400).json({ error: err });

      const me = await mongoose.model("User").findById(req.user.id).select("name").lean();
      const doc = await Supply.create({
        farmer: req.user.id, farmerName: me?.name || "Farmer", category: b.category,
        product, quantity: qty, unit: b.unit, price, availableDate: b.availableDate,
        location, description: clean(b.description, 300),
      });
      res.status(201).json({ supply: supplyOut(doc) });
    } catch (err) { respondWithSafeError(res, err, "Create supply error"); }
  });

  router.patch("/supplies/:id/remove", authenticate, requireRole("farmer", "admin"), async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(400).json({ error: "Invalid request." });
      const doc = await Supply.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id }, { status: "Removed" }, { new: true }
      );
      if (!doc) return res.status(404).json({ error: "Supply not found." });
      res.json({ supply: supplyOut(doc) });
    } catch (err) { respondWithSafeError(res, err, "Remove supply error"); }
  });

  /* ================= FIND SUPPLY (buyers browse) ================= */

  router.get("/supplies/available", authenticate, async (req, res) => {
    try {
      const list = await Supply.find({
        status: "Available", quantity: { $gt: 0 }, farmer: { $ne: req.user.id },
      }).sort({ createdAt: -1 });
      res.json({ supplies: list.map(supplyOut) });
    } catch (err) { respondWithSafeError(res, err, "Load available supply error"); }
  });

  /* ================= PRE-ORDERS ================= */

  router.post("/preorders", authenticate, writeLimiter, async (req, res) => {
    try {
      const b = req.body || {};
      if (!isId(b.supplyId)) return res.status(400).json({ error: "Invalid supply." });
      const supply = await Supply.findById(b.supplyId);
      if (!supply || supply.status !== "Available" || supply.quantity <= 0)
        return res.status(404).json({ error: "This supply is no longer available." });
      if (String(supply.farmer) === req.user.id)
        return res.status(400).json({ error: "You cannot pre-order your own supply." });

      const qty = Number(b.quantity);
      const err =
        checkQty(qty) ||
        (qty > supply.quantity && `Only ${supply.quantity} ${supply.unit} available.`) ||
        (!isDate(b.neededDate) && "Please select the date you need it.") ||
        (b.neededDate < today() && "Date cannot be in the past.");
      if (err) return res.status(400).json({ error: err });

      const me = await mongoose.model("User").findById(req.user.id).select("name").lean();
      const doc = await PreOrder.create({
        supply: supply._id, buyer: req.user.id, buyerName: me?.name || "Buyer",
        farmer: supply.farmer, farmerName: supply.farmerName, product: supply.product,
        unit: supply.unit, price: supply.price, quantity: qty, neededDate: b.neededDate,
        notes: clean(b.notes, 300),
      });
      res.status(201).json({ preorder: orderOut(doc) });
    } catch (err) { respondWithSafeError(res, err, "Create pre-order error"); }
  });

  // Buyer: my pre-orders
  router.get("/preorders/mine", authenticate, async (req, res) => {
    try {
      const list = await PreOrder.find({ buyer: req.user.id }).sort({ createdAt: -1 });
      res.json({ preorders: list.map(orderOut) });
    } catch (err) { respondWithSafeError(res, err, "Load pre-orders error"); }
  });

  // Farmer: pre-orders from buyers
  router.get("/preorders/incoming", authenticate, requireRole("farmer", "admin"), async (req, res) => {
    try {
      const list = await PreOrder.find({ farmer: req.user.id }).sort({ createdAt: -1 });
      res.json({ preorders: list.map(orderOut) });
    } catch (err) { respondWithSafeError(res, err, "Load incoming error"); }
  });

  // Buyer cancels own pending pre-order
  router.patch("/preorders/:id/cancel", authenticate, async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(400).json({ error: "Invalid request." });
      const doc = await PreOrder.findOneAndUpdate(
        { _id: req.params.id, buyer: req.user.id, status: "Pending" },
        { status: "Cancelled" }, { new: true }
      );
      if (!doc) return res.status(404).json({ error: "Pre-order not found or already handled." });
      res.json({ preorder: orderOut(doc) });
    } catch (err) { respondWithSafeError(res, err, "Cancel pre-order error"); }
  });

  // Farmer accepts / declines
  router.patch("/preorders/:id/decision", authenticate, requireRole("farmer", "admin"), async (req, res) => {
    try {
      const { decision } = req.body || {};
      if (!isId(req.params.id) || !["Accepted", "Declined"].includes(decision))
        return res.status(400).json({ error: "Invalid request." });

      const order = await PreOrder.findOne({ _id: req.params.id, farmer: req.user.id, status: "Pending" });
      if (!order) return res.status(404).json({ error: "Pre-order not found or already handled." });

      if (decision === "Accepted") {
        // Atomic: only subtract if enough stock is still there.
        const supply = await Supply.findOneAndUpdate(
          { _id: order.supply, quantity: { $gte: order.quantity }, status: "Available" },
          { $inc: { quantity: -order.quantity } }, { new: true }
        );
        if (!supply) return res.status(409).json({ error: "Not enough stock left for this pre-order." });
        if (supply.quantity === 0) { supply.status = "Sold Out"; await supply.save(); }
      }
      order.status = decision;
      await order.save();
      res.json({ preorder: orderOut(order) });
    } catch (err) { respondWithSafeError(res, err, "Decide pre-order error"); }
  });

  return router;
}