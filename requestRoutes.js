import express from "express";
import mongoose from "mongoose";
import { Supply, Demand } from "./farmModels.js";
import { authenticate, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { isValidId, round2 } from "./farmValidation.js";

/* ---------------- Request model (kept in this file) ---------------- */

const requestSchema = new mongoose.Schema(
  {
    supply: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // the farmer
    requester: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // the buyer
    kind: { type: String, enum: ["preorder", "supply_request"], default: "preorder" },
    product: { type: String, required: true },
    unit: { type: String, required: true },
    supplyType: { type: String, default: "onhand" },
    location: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    neededDate: { type: String, required: true }, // YYYY-MM-DD
    notes: { type: String, default: "", maxlength: 300 },
    status: {
      type: String,
      enum: ["pending_confirmation", "confirmed", "declined", "cancelled"],
      default: "pending_confirmation",
    },
    // Order tracking
    held: { type: Boolean, default: false }, // quantity is already taken off the supply
    fulfillment: { type: String, enum: ["pickup", "delivery"], default: "pickup" },
    deliveryAddress: { type: String, default: "", maxlength: 200 },
    deliveryFee: { type: Number, default: 0, min: 0 }, // 0 for pick up
    orderStatus: { type: String, default: "" },
    orderHistory: { type: [{ _id: false, status: String, at: Date }], default: [] },
  },
  { timestamps: true }
);

export const PreOrderRequest =
  mongoose.models.PreOrderRequest || mongoose.model("PreOrderRequest", requestSchema);

// Links a confirmed match to the pre-order the buyer made from it (one order per match).
const matchOrderSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  },
  { timestamps: true }
);
const MatchOrder =
  mongoose.models.MatchOrder || mongoose.model("MatchOrder", matchOrderSchema, "match_orders");

// The photo of the products the farmer attaches to a match. The buyer sees it
// before pre-ordering.
const matchPhotoSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    image: { type: String, required: true },
  },
  { timestamps: true }
);
const MatchPhoto =
  mongoose.models.MatchPhoto || mongoose.model("MatchPhoto", matchPhotoSchema, "match_photos");

const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
// The browser shrinks the photo to about 60 KB. The JSON body limit of this route is 100 KB.
const MAX_MATCH_PHOTO = 90_000;

/* ---------------- Helpers ---------------- */

const kindText = (r) => (r.kind === "supply_request" ? "supply request" : "pre-order");
const qtyText = (r) => `${r.quantity} ${r.unit} of ${r.product}`;

const toDto = (r) => ({
  id: String(r._id),
  supplyId: String(r.supply),
  kind: r.kind || "preorder",
  product: r.product,
  unit: r.unit,
  supplyType: r.supplyType,
  location: r.location,
  quantity: r.quantity,
  neededDate: r.neededDate,
  notes: r.notes,
  status: r.status,
  fulfillment: r.fulfillment || "pickup",
  deliveryAddress: r.deliveryAddress || "",
  deliveryFee: Number(r.deliveryFee || 0),
  orderStatus: r.orderStatus || "",
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

// Delivery fee (Pick Up is always free). Same rule as supplyRoutes.js:
// 1-10 kg = 80, over 10 up to 50 = 120, over 50 up to 100 = 250, over 100 = 250 per 100 kg.
function deliveryFee(kg, fulfillment) {
  if (fulfillment !== "delivery") return 0;
  const q = Number(kg);
  if (!(q > 0)) return 0;
  if (q <= 10) return 80;
  if (q <= 50) return 120;
  if (q <= 100) return 250;
  return 250 * Math.ceil(q / 100);
}

// Finds the model that stores matches (it links a supply and a requirement).
function findMatchModel() {
  for (const Model of Object.values(mongoose.models)) {
    const has = (k) => Boolean(Model.schema.path(k));
    const supplyKey = ["supply", "supplyId"].find(has);
    const demandKey = ["demand", "demandId", "requirement", "requirementId"].find(has);
    if (supplyKey && demandKey && has("status")) return { Model, supplyKey, demandKey };
  }
  return null;
}
const matchQty = (m) => Number(m.quantity ?? m.matchedQuantity ?? 0);

// match id -> the pre-order made from it (or null)
async function orderLinksFor(matchIds) {
  const links = matchIds.length ? await MatchOrder.find({ match: { $in: matchIds } }).lean() : [];
  const orders = links.length
    ? await PreOrderRequest.find({ _id: { $in: links.map((l) => l.order) } }).select("orderStatus fulfillment status").lean()
    : [];
  const byId = new Map(orders.map((o) => [String(o._id), o]));
  return new Map(
    links.map((l) => {
      const o = byId.get(String(l.order));
      return [String(l.match), o ? { id: String(o._id), orderStatus: o.orderStatus || "accepted", fulfillment: o.fulfillment, status: o.status } : null];
    })
  );
}

// ids of the matches that already have a farmer photo
async function photoSetFor(matchIds) {
  if (!matchIds.length) return new Set();
  const rows = await MatchPhoto.find({ match: { $in: matchIds } }).select("match").lean();
  return new Set(rows.map((p) => String(p.match)));
}

// Sends a notification through your existing notice code. If that file or
// function is missing, the pre-order still works; only the bell message is skipped.
async function sendNotice(userId, type, title, message, requestId) {
  try {
    const mod = await import("./noticeModel.js");
    if (typeof mod.notify === "function") {
      await mod.notify(userId, type, title, String(message).slice(0, 300), null, requestId);
    }
  } catch (err) {
    console.error("Notice not sent:", err?.message || err);
  }
}

// Gives the held quantity back to the supply (declined or cancelled orders).
async function releaseHeld(r) {
  if (!r?.held) return;
  await Supply.updateOne(
    { _id: r.supply, reservedQuantity: { $gte: r.quantity } },
    { $inc: { reservedQuantity: -r.quantity, availableQuantity: r.quantity } }
  );
  await PreOrderRequest.updateOne({ _id: r._id }, { held: false });
}

/* ---------------- Routes ---------------- */

export default function createRequestRouter() {
  const router = express.Router();
  router.use(authenticate);

  /* ---------- Matches: photo from the farmer, then the buyer pre-orders ---------- */

  // Farmer's matches, with the buyer's details and whether a photo was attached.
  router.get("/matches/incoming", async (req, res) => {
    try {
      if (req.user.role !== "farmer") return res.status(403).json({ error: "Only farmers can open this list." });
      const found = findMatchModel();
      if (!found) return res.status(501).json({ error: "Matches could not be read on the server." });
      const { Model, supplyKey, demandKey } = found;

      const supplies = await Supply.find({ farmer: req.user.id })
        .select("image pricePerUnit product unit supplyType availabilityDate location category")
        .lean();
      if (!supplies.length) return res.json({ matches: [] });
      const bySupply = new Map(supplies.map((s) => [String(s._id), s]));

      const rows = await Model.find({ [supplyKey]: { $in: supplies.map((s) => s._id) } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const demands = rows.length
        ? await Demand.find({ _id: { $in: rows.map((m) => m[demandKey]) } }).select("buyer quantity neededDate product unit location").lean()
        : [];
      const byDemand = new Map(demands.map((d) => [String(d._id), d]));

      const buyerIds = [...new Set(demands.map((d) => String(d.buyer)))];
      const buyers = buyerIds.length
        ? await mongoose.model("User").find({ _id: { $in: buyerIds } }).select("name").lean()
        : [];
      const buyerName = new Map(buyers.map((u) => [String(u._id), u.name]));

      const ids = rows.map((m) => m._id);
      const photos = await photoSetFor(ids);
      const orders = await orderLinksFor(ids);

      res.json({
        matches: rows.map((m) => {
          const s = bySupply.get(String(m[supplyKey]));
          const d = byDemand.get(String(m[demandKey]));
          return {
            id: String(m._id),
            status: m.status,
            supplyId: String(m[supplyKey]),
            product: s?.product || m.product || d?.product || "",
            unit: s?.unit || m.unit || d?.unit || "kg",
            category: s?.category || "",
            quantity: matchQty(m),
            supplyType: s?.supplyType || "onhand",
            availabilityDate: s?.availabilityDate || null,
            location: s?.location || "",
            image: s?.image || "",
            pricePerUnit: s?.pricePerUnit || 0,
            buyerName: d ? buyerName.get(String(d.buyer)) || "Buyer" : "Buyer",
            buyerLocation: d?.location || "",
            requestedQuantity: d?.quantity || 0,
            neededDate: d?.neededDate || null,
            hasPhoto: photos.has(String(m._id)),
            order: orders.get(String(m._id)) || null,
            createdAt: m.createdAt,
          };
        }),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load farmer matches error");
    }
  });

  // Buyer's matches, with the supply details, the farmer's photo flag and the order made from each one.
  router.get("/matches/mine", async (req, res) => {
    try {
      if (req.user.role !== "buyer") return res.status(403).json({ error: "Only buyers have matches." });
      const found = findMatchModel();
      if (!found) return res.status(501).json({ error: "Matches could not be read on the server." });
      const { Model, supplyKey, demandKey } = found;

      const demands = await Demand.find({ buyer: req.user.id }).select("_id quantity neededDate product unit").lean();
      if (!demands.length) return res.json({ matches: [] });
      const byDemand = new Map(demands.map((d) => [String(d._id), d]));

      const rows = await Model.find({ [demandKey]: { $in: demands.map((d) => d._id) } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const supplyIds = [...new Set(rows.map((m) => String(m[supplyKey])))];
      const supplies = supplyIds.length
        ? await Supply.find({ _id: { $in: supplyIds } })
            .select("image pricePerUnit farmer product unit supplyType availabilityDate location category")
            .lean()
        : [];
      const bySupply = new Map(supplies.map((s) => [String(s._id), s]));

      const farmerIds = [...new Set(supplies.map((s) => String(s.farmer)))];
      const farmers = farmerIds.length
        ? await mongoose.model("User").find({ _id: { $in: farmerIds } }).select("name").lean()
        : [];
      const farmerName = new Map(farmers.map((u) => [String(u._id), u.name]));

      const ids = rows.map((m) => m._id);
      const photos = await photoSetFor(ids);
      const orders = await orderLinksFor(ids);

      res.json({
        matches: rows.map((m) => {
          const s = bySupply.get(String(m[supplyKey]));
          const d = byDemand.get(String(m[demandKey]));
          return {
            id: String(m._id),
            status: m.status,
            supplyId: String(m[supplyKey]),
            product: s?.product || m.product || d?.product || "",
            unit: s?.unit || m.unit || d?.unit || "kg",
            category: s?.category || "",
            quantity: matchQty(m),
            supplyType: s?.supplyType || "onhand",
            availabilityDate: s?.availabilityDate || null,
            location: s?.location || "",
            image: s?.image || "",
            pricePerUnit: s?.pricePerUnit || 0,
            farmerName: s ? farmerName.get(String(s.farmer)) || "Farmer" : "Farmer",
            requestedQuantity: d?.quantity || 0,
            neededDate: d?.neededDate || null,
            hasPhoto: photos.has(String(m._id)),
            order: orders.get(String(m._id)) || null,
            createdAt: m.createdAt,
          };
        }),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load my matches error");
    }
  });

  // Farmer attaches a photo of the products to a match (before or after confirming).
  // Body: { image } (a small JPG/PNG/WEBP data URL) or { useListing: true } to use the listing photo.
  router.post("/matches/:id/photo", writeLimiter, async (req, res) => {
    try {
      if (req.user.role !== "farmer") return res.status(403).json({ error: "Only the farmer can add this photo." });
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Match not found." });
      const found = findMatchModel();
      if (!found) return res.status(501).json({ error: "Matches could not be read on the server." });
      const { Model, supplyKey, demandKey } = found;

      const m = await Model.findById(req.params.id).lean();
      if (!m) return res.status(404).json({ error: "Match not found." });
      const supply = await Supply.findById(m[supplyKey]).select("farmer product image").lean();
      if (!supply || String(supply.farmer) !== String(req.user.id)) return res.status(404).json({ error: "Match not found." });
      if (!["pending_confirmation", "confirmed"].includes(m.status)) {
        return res.status(409).json({ error: "This match is closed." });
      }

      let image = "";
      if (req.body?.useListing) {
        image = supply.image || "";
        if (!image) return res.status(400).json({ error: "This product has no listing photo. Upload a photo." });
      } else {
        image = String(req.body?.image || "");
        if (!image || image.length > MAX_MATCH_PHOTO || !IMAGE_RE.test(image)) {
          return res.status(400).json({ error: "Upload a JPG, PNG or WEBP photo." });
        }
      }

      await MatchPhoto.findOneAndUpdate(
        { match: m._id },
        { $set: { farmer: req.user.id, image } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      // If the match is already confirmed, tell the buyer there is a photo to see.
      if (m.status === "confirmed") {
        try {
          const demand = await Demand.findById(m[demandKey]).select("buyer").lean();
          const mod = await import("./noticeModel.js");
          if (demand && typeof mod.notify === "function") {
            await mod.notify(
              demand.buyer,
              "match_confirmed",
              "Photo of your confirmed match",
              `The farmer added a photo of ${supply.product}. Open Matches and tap View details.`,
              m._id
            );
          }
        } catch (err) {
          console.error("Notice not sent:", err?.message || err);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      respondWithSafeError(res, err, "Save match photo error");
    }
  });

  // The photo of a match: the buyer who owns the requirement or the farmer who owns the supply.
  router.get("/matches/:id/photo", async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Match not found." });
      const found = findMatchModel();
      if (!found) return res.status(501).json({ error: "Matches could not be read on the server." });
      const { Model, supplyKey, demandKey } = found;

      const m = await Model.findById(req.params.id).lean();
      if (!m) return res.status(404).json({ error: "Match not found." });
      const [demand, supply] = await Promise.all([
        Demand.findById(m[demandKey]).select("buyer").lean(),
        Supply.findById(m[supplyKey]).select("farmer").lean(),
      ]);
      const buyerOk = req.user.role === "buyer" && demand && String(demand.buyer) === String(req.user.id);
      const farmerOk = req.user.role === "farmer" && supply && String(supply.farmer) === String(req.user.id);
      if (!buyerOk && !farmerOk) return res.status(404).json({ error: "Match not found." });

      const p = await MatchPhoto.findOne({ match: m._id }).select("image").lean();
      if (!p) return res.status(404).json({ error: "No photo yet." });
      res.json({ image: p.image });
    } catch (err) {
      respondWithSafeError(res, err, "Load match photo error");
    }
  });

  // Buyer pre-orders a CONFIRMED match: Pick Up or Delivery, then it is tracked in My Pre Orders.
  router.post("/matches/:id/preorder", writeLimiter, async (req, res) => {
    try {
      if (req.user.role !== "buyer") return res.status(403).json({ error: "Only buyers can pre-order." });
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Match not found." });
      const found = findMatchModel();
      if (!found) return res.status(501).json({ error: "Matches could not be read on the server." });
      const { Model, supplyKey, demandKey } = found;

      const m = await Model.findById(req.params.id).lean();
      if (!m) return res.status(404).json({ error: "Match not found." });
      const demand = await Demand.findById(m[demandKey]).select("buyer neededDate").lean();
      if (!demand || String(demand.buyer) !== String(req.user.id)) return res.status(404).json({ error: "Match not found." });
      if (m.status !== "confirmed") return res.status(409).json({ error: "The farmer has not confirmed this match yet." });
      if (await MatchOrder.exists({ match: m._id })) {
        return res.status(409).json({ error: "You already pre-ordered this match. Track it in My Pre Orders." });
      }

      const b = req.body || {};
      const fulfillment = b.fulfillment === "delivery" ? "delivery" : b.fulfillment === "pickup" ? "pickup" : null;
      if (!fulfillment) return res.status(400).json({ error: "Choose Pick Up or Delivery." });
      const deliveryAddress = String(b.deliveryAddress || "").trim().slice(0, 200);
      if (fulfillment === "delivery" && deliveryAddress.length < 5) {
        return res.status(400).json({ error: "Enter the delivery address." });
      }
      const neededDate = String(b.neededDate || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(neededDate)) return res.status(400).json({ error: "Select the date you need it." });
      if (neededDate < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: "Date cannot be in the past." });

      const supply = await Supply.findById(m[supplyKey]).lean();
      if (!supply) return res.status(404).json({ error: "This supply is no longer available." });
      const qty = round2(matchQty(m));
      if (!(qty > 0)) return res.status(400).json({ error: "This match has no quantity." });

      // The farmer already confirmed this match, so the order starts at "accepted".
      // The quantity was reserved when the farmer confirmed, so it is not taken off again.
      const doc = await PreOrderRequest.create({
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
        status: "confirmed",
        held: true,
        fulfillment,
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress : "",
        deliveryFee: deliveryFee(qty, fulfillment),
        orderStatus: "accepted",
        orderHistory: [{ status: "accepted", at: new Date() }],
      });

      try {
        await MatchOrder.create({ match: m._id, order: doc._id, buyer: req.user.id });
      } catch (err) {
        await PreOrderRequest.deleteOne({ _id: doc._id });
        if (err?.code === 11000) {
          return res.status(409).json({ error: "You already pre-ordered this match. Track it in My Pre Orders." });
        }
        throw err;
      }

      const buyer = await mongoose.model("User").findById(req.user.id).select("name").lean();
      const how = fulfillment === "delivery" ? `delivery, fee ₱${doc.deliveryFee}` : "pick up";
      await sendNotice(
        supply.farmer,
        "request_created",
        "Confirmed match ordered",
        `${buyer?.name || "A buyer"} chose ${how} for the confirmed match: ${qty} ${supply.unit} of ${supply.product}, needed by ${neededDate}. Open Order Management.`
      );

      res.status(201).json({ order: toDto(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Pre-order match error");
    }
  });

  // Older farmer-profile route (Find Supply now uses /supplies/farmer/:id).
  router.get("/farmer/:supplyId", async (req, res) => {
    try {
      if (!isValidId(req.params.supplyId)) return res.status(404).json({ error: "Supply not found." });
      const supply = await Supply.findById(req.params.supplyId).lean();
      if (!supply) return res.status(404).json({ error: "Supply not found." });

      const User = mongoose.model("User");
      const u = await User.findById(supply.farmer).lean();
      if (!u) return res.status(404).json({ error: "Farmer not found." });

      const sources = [u];
      for (const name of ["FarmerProfile", "Profile", "RoleApplication"]) {
        const Model = mongoose.models[name];
        if (!Model) continue;
        try {
          const doc = await Model.findOne({
            $or: [{ user: u._id }, { userId: u._id }, { farmer: u._id }, { owner: u._id }],
          }).lean();
          if (doc) sources.push(doc, doc.farmerProfile, doc.details, doc.data);
        } catch { /* ignore */ }
      }
      const list = sources.filter(Boolean);
      const pick = (...keys) => {
        for (const o of list) {
          for (const k of keys) {
            const v = o[k];
            if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
          }
        }
        return "";
      };

      res.json({
        farmer: {
          name: pick("name", "fullName"),
          businessName: pick("businessName", "business", "farmName", "farm", "companyName"),
          email: pick("email"),
          phone: pick("phone", "mobile", "contactNumber", "phoneNumber"),
          address: pick("address", "farmAddress", "barangay"),
          location: pick("location", "municipality", "city", "province") || supply.location || "",
          farmSize: pick("farmSize", "farmArea", "landSize"),
          crops: pick("crops", "mainCrops", "products"),
          about: pick("about", "description", "bio"),
          memberSince: u.createdAt || null,
        },
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load farmer profile error");
    }
  });

  // Older create route. New pre-orders from Find Supply use POST /supplies/orders,
  // which also holds the quantity right away.
  router.post("/", writeLimiter, async (req, res) => {
    try {
      if (req.user.role !== "buyer") {
        return res.status(403).json({ error: "Only buyers can pre-order supply." });
      }

      const { supplyId, quantity, neededDate, notes } = req.body || {};
      const kind = req.body?.kind === "supply_request" ? "supply_request" : "preorder";
      if (!isValidId(supplyId)) return res.status(404).json({ error: "Supply not found." });

      const qty = round2(Number(quantity));
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: "Enter a quantity greater than 0." });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(neededDate || ""))) {
        return res.status(400).json({ error: "Select the date you need it." });
      }
      const today = new Date().toISOString().slice(0, 10);
      if (neededDate < today) return res.status(400).json({ error: "Date cannot be in the past." });

      const supply = await Supply.findById(supplyId).lean();
      const approved = !supply?.approvalStatus || supply.approvalStatus === "approved";
      if (!supply || supply.status !== "available" || supply.targetDemand || !approved) {
        return res.status(404).json({ error: "This supply is no longer available." });
      }
      const available = Number(supply.availableQuantity || 0);
      if (qty > available) {
        return res.status(400).json({ error: `Only ${available} ${supply.unit} is available.` });
      }

      const dup = await PreOrderRequest.exists({
        supply: supply._id,
        requester: req.user.id,
        status: "pending_confirmation",
      });
      if (dup) {
        return res.status(409).json({ error: "You already have a pending pre-order on this product." });
      }

      const doc = await PreOrderRequest.create({
        supply: supply._id,
        owner: supply.farmer,
        requester: req.user.id,
        kind,
        product: supply.product,
        unit: supply.unit,
        supplyType: supply.supplyType || "onhand",
        location: supply.location || "",
        quantity: qty,
        neededDate,
        notes: String(notes || "").trim().slice(0, 300),
      });

      const msg = doc.notes ? ` Message: "${doc.notes}"` : "";
      await sendNotice(
        supply.farmer,
        "request_created",
        `New ${kindText(doc)}`,
        `A buyer wants ${qtyText(doc)}, needed by ${neededDate}.${msg}`,
        doc._id
      );

      res.status(201).json({ request: toDto(doc) });
    } catch (err) {
      respondWithSafeError(res, err, "Create request error");
    }
  });

  // Buyer: My Requests.
  router.get("/mine", async (req, res) => {
    try {
      const rows = await PreOrderRequest.find({ requester: req.user.id }).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ requests: rows.map(toDto) });
    } catch (err) {
      respondWithSafeError(res, err, "Load my requests error");
    }
  });

  // Farmer: Requests page.
  router.get("/incoming", async (req, res) => {
    try {
      const rows = await PreOrderRequest.find({ owner: req.user.id }).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ requests: rows.map(toDto) });
    } catch (err) {
      respondWithSafeError(res, err, "Load incoming requests error");
    }
  });

  // Farmer accepts: the order starts at "accepted" and shows in Order Management.
  router.post("/:id/accept", writeLimiter, async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Request not found." });

      const pending = await PreOrderRequest.findOne({
        _id: req.params.id,
        owner: req.user.id,
        status: "pending_confirmation",
      });
      if (!pending) return res.status(409).json({ error: "This request is no longer waiting for your answer." });

      // Orders made before the "hold" change still need their quantity reserved now.
      if (!pending.held) {
        const reserved = await Supply.findOneAndUpdate(
          { _id: pending.supply, status: "available", availableQuantity: { $gte: pending.quantity } },
          { $inc: { reservedQuantity: pending.quantity, availableQuantity: -pending.quantity } },
          { returnDocument: "after" }
        );
        if (!reserved) {
          return res.status(409).json({ error: "Not enough quantity left to accept this request." });
        }
      }

      const r = await PreOrderRequest.findOneAndUpdate(
        { _id: pending._id, status: "pending_confirmation" },
        {
          $set: { status: "confirmed", orderStatus: "accepted" },
          $push: { orderHistory: { status: "accepted", at: new Date() } },
        },
        { returnDocument: "after" }
      );
      if (!r) {
        // Someone changed it at the same moment: give back what we reserved just now.
        if (!pending.held) {
          await Supply.updateOne(
            { _id: pending.supply },
            { $inc: { reservedQuantity: -pending.quantity, availableQuantity: pending.quantity } }
          );
        }
        return res.status(409).json({ error: "This request is no longer waiting for your answer." });
      }

      await sendNotice(
        r.requester,
        "request_confirmed",
        "Pre-order accepted",
        `Your ${kindText(r)} for ${qtyText(r)} was accepted. Farmer confirmed your pre-order. Track it in My Pre Orders.`,
        r._id
      );
      res.json({ request: toDto(r) });
    } catch (err) {
      respondWithSafeError(res, err, "Accept request error");
    }
  });

  // Farmer declines: the held quantity goes back to the supply.
  router.post("/:id/decline", writeLimiter, async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Request not found." });
      const r = await PreOrderRequest.findOneAndUpdate(
        { _id: req.params.id, owner: req.user.id, status: "pending_confirmation" },
        { status: "declined" },
        { returnDocument: "after" }
      );
      if (!r) return res.status(409).json({ error: "This request is no longer waiting for your answer." });

      await releaseHeld(r);
      await sendNotice(
        r.requester,
        "request_declined",
        "Pre-order declined",
        `Your ${kindText(r)} for ${qtyText(r)} was declined.`,
        r._id
      );
      res.json({ request: toDto(r) });
    } catch (err) {
      respondWithSafeError(res, err, "Decline request error");
    }
  });

  // Buyer cancels while it is still waiting: the held quantity goes back.
  router.post("/:id/cancel", writeLimiter, async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: "Request not found." });
      const r = await PreOrderRequest.findOneAndUpdate(
        { _id: req.params.id, requester: req.user.id, status: "pending_confirmation" },
        { status: "cancelled" },
        { returnDocument: "after" }
      );
      if (!r) return res.status(409).json({ error: "This request can no longer be cancelled." });

      await releaseHeld(r);
      await sendNotice(
        r.owner,
        "request_cancelled",
        "Pre-order cancelled",
        `A ${kindText(r)} for ${qtyText(r)} was cancelled by the buyer.`,
        r._id
      );
      res.json({ request: toDto(r) });
    } catch (err) {
      respondWithSafeError(res, err, "Cancel request error");
    }
  });

  return router;
}