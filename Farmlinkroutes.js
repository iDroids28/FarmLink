import express from "express";
import mongoose from "mongoose";
import { authenticate } from "./security.js";
import { Application, Requirement, Supply, Notification } from "./farmlinkModels.js";
import { Demand as FarmDemand, Supply as FarmSupply } from "./farmModels.js";
import { Match as FarmMatch } from "./matchModel.js";
import { businessProfileFor } from "./businessProfile.js";
import { removeDemandAsAdmin } from "./matchingEngine.js";
import { notify } from "./noticeModel.js";

const UNITS = ["kg", "sack", "piece", "bundle"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,/;
const MAX_PHOTO_CHARS = 300000; // about 220 KB of image data
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const bad = (res, msg) => res.status(400).json({ error: msg });
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const ser = (d, prefix) => {
  const o = d.toObject ? d.toObject() : d;
  const id = String(o._id);
  return { ...o, id, code: prefix ? `${prefix}-${id.slice(-5).toUpperCase()}` : undefined };
};

// Greedy matching: each open requirement takes supply of the same product + unit.
function computeMatching(reqs, sups) {
  const left = new Map(sups.map((s) => [String(s._id), s.quantity]));
  const rows = [];
  const info = {};
  for (const r of reqs) {
    const rid = String(r._id);
    if (r.closed) {
      info[rid] = { matched: 0, status: "Closed" };
      continue;
    }
    let need = r.quantity;
    const parts = [];
    for (const s of sups) {
      const sid = String(s._id);
      if (need <= 0) break;
      if (s.product.toLowerCase() !== r.product.toLowerCase() || s.unit !== r.unit || left.get(sid) <= 0) continue;
      const take = Math.min(need, left.get(sid));
      left.set(sid, left.get(sid) - take);
      need -= take;
      parts.push({ farmer: s.farmerName, farmerId: String(s.farmer), quantity: take });
    }
    const matched = r.quantity - need;
    info[rid] = {
      matched,
      status: matched === 0 ? "Pending" : matched < r.quantity ? "Partially Matched" : "Fully Matched",
    };
    const base = {
      reqId: rid, product: r.product, unit: r.unit, buyer: r.buyerName, buyerId: String(r.buyer),
      status: matched === 0 ? "Unmatched" : matched < r.quantity ? "Partial" : "Matched",
    };
    if (parts.length === 0) rows.push({ ...base, farmer: "—", farmerId: "", quantity: r.quantity });
    else parts.forEach((p) => rows.push({ ...base, ...p }));
  }
  return { rows, info };
}

async function matching() {
  const [reqs, sups] = await Promise.all([
    Requirement.find().sort({ createdAt: 1 }).lean(),
    Supply.find().sort({ createdAt: 1 }).lean(),
  ]);
  return { reqs, sups, ...computeMatching(reqs, sups) };
}

export default function createFarmlinkRouter({ User }) {
  const router = express.Router();

  // Open test route: http://localhost:5000/api/farmlink/ping
  router.get("/ping", (req, res) => res.json({ ok: true }));

  // Everything below needs a logged-in user (your existing authenticate).
  router.use(authenticate);

  // Load the current user from MongoDB so the role is always up to date.
  router.use(
    wrap(async (req, res, next) => {
      const me = await User.findById(req.user.id).select("name email role");
      if (!me) return res.status(401).json({ error: "Session no longer valid." });
      req.me = me;
      next();
    })
  );

  // Role check. Ignores capital letters, and a missing role counts as "buyer".
  const allow = (...roles) => (req, res, next) => {
    const role = String(req.me.role || "buyer").toLowerCase();
    return roles.includes(role)
      ? next()
      : res.status(403).json({ error: "You don't have access to this." });
  };
  const admin = allow("admin");

  /* ---------------- requirements (buyers AND approved farmers) ---------------- */
  router.get("/requirements/mine", allow("buyer", "farmer"), wrap(async (req, res) => {
    const { reqs, info } = await matching();
    const mine = reqs
      .filter((r) => String(r.buyer) === String(req.me._id))
      .map((r) => ({ ...ser(r, "REQ"), ...info[String(r._id)] }))
      .reverse();
    res.json({ requirements: mine });
  }));

  router.post("/requirements", allow("buyer", "farmer"), wrap(async (req, res) => {
    const b = req.body || {};
    const product = str(b.product, 60);
    const quantity = Number(b.quantity);
    const unit = UNITS.includes(b.unit) ? b.unit : "kg";
    const neededDate = str(b.neededDate, 10);
    const location = str(b.location, 120);
    const targetPrice = b.targetPrice === "" || b.targetPrice == null ? undefined : Number(b.targetPrice);

    if (!product) return bad(res, "Please enter the product name.");
    if (!(quantity > 0 && quantity <= 10000000)) return bad(res, "Please enter a valid quantity.");
    if (!DATE_RE.test(neededDate)) return bad(res, "Please select the needed date.");
    if (!location) return bad(res, "Please enter the delivery location.");
    if (targetPrice !== undefined && !(targetPrice >= 0)) return bad(res, "Target price is not valid.");

    const doc = await Requirement.create({
      buyer: req.me._id, buyerName: req.me.name || req.me.email,
      product, quantity, unit, neededDate, location, targetPrice,
      category: str(b.category, 40),
      notes: str(b.notes, 500),
    });
    res.status(201).json({ requirement: ser(doc, "REQ") });
  }));

  router.patch("/requirements/:id/close", allow("buyer", "farmer"), wrap(async (req, res) => {
    const doc = await Requirement.findOneAndUpdate(
      { _id: req.params.id, buyer: req.me._id }, { closed: true }, { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  }));

  /* ---------------- FARMER: supply ---------------- */
  router.get("/supplies/mine", allow("farmer"), wrap(async (req, res) => {
    const { sups, rows } = await matching();
    const me = String(req.me._id);
    res.json({
      supplies: sups.filter((s) => String(s.farmer) === me).map((s) => ser(s, "SUP")).reverse(),
      matchCount: rows.filter((r) => r.farmerId === me).length,
    });
  }));

  router.post("/supplies", allow("farmer"), wrap(async (req, res) => {
    const b = req.body || {};
    const product = str(b.product, 60);
    const quantity = Number(b.quantity);
    const unit = UNITS.includes(b.unit) ? b.unit : "kg";
    const availableDate = str(b.availableDate, 10);
    if (!product) return bad(res, "Please enter the product name.");
    if (!(quantity > 0 && quantity <= 10000000)) return bad(res, "Please enter a valid quantity.");
    if (!DATE_RE.test(availableDate)) return bad(res, "Please select the available date.");
    const doc = await Supply.create({
      farmer: req.me._id, farmerName: req.me.name || req.me.email, product, quantity, unit, availableDate,
    });
    res.status(201).json({ supply: ser(doc, "SUP") });
  }));

  router.delete("/supplies/:id", allow("farmer"), wrap(async (req, res) => {
    const doc = await Supply.findOneAndDelete({ _id: req.params.id, farmer: req.me._id });
    if (!doc) return res.status(404).json({ error: "Not found." });
    res.json({ ok: true });
  }));

  /* ---------------- matches (buyer or farmer) ---------------- */
  router.get("/matches/mine", allow("buyer", "farmer"), wrap(async (req, res) => {
    const { rows } = await matching();
    const me = String(req.me._id);
    // A farmer can also be a buyer, so show rows where the user is on either side.
    res.json({ rows: rows.filter((r) => r.buyerId === me || r.farmerId === me) });
  }));

  /* ---------------- seller applications ---------------- */
  router.get("/applications/mine", allow("buyer", "farmer"), wrap(async (req, res) => {
    // The photo is left out here: this route is checked every 10 seconds.
    const app = await Application.findOne({ user: req.me._id }).select("-photo").sort({ createdAt: -1 }).lean();
    res.json({ application: app ? ser(app) : null });
  }));

  router.post("/applications", allow("buyer", "farmer"), wrap(async (req, res) => {
    if (String(req.me.role).toLowerCase() === "farmer") {
      return res.status(409).json({ error: "You are already an approved Farmer / Seller." });
    }

    const b = req.body || {};
    const farmName = str(b.farmName, 80);
    const location = str(b.location, 120);
    const products = str(b.products, 200);
    const photo = typeof b.photo === "string" ? b.photo : "";

    if (!farmName) return bad(res, "Please enter your farm name.");
    if (!location) return bad(res, "Please enter your farm location.");
    if (!products) return bad(res, "Please list the products you sell.");
    if (!PHOTO_RE.test(photo)) return bad(res, "Please upload a photo of your farm or products.");
    if (photo.length > MAX_PHOTO_CHARS) return bad(res, "The photo is too large. Please choose a smaller one.");

    if (await Application.exists({ user: req.me._id, status: "Pending" })) {
      return res.status(409).json({ error: "You already have a pending application." });
    }
    const doc = await Application.create({
      user: req.me._id, name: req.me.name, email: req.me.email,
      fullName: str(b.fullName, 80) || req.me.name,
      farmName, location, products,
      farmSize: str(b.farmSize, 10),
      experience: str(b.experience, 10),
      description: str(b.description, 500),
      photo,
    });
    res.status(201).json({ application: ser(doc) });
  }));

  /* ---------------- notifications (everyone) ---------------- */
  router.get("/notifications/mine", wrap(async (req, res) => {
    const groups = { farmer: "farmers", buyer: "buyers" };
    const or = [{ audience: "all" }, { audience: "user", user: req.me._id }];
    const role = String(req.me.role || "buyer").toLowerCase();
    if (groups[role]) or.push({ audience: groups[role] });
    const list = await Notification.find({ $or: or }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ notifications: list.map((n) => ser(n)) });
  }));

  /* ---------------- ADMIN ---------------- */
  router.get("/admin/overview", admin, wrap(async (req, res) => {
    const [users, farmers, buyers, pending] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "farmer" }),
      User.countDocuments({ role: "buyer" }),
      Application.find({ status: "Pending" }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ totals: { users, farmers, buyers, pending: pending.length }, pending: pending.map((a) => ser(a)) });
  }));

  router.get("/admin/applications", admin, wrap(async (req, res) => {
    const list = await Application.find().sort({ createdAt: -1 }).lean();
    res.json({ applications: list.map((a) => ser(a)) });
  }));

  router.patch("/admin/applications/:id", admin, wrap(async (req, res) => {
    const decision = req.body?.decision;
    if (!["approve", "reject"].includes(decision)) return bad(res, "Decision must be approve or reject.");
    const approve = decision === "approve";

    // Only a still-Pending application can be reviewed (blocks double-clicks).
    const app = await Application.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      { status: approve ? "Approved" : "Rejected" },
      { new: true }
    );
    if (!app) return res.status(409).json({ error: "This application was already reviewed." });

    if (approve) await User.findByIdAndUpdate(app.user, { role: "farmer" });
    await Notification.create({
      audience: "user", user: app.user,
      title: approve ? "Seller application approved" : "Seller application rejected",
      message: approve
        ? "Congratulations! You are now an approved Farmer / Seller. My Supply is unlocked."
        : "Sorry, your application was not approved. You may review your details and apply again.",
    });
    res.json({ application: ser(app) });
  }));

  router.get("/admin/farmers", admin, wrap(async (req, res) => {
    const users = await User.find({ role: "farmer" }).select("name email").lean();
    const userIds = users.map((u) => u._id);
    const [apps, profiles] = await Promise.all([
      Application.find({ status: "Approved", user: { $in: userIds } }).sort({ createdAt: 1 }).lean(),
      // Read both ObjectId and legacy string userId values without exposing other profile fields.
      Application.db.collection("profiles").find(
        { userId: { $in: [...userIds, ...userIds.map((id) => String(id))] } },
        { projection: { userId: 1, photo: 1 } }
      ).toArray(),
    ]);
    const byUser = new Map(apps.map((a) => [String(a.user), a]));
    const photoByUser = new Map(profiles.map((p) => [String(p.userId), p.photo || ""]));
    res.json({
      farmers: users.map((u) => {
        const a = byUser.get(String(u._id)) || {};
        return {
          id: String(u._id), name: u.name, email: u.email,
          photo: photoByUser.get(String(u._id)) || "",
          farmName: a.farmName, location: a.location, contact: a.contact, farmSize: a.farmSize, products: a.products,
        };
      }),
    });
  }));

  router.get("/admin/buyers", admin, wrap(async (req, res) => {
    const users = await User.find({ role: "buyer" }).select("name email").lean();
    const counts = await FarmDemand.aggregate([{ $group: { _id: "$buyer", n: { $sum: 1 } } }]);
    const map = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({
      buyers: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, reqCount: map.get(String(u._id)) || 0 })),
    });
  }));

  router.get("/admin/supplies", admin, wrap(async (req, res) => {
    const list = await Supply.find().sort({ createdAt: -1 }).lean();
    res.json({ supplies: list.map((s) => ser(s, "SUP")) });
  }));

  router.get("/admin/requirements", admin, wrap(async (req, res) => {
    const demands = await FarmDemand.find()
      .populate("buyer", "name email role")
      .sort({ createdAt: -1 })
      .lean();
    const demandIds = demands.map((d) => d._id);
    const confirmedDemands = demandIds.length
      ? await FarmMatch.distinct("demand", { demand: { $in: demandIds }, status: "confirmed" })
      : [];
    const confirmed = new Set(confirmedDemands.map(String));
    res.json({ requirements: demands.map((d) => ({
      id: String(d._id),
      code: `DEM-${String(d._id).slice(-5).toUpperCase()}`,
      buyerId: d.buyer?._id ? String(d.buyer._id) : String(d.buyer || ""),
      buyerName: d.buyer?.name || "Business / Buyer",
      buyerEmail: d.buyer?.email || "",
      product: d.product,
      category: d.category || "",
      quantity: d.quantity,
      unit: d.unit,
      neededDate: d.neededDate,
      location: d.location,
      status: d.status,
      matchedQuantity: Number(d.matchedQuantity || 0),
      adminRemovalReason: d.adminRemovalReason || "",
      adminRemovedAt: d.adminRemovedAt || null,
      canRemove: !confirmed.has(String(d._id)) && !["cancelled", "expired", "completed"].includes(d.status),
      createdAt: d.createdAt,
    })) });
  }));

  router.get("/admin/buyers/:id/profile", admin, wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Buyer not found." });
    const buyer = await User.findById(req.params.id).select("name email role createdAt verificationStatus").lean();
    if (!buyer || buyer.role !== "buyer") return res.status(404).json({ error: "Buyer not found." });
    const Profile = mongoose.models.Profile;
    const stored = Profile
      ? await Profile.findOne({ userId: buyer._id }).select("photo phone address business").lean()
      : null;
    // Some older profile records may store userId as a string rather than an ObjectId.
    // Read the same profiles collection as a fallback so a saved profile photo is not missed.
    const needsPhotoFallback = typeof stored?.photo !== "string" || !stored.photo.trim();
    const storedFallback = needsPhotoFallback
      ? await mongoose.connection.collection("profiles").findOne(
          { $or: [{ userId: buyer._id }, { userId: String(buyer._id) }] },
          { projection: { photo: 1, phone: 1, address: 1, business: 1 } }
        )
      : null;
    const profilePhoto =
      (typeof stored?.photo === "string" && stored.photo.trim() ? stored.photo : "") ||
      (typeof storedFallback?.photo === "string" && storedFallback.photo.trim() ? storedFallback.photo : "");
    const approved = await businessProfileFor(buyer._id);
    const pBusiness = stored?.business || storedFallback?.business || {};
    res.json({
      buyer: {
        id: String(buyer._id), name: buyer.name || "Business / Buyer", email: buyer.email || "",
        role: buyer.role, verificationStatus: buyer.verificationStatus || "none", createdAt: buyer.createdAt,
      },
      profile: {
        photo: profilePhoto, phone: stored?.phone || storedFallback?.phone || approved?.mobile || "", address: stored?.address || storedFallback?.address || approved?.businessAddress || "",
        businessName: approved?.businessName || pBusiness.name || "",
        businessType: approved?.businessType || pBusiness.orgType || "",
        businessAddress: approved?.businessAddress || pBusiness.address || "",
        representative: approved?.representative || pBusiness.contactPerson || "",
        businessEmail: approved?.businessEmail || buyer.email || "",
        mobile: approved?.mobile || stored?.phone || "",
      },
    });
  }));

  router.post("/admin/requirements/:id/remove", admin, wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Demand not found." });
    const reason = str(req.body?.reason, 500);
    if (reason.length < 5) return bad(res, "Please provide a removal reason of at least 5 characters.");
    const demand = await FarmDemand.findById(req.params.id).select("buyer product quantity unit status").lean();
    if (!demand) return res.status(404).json({ error: "Demand not found." });
    const result = await removeDemandAsAdmin(req.params.id, req.me._id, reason);
    if (result === "not_found") return res.status(404).json({ error: "Demand not found." });
    if (result !== "ok") return res.status(409).json({ error: "This demand has a confirmed pre-order or is already inactive, so it cannot be removed safely." });
    await notify(
      demand.buyer, "demand_removed_by_admin", "Your demand was removed",
      `Your demand for ${demand.product} (${demand.quantity} ${demand.unit}) was removed by a FarmLink administrator. Reason: ${reason}`,
      null, null, req.params.id
    );
    res.json({ ok: true, reason });
  }));

  router.get("/admin/matchings", admin, wrap(async (req, res) => {
    const manilaParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const manilaToday = `${manilaParts.find((x) => x.type === "year")?.value}-${manilaParts.find((x) => x.type === "month")?.value}-${manilaParts.find((x) => x.type === "day")?.value}`;
    const todayStart = new Date(`${manilaToday}T00:00:00+08:00`);
    const legacyExpiryCutoff = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const [matchDocs, demands, supplies] = await Promise.all([
      FarmMatch.find()
        .populate("buyer", "name email role")
        .populate("farmer", "name email role")
        .populate("demand", "status quantity adminRemovalReason")
        .populate("supply", "status supplyType category targetDemand")
        .sort({ createdAt: -1 })
        .lean(),
      FarmDemand.find({ status: { $in: ["open", "potential_match", "pending_confirmation", "partially_matched", "matched"] } }).select("product unit quantity matchedQuantity status").lean(),
      FarmSupply.find({
        status: "available", approvalStatus: "approved", availableQuantity: { $gt: 0 },
        $or: [
          { supplyType: { $ne: "onhand" } },
          { supplyType: "onhand", expiresAt: { $gte: todayStart } },
          { supplyType: "onhand", $and: [ { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] }, { createdAt: { $gte: legacyExpiryCutoff } } ] },
        ],
      }).select("product unit availableQuantity").lean(),
    ]);
    const confirmedIds = new Set(matchDocs.filter((m) => m.status === "confirmed" && m.demand?._id).map((m) => String(m.demand._id)));
    const rows = matchDocs.map((m) => {
      const demandId = m.demand?._id ? String(m.demand._id) : String(m.demand || "");
      const demandStatus = m.demand?.status || "unknown";
      return {
        id: String(m._id), code: `MAT-${String(m._id).slice(-5).toUpperCase()}`,
        demandId, demandStatus, adminRemovalReason: m.demand?.adminRemovalReason || "",
        buyerId: m.buyer?._id ? String(m.buyer._id) : String(m.buyer || ""),
        buyerName: m.buyer?.name || "Business / Buyer", buyerEmail: m.buyer?.email || "",
        farmerId: m.farmer?._id ? String(m.farmer._id) : String(m.farmer || ""),
        farmerName: m.farmer?.name || "Farmer", farmerEmail: m.farmer?.email || "",
        product: m.product, quantity: m.quantity, unit: m.unit, location: m.location,
        neededDate: m.neededDate, availabilityDate: m.availabilityDate, status: m.status,
        createdAt: m.createdAt,
        canRemoveDemand: Boolean(demandId) && !confirmedIds.has(demandId) && !["cancelled", "expired", "completed", "unknown"].includes(demandStatus),
      };
    });
    const map = new Map();
    const keyFor = (product, unit) => `${String(product || "").trim().toLowerCase()}::${String(unit || "").trim().toLowerCase()}`;
    const add = (product, unit, field, value) => {
      const k = keyFor(product, unit);
      if (!map.has(k)) map.set(k, { product, unit, demand: 0, supply: 0 });
      map.get(k)[field] += Number(value || 0);
    };
    for (const d of demands) add(d.product, d.unit, "demand", Math.max(0, Number(d.quantity || 0) - Number(d.matchedQuantity || 0)));
    for (const s of supplies) add(s.product, s.unit, "supply", s.availableQuantity);
    const balance = [...map.values()].map((m) => {
      const demand = Math.round(m.demand * 100) / 100;
      const supply = Math.round(m.supply * 100) / 100;
      return {
        product: m.product, unit: m.unit, demand, supply,
        result: demand > supply ? "Shortage" : supply > demand ? "Surplus" : "Balanced",
        diff: Math.round(Math.abs(demand - supply) * 100) / 100,
      };
    }).sort((a, b) => a.product.localeCompare(b.product) || a.unit.localeCompare(b.unit));
    res.json({ rows, matches: rows, balance });
  }));

  router.post("/admin/announcements", admin, wrap(async (req, res) => {
    const audience = ["all", "farmers", "buyers"].includes(req.body?.audience) ? req.body.audience : "all";
    const title = str(req.body?.title, 100);
    const message = str(req.body?.message, 1000);
    if (!title || !message) return bad(res, "Please enter a title and a message.");
    await Notification.create({ audience, title, message, announcement: true });
    res.status(201).json({ ok: true });
  }));

  router.get("/admin/notifications", admin, wrap(async (req, res) => {
    const list = await Notification.find().sort({ createdAt: -1 }).limit(100).populate("user", "email").lean();
    res.json({
      notifications: list.map((n) => ({ ...ser(n), to: n.audience === "user" ? n.user?.email || "user" : n.audience })),
    });
  }));

  // Invalid ids, etc. Anything else goes to your central error handler.
  router.use((err, req, res, next) => {
    if (err?.name === "CastError") return res.status(400).json({ error: "Invalid id." });
    next(err);
  });

  return router;
}