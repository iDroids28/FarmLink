const express = require("express");
const { Application, Requirement, Supply, Notification } = require("../models/farmlink");
const User = require("../models/User"); // ADAPT: path to your User model
const { requireAuth, allow } = require("../middleware/farmlinkAuth");

const router = express.Router();
router.use(requireAuth);

/* ---------------- helpers ---------------- */
const UNITS = ["kg", "sack", "piece", "bundle"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const bad = (res, msg) => res.status(400).json({ error: msg, message: msg });
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
    if (r.closed) { info[rid] = { matched: 0, status: "Closed" }; continue; }
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
    info[rid] = { matched, status: matched === 0 ? "Pending" : matched < r.quantity ? "Partially Matched" : "Fully Matched" };
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

/* ---------------- BUYER: requirements ---------------- */
router.get("/requirements/mine", allow("buyer"), wrap(async (req, res) => {
  const { reqs, info } = await matching();
  const mine = reqs
    .filter((r) => String(r.buyer) === String(req.user._id))
    .map((r) => ({ ...ser(r, "REQ"), ...info[String(r._id)] }))
    .reverse();
  res.json({ requirements: mine });
}));

router.post("/requirements", allow("buyer"), wrap(async (req, res) => {
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
    buyer: req.user._id, buyerName: req.user.name || req.user.email,
    product, quantity, unit, neededDate, location, targetPrice, notes: str(b.notes, 500),
  });
  res.status(201).json({ requirement: ser(doc, "REQ") });
}));

router.patch("/requirements/:id/close", allow("buyer"), wrap(async (req, res) => {
  const doc = await Requirement.findOneAndUpdate(
    { _id: req.params.id, buyer: req.user._id }, { closed: true }, { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found.", message: "Not found." });
  res.json({ ok: true });
}));

/* ---------------- FARMER: supply ---------------- */
router.get("/supplies/mine", allow("farmer"), wrap(async (req, res) => {
  const { sups, rows } = await matching();
  const me = String(req.user._id);
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
    farmer: req.user._id, farmerName: req.user.name || req.user.email, product, quantity, unit, availableDate,
  });
  res.status(201).json({ supply: ser(doc, "SUP") });
}));

router.delete("/supplies/:id", allow("farmer"), wrap(async (req, res) => {
  const doc = await Supply.findOneAndDelete({ _id: req.params.id, farmer: req.user._id });
  if (!doc) return res.status(404).json({ error: "Not found.", message: "Not found." });
  res.json({ ok: true });
}));

/* ---------------- matches (buyer or farmer) ---------------- */
router.get("/matches/mine", allow("buyer", "farmer"), wrap(async (req, res) => {
  const { rows } = await matching();
  const me = String(req.user._id);
  res.json({ rows: rows.filter((r) => (req.user.role === "buyer" ? r.buyerId === me : r.farmerId === me)) });
}));

/* ---------------- seller applications (buyer) ---------------- */
router.get("/applications/mine", allow("buyer", "farmer"), wrap(async (req, res) => {
  const app = await Application.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ application: app ? ser(app) : null });
}));

router.post("/applications", allow("buyer"), wrap(async (req, res) => {
  const b = req.body || {};
  const farmName = str(b.farmName, 80);
  const location = str(b.location, 120);
  const contact = str(b.contact, 30);
  const products = str(b.products, 200);
  if (!farmName) return bad(res, "Please enter your farm name.");
  if (!location) return bad(res, "Please enter your farm location.");
  if (!contact) return bad(res, "Please enter your contact number.");
  if (!products) return bad(res, "Please list the products you sell.");

  if (await Application.exists({ user: req.user._id, status: "Pending" })) {
    return res.status(409).json({ error: "You already have a pending application.", message: "You already have a pending application." });
  }
  const doc = await Application.create({
    user: req.user._id, name: req.user.name, email: req.user.email,
    farmName, location, contact, products, farmSize: str(b.farmSize, 10), description: str(b.description, 500),
  });
  res.status(201).json({ application: ser(doc) });
}));

/* ---------------- notifications (everyone) ---------------- */
router.get("/notifications/mine", wrap(async (req, res) => {
  const groups = { farmer: "farmers", buyer: "buyers" };
  const q = { $or: [{ audience: "all" }, { audience: "user", user: req.user._id }] };
  if (groups[req.user.role]) q.$or.push({ audience: groups[req.user.role] });
  const list = await Notification.find(q).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ notifications: list.map((n) => ser(n)) });
}));

/* ---------------- ADMIN ---------------- */
const admin = allow("admin");

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
  if (!app) return res.status(409).json({ error: "Already reviewed.", message: "This application was already reviewed." });

  if (approve) await User.findByIdAndUpdate(app.user, { role: "farmer" });
  await Notification.create({
    audience: "user", user: app.user,
    title: approve ? "Seller application approved" : "Seller application rejected",
    message: approve
      ? "Congratulations! You are now an approved Farmer / Seller. Please log out and log in again to open your Seller dashboard."
      : "Sorry, your application was not approved. You may review your details and apply again.",
  });
  res.json({ application: ser(app) });
}));

router.get("/admin/farmers", admin, wrap(async (req, res) => {
  const users = await User.find({ role: "farmer" }).select("name email").lean();
  const apps = await Application.find({ status: "Approved", user: { $in: users.map((u) => u._id) } })
    .sort({ createdAt: 1 }).lean();
  const byUser = new Map(apps.map((a) => [String(a.user), a]));
  res.json({
    farmers: users.map((u) => {
      const a = byUser.get(String(u._id)) || {};
      return { id: String(u._id), name: u.name, email: u.email, farmName: a.farmName, location: a.location, contact: a.contact, farmSize: a.farmSize, products: a.products };
    }),
  });
}));

router.get("/admin/buyers", admin, wrap(async (req, res) => {
  const users = await User.find({ role: "buyer" }).select("name email").lean();
  const counts = await Requirement.aggregate([{ $group: { _id: "$buyer", n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ buyers: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, reqCount: map.get(String(u._id)) || 0 })) });
}));

router.get("/admin/supplies", admin, wrap(async (req, res) => {
  const list = await Supply.find().sort({ createdAt: -1 }).lean();
  res.json({ supplies: list.map((s) => ser(s, "SUP")) });
}));

router.get("/admin/requirements", admin, wrap(async (req, res) => {
  const { reqs, info } = await matching();
  res.json({ requirements: reqs.map((r) => ({ ...ser(r, "REQ"), ...info[String(r._id)] })).reverse() });
}));

router.get("/admin/matchings", admin, wrap(async (req, res) => {
  const { reqs, sups, rows } = await matching();
  const map = {};
  reqs.filter((r) => !r.closed).forEach((r) => {
    const k = r.product.toLowerCase();
    map[k] = map[k] || { product: r.product, demand: 0, supply: 0 };
    map[k].demand += r.quantity;
  });
  sups.forEach((s) => {
    const k = s.product.toLowerCase();
    map[k] = map[k] || { product: s.product, demand: 0, supply: 0 };
    map[k].supply += s.quantity;
  });
  const balance = Object.values(map).map((m) => ({
    ...m,
    result: m.demand > m.supply ? "Shortage" : m.supply > m.demand ? "Surplus" : "Balanced",
    diff: Math.abs(m.demand - m.supply),
  }));
  res.json({ rows, balance });
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
  res.json({ notifications: list.map((n) => ({ ...ser(n), to: n.audience === "user" ? n.user?.email || "user" : n.audience })) });
}));

/* ---------------- error handler ---------------- */
router.use((err, req, res, next) => {
  if (err?.name === "CastError") return res.status(400).json({ error: "Invalid id.", message: "Invalid id." });
  console.error("[farmlink]", err);
  res.status(500).json({ error: "Something went wrong.", message: "Something went wrong." });
});

module.exports = router;