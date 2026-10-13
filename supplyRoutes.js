import express from "express";
import mongoose from "mongoose";
import { Supply } from "./farmModels.js";
import { authenticate, requireRole, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { readSupplyInput, isValidId, round2 } from "./farmValidation.js";
import { matchSupplySafe } from "./matchingEngine.js";

const MAX_ACTIVE_LISTINGS = 100;
const NOT_FOUND = { error: "Supply not found." };

const baseQuantity = (s) => (s.supplyType === "onhand" ? s.actualQuantity : s.estimatedQuantity);

// What the owning farmer (or admin) sees.
function ownerView(s) {
  return {
    id: String(s._id),
    product: s.product,
    supplyType: s.supplyType,
    quantity: baseQuantity(s),
    estimatedQuantity: s.estimatedQuantity,
    actualQuantity: s.actualQuantity,
    reservedQuantity: s.reservedQuantity,
    availableQuantity: s.availableQuantity,
    unit: s.unit,
    availabilityDate: s.availabilityDate,
    location: s.location,
    status: s.status,
    isOffer: Boolean(s.targetDemand),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// What buyers see: the farmer's DISPLAY NAME only (no id, email or phone).
function publicView(s, farmerName) {
  return {
    id: String(s._id),
    farmerName: farmerName || "Farmer",
    product: s.product,
    supplyType: s.supplyType,
    availableQuantity: s.availableQuantity,
    unit: s.unit,
    availabilityDate: s.availabilityDate,
    location: s.location,
    status: s.status,
    createdAt: s.createdAt,
  };
}

function applyInput(doc, v) {
  doc.product = v.product;
  doc.supplyType = v.supplyType;
  doc.unit = v.unit;
  doc.availabilityDate = v.availabilityDate;
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

  // Farmer: own listings only.
  router.get("/mine", requireRole("farmer"), async (req, res) => {
    try {
      const rows = await Supply.find({ farmer: req.user.id }).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ supplies: rows.map(ownerView) });
    } catch (err) {
      respondWithSafeError(res, err, "Load own supply error");
    }
  });

  // Buyer/Admin: real available supply, oldest first (FIFO order).
  // availableQuantity is already net of reserved quantity.
  router.get("/available", requireRole("buyer", "admin"), async (req, res) => {
    try {
      const rows = await Supply.find({
        status: "available",
        availableQuantity: { $gt: 0 },
        targetDemand: null,
      })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();

      // One query for all display names (User model is registered in server.js).
      const ids = [...new Set(rows.map((r) => String(r.farmer)))];
      const users = ids.length
        ? await mongoose.model("User").find({ _id: { $in: ids } }).select("name").lean()
        : [];
      const names = new Map(users.map((u) => [String(u._id), u.name]));

      res.json({ supplies: rows.map((s) => publicView(s, names.get(String(s.farmer)))) });
    } catch (err) {
      respondWithSafeError(res, err, "Load available supply error");
    }
  });

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
      const { value, error } = readSupplyInput(req.body);
      if (error) return res.status(400).json({ error });

      const active = await Supply.countDocuments({ farmer: req.user.id, status: "available" });
      if (active >= MAX_ACTIVE_LISTINGS) {
        return res.status(400).json({ error: "You have reached the limit of active supply listings." });
      }

      // Owner and status are set by the server, never by the request.
      const doc = new Supply({ farmer: req.user.id, status: "available" });
      applyInput(doc, value);
      await doc.save();
      await matchSupplySafe(doc._id);
      const fresh = await Supply.findById(doc._id).lean();
      res.status(201).json({ supply: ownerView(fresh || doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Create supply error");
    }
  });

  router.patch("/:id", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const { value, error } = readSupplyInput(req.body);
      if (error) return res.status(400).json({ error });

      // Ownership is part of the query: another farmer's id simply finds nothing.
      const doc = await Supply.findOne({ _id: req.params.id, farmer: req.user.id });
      if (!doc) return res.status(404).json(NOT_FOUND);
      if (doc.targetDemand) {
        return res.status(409).json({ error: "An offer made for a request cannot be edited." });
      }
      if (doc.status !== "available" || doc.reservedQuantity > 0) {
        return res.status(409).json({ error: "This supply can no longer be edited." });
      }
      if (value.quantity < doc.reservedQuantity) {
        return res.status(400).json({ error: "Quantity cannot be lower than the amount already reserved." });
      }

      applyInput(doc, value);
      await doc.save();
      await matchSupplySafe(doc._id);
      const fresh = await Supply.findById(doc._id).lean();
      res.json({ supply: ownerView(fresh || doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Update supply error");
    }
  });

  // "Cancel" keeps the record (status = cancelled) so history is not lost.
  router.post("/:id/cancel", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const doc = await Supply.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id, status: "available", reservedQuantity: 0 },
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