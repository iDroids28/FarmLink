import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { authenticate, requireRole, writeLimiter } from "./security.js";
import { SAFE_MESSAGES } from "./safeErrors.js";
import { RoleApplication } from "./roleApplicationModel.js";
import { Notification } from "./farmlinkModels.js";

/* ------------------------------------------------------------------ */
/* Allowed values                                                      */
/* ------------------------------------------------------------------ */
export const GOV_ID_TYPES = ["National ID", "Driver's License", "Passport", "Other"];
export const PROOF_TYPES = [
  "RSBSA Registration",
  "Barangay Farmer Certification",
  "Proof of Land Ownership",
  "Lease/Tenancy Document",
  "Agriculture Office Certification",
  "Other",
];
export const FARMER_STATUSES = ["Farm Owner", "Tenant", "Lessee", "Farm Worker", "Other"];
export const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "Partnership",
  "Corporation",
  "Cooperative",
  "Other",
];
export const PERMIT_TYPES = ["DTI", "SEC", "CDA", "BIR", "Business/Mayor's Permit", "Other"];

const MB = 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * MB;
const MAX_DOC_BYTES = 5 * MB;
const MAX_MULTI_FILES = 5;

/* ------------------------------------------------------------------ */
/* Private storage (never served statically)                           */
/* ------------------------------------------------------------------ */
// Defaults to <project>/private_uploads/applications. Set PRIVATE_UPLOAD_DIR to
// put it elsewhere (ideally outside the project folder). No express.static is
// ever mounted on this folder; files are only readable through the
// authenticated document route below.
const UPLOAD_DIR = path.resolve(
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private_uploads", "applications")
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });

/* ------------------------------------------------------------------ */
/* File signature check (do not trust browser MIME or file extension)  */
/* ------------------------------------------------------------------ */
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg", image: true };
  }
  if (buf.subarray(0, 8).equals(PNG_SIG)) {
    return { mime: "image/png", ext: "png", image: true };
  }
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp", image: true };
  }
  if (buf.toString("latin1", 0, 5) === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf", image: false };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Small validation helpers                                            */
/* ------------------------------------------------------------------ */
const ID_RE = /^[a-f\d]{24}$/i;
// The next four are kept identical to src/components/applicationInputs.js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' \u2019-]*$/u;
const OTHER_RE = /^[\p{L}\p{N}\p{M}][\p{L}\p{N}\p{M} '\u2019&\/.,()-]*$/u;
const HAS_LETTER = /\p{L}/u;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001F\u007F]/g;

const clean = (v) =>
  typeof v === "string" ? v.replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim() : "";

function text(body, key, label, min, max) {
  const v = clean(body[key]);
  if (!v) return { error: `${label} is required.` };
  if (v.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (v.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value: v };
}

// A person's name: letters, spaces, hyphens and apostrophes only.
function nameField(body, key, label, min, max) {
  const v = clean(body[key]);
  if (v.length < min) return { error: `Please enter your ${label.toLowerCase()}.` };
  if (v.length > max) return { error: `${label} must be at most ${max} characters.` };
  if (!NAME_RE.test(v) || !HAS_LETTER.test(v)) {
    return { error: `${label} can only contain letters, spaces, hyphens, and apostrophes.` };
  }
  return { value: v };
}

// The typed value for an "Other" choice. Stored only when "Other" is selected;
// otherwise stored as an empty string.
function otherField(body, selected, key, label) {
  if (selected !== "Other") return { value: "" };
  const v = clean(body[key]);
  if (v.length < 2 || v.length > 60 || !OTHER_RE.test(v) || !HAS_LETTER.test(v)) {
    return { error: `Please specify your ${label} (2-60 characters).` };
  }
  return { value: v };
}

function emailField(body, key, label) {
  const v = clean(body[key]).toLowerCase();
  if (!v) return { error: `${label} is required.` };
  if (v.length > 120 || !EMAIL_RE.test(v)) return { error: `${label} is not a valid email address.` };
  return { value: v };
}


function pick(body, key, label, list) {
  const v = typeof body[key] === "string" ? body[key] : "";
  if (!list.includes(v)) return { error: `Please select ${label}.` };
  return { value: v };
}

function collect(parts) {
  for (const p of Object.values(parts)) if (p.error) return { error: p.error };
  return { value: Object.fromEntries(Object.entries(parts).map(([k, p]) => [k, p.value])) };
}

function readFarmerFields(body) {
  return collect({
    fullName: nameField(body, "fullName", "Full name", 2, 100),
    email: emailField(body, "email", "Email"),
    address: text(body, "address", "Address", 5, 200),
    farmLocation: text(body, "farmLocation", "Farm location", 3, 200),
    products: text(body, "products", "Main agricultural products/crops", 2, 200),
    farmerStatus: pick(body, "farmerStatus", "your farmer status", FARMER_STATUSES),
    farmerStatusCustom: otherField(body, body.farmerStatus, "farmerStatusCustom", "farmer status"),
  });
}

// "Products/commodities interested in buying" is no longer collected. Old
// records that have it are untouched; new applications simply do not send it.
function readBuyerFields(body) {
  return collect({
    businessName: text(body, "businessName", "Business name", 2, 120),
    businessType: pick(body, "businessType", "a business type", BUSINESS_TYPES),
    businessTypeCustom: otherField(body, body.businessType, "businessTypeCustom", "business type"),
    representative: text(body, "representative", "Authorized representative", 2, 100),
    businessAddress: text(body, "businessAddress", "Business address", 5, 200),
    businessEmail: emailField(body, "businessEmail", "Business email"),
  });
}

function inspectFile(file, label, { imageOnly, maxBytes }) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    return { error: `${label} is required.` };
  }
  if (file.buffer.length > maxBytes) {
    return { error: `${label} must be ${maxBytes / MB} MB or smaller.` };
  }
  const type = sniff(file.buffer);
  if (!type || (imageOnly && !type.image)) {
    return {
      error: imageOnly
        ? `${label} must be a JPG, PNG, or WebP image.`
        : `${label} must be a JPG, PNG, WebP, or PDF file.`,
    };
  }
  return { type };
}

function docSpec(kind, file, docType, customRaw, allowed, label, opts) {
  if (!allowed.includes(docType)) return { error: `Please choose the type for: ${label}.` };
  let customType = "";
  if (docType === "Other") {
    customType = clean(customRaw);
    if (customType.length < 2 || customType.length > 60) {
      return { error: `Please specify the document type for: ${label} (2-60 characters).` };
    }
  }
  const checked = inspectFile(file, label, opts);
  if (checked.error) return checked;
  return { spec: { kind, docType, customType, file, type: checked.type } };
}

function readMeta(raw, count) {
  let arr;
  try {
    arr = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length !== count) return null;
  return arr.map((m) => ({
    type: typeof m?.type === "string" ? m.type : "",
    custom: typeof m?.custom === "string" ? m.custom : "",
  }));
}

const safeName = (n) =>
  path
    .basename(String(n || ""))
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 100);

async function saveFiles(specs) {
  const saved = [];
  try {
    for (const s of specs) {
      const storedName = `${crypto.randomUUID()}.${s.type.ext}`;
      await fsp.writeFile(path.join(UPLOAD_DIR, storedName), s.file.buffer, {
        mode: 0o600,
        flag: "wx",
      });
      saved.push({
        kind: s.kind,
        docType: s.docType,
        customType: s.customType,
        originalName: safeName(s.file.originalname),
        mime: s.type.mime,
        size: s.file.buffer.length,
        storedName,
      });
    }
    return saved;
  } catch (err) {
    await removeFiles(saved);
    throw err;
  }
}

async function removeFiles(docs) {
  await Promise.all(
    docs.map((d) => fsp.unlink(path.join(UPLOAD_DIR, d.storedName)).catch(() => {}))
  );
}

/* ------------------------------------------------------------------ */
/* Output shaping (never exposes storedName / file paths)              */
/* ------------------------------------------------------------------ */
const LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

function serialize(a, { withAccount = false } = {}) {
  const out = {
    id: String(a._id),
    type: a.type,
    status: a.status,
    statusLabel: LABEL[a.status] || a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    reviewedAt: a.reviewedAt || null,
    rejectionReason: a.rejectionReason || "",
    mobile: a.mobile,
    documents: (a.documents || []).map((d) => ({
      id: String(d._id),
      kind: d.kind,
      docType: d.docType,
      customType: d.customType || "",
      originalName: d.originalName || "",
      mime: d.mime,
      size: d.size,
    })),
  };
  if (a.type === "farmer") {
    Object.assign(out, {
      fullName: a.fullName,
      email: a.email,
      address: a.address,
      farmLocation: a.farmLocation,
      farmingType: a.farmingType,
      products: a.products,
      farmerStatus: a.farmerStatus,
      farmerStatusCustom: a.farmerStatusCustom || "",
    });
  } else {
    Object.assign(out, {
      businessName: a.businessName,
      businessType: a.businessType,
      businessTypeCustom: a.businessTypeCustom || "",
      representative: a.representative,
      businessAddress: a.businessAddress,
      businessEmail: a.businessEmail,
    });
    // Only older applications have this; new ones never do.
    if (a.interestedProducts) out.interestedProducts = a.interestedProducts;
  }
  if (withAccount) {
    const u = a.user && typeof a.user === "object" && a.user.email ? a.user : null;
    out.account = u ? { id: String(u._id), name: u.name, email: u.email } : null;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg) => res.status(400).json({ error: msg });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_BYTES, files: 1 + 1 + MAX_MULTI_FILES, fields: 30, parts: 45 },
});
const farmerUpload = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "govId", maxCount: 1 },
  { name: "proofs", maxCount: MAX_MULTI_FILES },
]);
const buyerUpload = upload.fields([
  { name: "govId", maxCount: 1 },
  { name: "permits", maxCount: MAX_MULTI_FILES },
]);

const runUpload = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (!err) return next();
    console.error("Application upload error:", err);
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return bad(res, "Each file must be 5 MB or smaller.");
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
        return bad(res, "Too many files. You can upload up to 5 proof files.");
      }
    }
    return bad(res, SAFE_MESSAGES.unprocessed);
  });

export default function createRoleApplicationRouter({ User }) {
  const router = express.Router();
  router.use(authenticate);

  // Only a plain `user` account with no pending application may apply.
  const canApply = wrap(async (req, res, next) => {
    if (req.user.role !== "user") {
      return res.status(403).json({
        error: "Your account already has a role, so a new application is not available.",
      });
    }
    if (await RoleApplication.exists({ user: req.user.id, status: "pending" })) {
      return res.status(409).json({ error: "You already have a pending application." });
    }
    next();
  });

  async function saveAndCreate(req, res, type, fields, specs) {
    const saved = await saveFiles(specs);
    try {
      const doc = await RoleApplication.create({
        user: req.user.id,
        type,
        status: "pending",
        ...fields,
        documents: saved,
      });
      await User.updateOne({ _id: req.user.id, role: "user" }, { verificationStatus: "pending" });
      return res.status(201).json({ application: serialize(doc) });
    } catch (err) {
      await removeFiles(saved);
      if (err && err.code === 11000) {
        return res.status(409).json({ error: "You already have a pending application." });
      }
      throw err;
    }
  }

  /* ---------- Applicant ---------- */

  router.get(
    "/mine",
    wrap(async (req, res) => {
      const list = await RoleApplication.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
      const applications = list.map((a) => serialize(a));
      const pending = applications.some((a) => a.status === "pending");
      res.json({
        applications,
        latest: applications[0] || null,
        pending,
        canApply: req.user.role === "user" && !pending,
      });
    })
  );

  router.post(
    "/farmer",
    writeLimiter,
    canApply,
    runUpload(farmerUpload),
    wrap(async (req, res) => {
      const body = req.body || {};
      const fields = readFarmerFields(body);
      if (fields.error) return bad(res, fields.error);

      const files = req.files || {};
      const proofs = files.proofs || [];
      const specs = [];

      const photo = docSpec("photo", files.photo?.[0], "Photo", "", ["Photo"], "Farmer photo", {
        imageOnly: true,
        maxBytes: MAX_PHOTO_BYTES,
      });
      if (photo.error) return bad(res, photo.error);
      specs.push(photo.spec);

      const gov = docSpec(
        "govId",
        files.govId?.[0],
        body.govIdType,
        body.govIdCustom,
        GOV_ID_TYPES,
        "Government ID",
        { imageOnly: false, maxBytes: MAX_DOC_BYTES }
      );
      if (gov.error) return bad(res, gov.error);
      specs.push(gov.spec);

      if (proofs.length < 1) {
        return bad(res, "Please upload at least one proof of farming activity.");
      }
      const meta = readMeta(body.proofMeta, proofs.length);
      if (!meta) return bad(res, SAFE_MESSAGES.unprocessed);
      for (let i = 0; i < proofs.length; i++) {
        const p = docSpec(
          "proof",
          proofs[i],
          meta[i].type,
          meta[i].custom,
          PROOF_TYPES,
          `Proof of farming activity ${i + 1}`,
          { imageOnly: false, maxBytes: MAX_DOC_BYTES }
        );
        if (p.error) return bad(res, p.error);
        specs.push(p.spec);
      }

      return saveAndCreate(req, res, "farmer", fields.value, specs);
    })
  );

  router.post(
    "/buyer",
    writeLimiter,
    canApply,
    runUpload(buyerUpload),
    wrap(async (req, res) => {
      const body = req.body || {};
      const fields = readBuyerFields(body);
      if (fields.error) return bad(res, fields.error);

      const files = req.files || {};
      const permits = files.permits || [];
      const specs = [];

      const gov = docSpec(
        "govId",
        files.govId?.[0],
        body.govIdType,
        body.govIdCustom,
        GOV_ID_TYPES,
        "Authorized representative government ID",
        { imageOnly: false, maxBytes: MAX_DOC_BYTES }
      );
      if (gov.error) return bad(res, gov.error);
      specs.push(gov.spec);

      if (permits.length < 1) {
        return bad(res, "Please upload at least one applicable business registration or permit.");
      }
      const meta = readMeta(body.permitMeta, permits.length);
      if (!meta) return bad(res, SAFE_MESSAGES.unprocessed);
      for (let i = 0; i < permits.length; i++) {
        const p = docSpec(
          "permit",
          permits[i],
          meta[i].type,
          meta[i].custom,
          PERMIT_TYPES,
          `Business registration/permit ${i + 1}`,
          { imageOnly: false, maxBytes: MAX_DOC_BYTES }
        );
        if (p.error) return bad(res, p.error);
        specs.push(p.spec);
      }

      return saveAndCreate(req, res, "buyer", fields.value, specs);
    })
  );

  /* ---------- Private document access: applicant or admin only ---------- */

  router.get(
    "/documents/:appId/:docId",
    wrap(async (req, res) => {
      const { appId, docId } = req.params;
      const notFound = () => res.status(404).json({ error: "Not found." });
      if (!ID_RE.test(appId) || !ID_RE.test(docId)) return notFound();

      const app = await RoleApplication.findById(appId).select("user documents").lean();
      if (!app) return notFound();
      const isOwner = String(app.user) === String(req.user.id);
      if (!isOwner && req.user.role !== "admin") return notFound();

      const doc = (app.documents || []).find((d) => String(d._id) === docId);
      if (!doc) return notFound();

      const full = path.resolve(UPLOAD_DIR, doc.storedName);
      if (!full.startsWith(UPLOAD_DIR + path.sep)) return notFound();
      let stat;
      try {
        stat = await fsp.stat(full);
      } catch {
        return notFound();
      }

      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[doc.mime];
      if (!ext) return notFound();
      res.set({
        "Content-Type": doc.mime,
        "Content-Length": String(stat.size),
        "Content-Disposition": `inline; filename="document.${ext}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      });
      fs.createReadStream(full)
        .on("error", () => res.destroy())
        .pipe(res);
    })
  );

  /* ---------- Admin ---------- */

  router.get(
    "/admin/applications",
    requireRole("admin"),
    wrap(async (req, res) => {
      const filter = {};
      if (["farmer", "buyer"].includes(req.query.type)) filter.type = req.query.type;
      if (["pending", "approved", "rejected"].includes(req.query.status)) {
        filter.status = req.query.status;
      }
      const list = await RoleApplication.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate("user", "name email role")
        .lean();
      res.json({ applications: list.map((a) => serialize(a, { withAccount: true })) });
    })
  );

  router.patch(
    "/admin/applications/:id",
    requireRole("admin"),
    wrap(async (req, res) => {
      const { id } = req.params;
      if (!ID_RE.test(id)) return res.status(404).json({ error: "Not found." });

      const decision = req.body?.decision;
      if (!["approve", "reject"].includes(decision)) {
        return bad(res, "Decision must be approve or reject.");
      }
      const approve = decision === "approve";

      let reason = "";
      if (!approve) {
        reason = clean(req.body?.reason);
        if (reason.length < 5) return bad(res, "Please enter a rejection reason (at least 5 characters).");
        if (reason.length > 500) return bad(res, "The rejection reason is too long (500 characters maximum).");
      }

      const pending = await RoleApplication.findOne({ _id: id, status: "pending" }).select("user type").lean();
      if (!pending) {
        return res.status(409).json({ error: "This application was already reviewed or no longer exists." });
      }

      if (approve) {
        const target = await User.findById(pending.user).select("role").lean();
        if (!target) return res.status(409).json({ error: "The applicant account no longer exists." });
        if (target.role !== "user") {
          return res.status(409).json({ error: "This account already has a final role." });
        }
      }

      const updated = await RoleApplication.findOneAndUpdate(
        { _id: id, status: "pending" },
        {
          status: approve ? "approved" : "rejected",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          rejectionReason: approve ? "" : reason,
        },
        { new: true }
      );
      if (!updated) {
        return res.status(409).json({ error: "This application was already reviewed." });
      }

      if (approve) {
        // Only a plain `user` account is ever changed. Existing farmer/buyer/admin
        // accounts can not be touched by this update.
        const r = await User.updateOne(
          { _id: updated.user, role: "user" },
          { role: updated.type, verificationStatus: "approved" }
        );
        if (!r.matchedCount) {
          await RoleApplication.updateOne(
            { _id: updated._id },
            { status: "pending", reviewedBy: null, reviewedAt: null }
          );
          return res.status(409).json({ error: "This account already has a final role." });
        }
      } else {
        await User.updateOne({ _id: updated.user, role: "user" }, { verificationStatus: "rejected" });
      }

      const label = updated.type === "farmer" ? "Farmer" : "Business / Buyer";
      await Notification.create({
        audience: "user",
        user: updated.user,
        title: approve ? `${label} application approved` : `${label} application rejected`,
        message: approve
          ? `Your ${label} application was approved. Your account is now a ${updated.type === "farmer" ? "Farmer" : "Buyer"} account.`
          : `Your ${label} application was not approved. Reason: ${reason} You may submit a new application.`,
      });

      res.json({ application: serialize(updated) });
    })
  );

  return router;
}