import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { authenticate, requireRole } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { isValidId } from "./farmValidation.js";
import { RoleApplication } from "./roleApplicationModel.js";
import { sniff } from "./roleApplicationRoutes.js";

/* Public farmer profile. Strict whitelist: only display name, farm location,
   type of farming, products and whether a photo exists. The only file this
   router can ever send is the document with kind === "photo" of an APPROVED
   farmer application. Nothing about the file name or path comes from the client
   and nothing about them goes back to it. */

// Same folder the application upload route writes to (same env var and default).
const UPLOAD_DIR = path.resolve(
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private_uploads", "applications")
);

const NOT_FOUND = { error: "Farmer not found." };
const wrap = (fn) => (req, res) => fn(req, res);

// Returns { name, app } for an approved farmer account, or null.
async function findFarmer(id, selectApp) {
  const user = await mongoose.model("User").findOne({ _id: id, role: "farmer" }).select("name").lean();
  if (!user) return null;
  const app = await RoleApplication.findOne({ user: id, type: "farmer", status: "approved" })
    .sort({ reviewedAt: -1, createdAt: -1 })
    .select(selectApp)
    .lean();
  return { name: user.name, app };
}

export default function createFarmerProfileRouter() {
  const router = express.Router();
  router.use(authenticate);
  // Logged-in farmers and buyers (and admins) may view a farmer's public profile.
  router.use(requireRole("farmer", "buyer", "admin"));

  router.get("/:id", wrap(async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      // "documents.kind" loads only the kind of each document, never storedName.
      const found = await findFarmer(req.params.id, "farmLocation farmingType products documents.kind");
      if (!found) return res.status(404).json(NOT_FOUND);
      const a = found.app;
      res.json({
        farmer: {
          id: req.params.id,
          displayName: found.name,
          farmLocation: a?.farmLocation || "",
          farmingType: a?.farmingType || "",
          products: a?.products || "",
          hasPhoto: Boolean(a?.documents?.some((d) => d.kind === "photo")),
        },
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load farmer profile error");
    }
  }));

  router.get("/:id/photo", wrap(async (req, res) => {
    let handle;
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const found = await findFarmer(req.params.id, "documents");
      const doc = found?.app?.documents?.find((d) => d.kind === "photo");
      if (!doc) return res.status(404).json(NOT_FOUND);

      const full = path.resolve(UPLOAD_DIR, doc.storedName);
      if (!full.startsWith(UPLOAD_DIR + path.sep)) return res.status(404).json(NOT_FOUND);

      let size;
      let head;
      try {
        handle = await fsp.open(full, "r");
        size = (await handle.stat()).size;
        head = Buffer.alloc(16);
        await handle.read(head, 0, 16, 0);
      } catch {
        return res.status(404).json(NOT_FOUND);
      }
      // Trust the file's real signature, not the stored MIME. Images only.
      const type = sniff(head);
      if (!type || !type.image) return res.status(404).json(NOT_FOUND);

      res.set({
        "Content-Type": type.mime,
        "Content-Length": String(size),
        "Content-Disposition": `inline; filename="photo.${type.ext}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        // helmet defaults to same-origin; the app and API run on different ports.
        // Safe here because this route requires a logged-in session.
        "Cross-Origin-Resource-Policy": "cross-origin",
      });
      fs.createReadStream(full)
        .on("error", () => res.destroy())
        .pipe(res);
    } catch (err) {
      respondWithSafeError(res, err, "Load farmer photo error");
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }));

  return router;
}