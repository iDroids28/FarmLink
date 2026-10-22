import express from "express";
import mongoose from "mongoose";
import { Demand, Supply } from "./farmModels.js";
import { Match } from "./matchModel.js";
import { authenticate, requireRole, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { readDemandInput, readOfferInput, isValidId, round2 } from "./farmValidation.js";
import { matchDemandSafe, cancelDemandWithMatches, offerSupplyToDemand } from "./matchingEngine.js";
import { businessProfileFor } from "./businessProfile.js";
import { breakdownFor, COUNTED_MATCH } from "./demandBreakdown.js";
import { isValidMatchPhoto } from "./matchPhotoModel.js";
import { notify } from "./noticeModel.js";

const MAX_ACTIVE_REQUESTS = 100;
const NOT_FOUND = { error: "Demand not found." };

// Requests a farmer can see. Cancelled / expired / completed are excluded;
// "matched" stays visible so a fully covered request shows 100%.
const FARMER_VISIBLE = [
  "open",
  "potential_match",
  "pending_confirmation",
  "partially_matched",
  "matched",
];

function view(d, b = { pending: 0, confirmed: 0 }) {
  return {
    id: String(d._id),
    product: d.product,
    category: d.category || "",
    quantity: d.quantity,
    matchedQuantity: d.matchedQuantity,
    confirmedQuantity: b.confirmed,
    pendingQuantity: b.pending,
    remainingQuantity: Math.max(
      0,
      round2(d.quantity - d.matchedQuantity)
    ),
    unit: d.unit,
    neededDate: d.neededDate,
    location: d.location,
    status: d.status,
    adminRemovalReason: d.adminRemovalReason || "",
    adminRemovedAt: d.adminRemovedAt || null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

async function viewWith(d) {
  const b = (await breakdownFor([d._id])).get(String(d._id));
  return view(d, b);
}

export default function createDemandRouter() {
  const router = express.Router();

  router.use(authenticate);

  router.get("/mine", requireRole("buyer"), async (req, res) => {
    try {
      const rows = await Demand.find({
        buyer: req.user.id,
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const b = await breakdownFor(rows.map((r) => r._id));

      res.json({
        demands: rows.map((r) =>
          view(r, b.get(String(r._id)))
        ),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load own demands error");
    }
  });

  // Farmers can see ALL active business requests, whether or not
  // the current farmer has matching supply.
  //
  // Contributions are grouped by farmer, in chronological order.
  // This route must stay above "/:id".
  router.get("/for-farmers", requireRole("farmer"), async (req, res) => {
    try {
      const demands = await Demand.find({
        status: { $in: FARMER_VISIBLE },
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const ids = demands.map((d) => d._id);

      // Targeted offers belonging to the current farmer; pending/confirmed
      // targeted offers remain active until declined or the demand is cancelled.
      const offered = new Set(
        ids.length
          ? (
              await Supply.find({
                farmer: req.user.id,
                targetDemand: { $in: ids },
                status: "available",
              })
                .select("targetDemand")
                .lean()
            ).map((s) => String(s.targetDemand))
          : []
      );

      // Retrieve all relevant Match records in one aggregation.
      // Only the farmer's display name leaves the users collection.
      const rows = ids.length
        ? await Match.aggregate([
            {
              $match: {
                demand: { $in: ids },
                status: { $in: COUNTED_MATCH },
              },
            },
            {
              $sort: {
                createdAt: 1,
                _id: 1,
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "farmer",
                foreignField: "_id",
                as: "f",
              },
            },
            {
              $project: {
                demand: 1,
                farmer: 1,
                quantity: 1,
                status: 1,
                createdAt: 1,
                farmerName: {
                  $arrayElemAt: ["$f.name", 0],
                },
              },
            },
          ])
        : [];

      // Group in order. Each farmer gets one row per demand.
      // Keep total, confirmed, and pending quantities separately.
      const byDemand = new Map();

      for (const r of rows) {
        const key = String(r.demand);

        const entry = byDemand.get(key) || {
          list: new Map(),
          pending: 0,
          confirmed: 0,
        };

        const fid = String(r.farmer);

        const c = entry.list.get(fid) || {
          farmerId: fid,
          farmerName: r.farmerName || "Farmer",
          quantity: 0,
          confirmed: 0,
          pending: 0,
        };

        // Total contribution for this farmer.
        c.quantity = round2(c.quantity + r.quantity);

        if (r.status === "confirmed") {
          entry.confirmed = round2(
            entry.confirmed + r.quantity
          );

          c.confirmed = round2(
            c.confirmed + r.quantity
          );
        } else {
          entry.pending = round2(
            entry.pending + r.quantity
          );

          c.pending = round2(
            c.pending + r.quantity
          );
        }

        entry.list.set(fid, c);
        byDemand.set(key, entry);
      }

      const out = demands.map((d) => {
        const e = byDemand.get(String(d._id));

        const confirmed = e ? e.confirmed : 0;
        const pending = e ? e.pending : 0;

        // Never show more than was requested, or a negative remainder.
        const matched = Math.min(
          round2(confirmed + pending),
          d.quantity
        );

        const percent =
          d.quantity > 0
            ? Math.min(
                100,
                Math.max(0, (matched / d.quantity) * 100)
              )
            : 0;

        return {
          id: String(d._id),
          product: d.product,
          category: d.category || "",
          quantity: d.quantity,
          unit: d.unit,
          neededDate: d.neededDate,
          location: d.location,
          status: d.status,
          createdAt: d.createdAt,

          matchedQuantity: matched,
          confirmedQuantity: confirmed,
          pendingQuantity: pending,

          remainingQuantity: Math.max(
            0,
            round2(d.quantity - matched)
          ),

          progressPercent: Math.round(percent * 10) / 10,
          hasActiveOffer: offered.has(String(d._id)),

          contributions: e
            ? [...e.list.values()].map((c, i) => ({
                order: i + 1,
                farmerId: c.farmerId,
                farmerName: c.farmerName,

                // Keep quantity for existing code that reads it.
                quantity: c.quantity,
                totalQuantity: c.quantity,

                confirmedQuantity: c.confirmed,
                pendingQuantity: c.pending,

                // "mixed" is a computed display status only.
                // It is NOT saved to the database Match record.
                status:
                  c.confirmed > 0 && c.pending > 0
                    ? "mixed"
                    : c.pending > 0
                    ? "pending_confirmation"
                    : "confirmed",
              }))
            : [],
        };
      });

      res.json({ demands: out });
    } catch (err) {
      respondWithSafeError(
        res,
        err,
        "Load business requests error"
      );
    }
  });

  // Safe Business/Buyer profile for the Business Requests details modal.
  // Contact details are disclosed only to a farmer with an active match on
  // this demand. The route is Farmer-only and returns whitelisted fields only.
  router.get("/:id/business", requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(404).json(NOT_FOUND);
      }

      const demand = await Demand.findOne({
        _id: req.params.id,
        status: { $in: FARMER_VISIBLE },
      })
        .select("buyer")
        .lean();

      if (!demand) return res.status(404).json(NOT_FOUND);

      const [profile, ownMatch] = await Promise.all([
        businessProfileFor(demand.buyer),
        Match.exists({
          demand: demand._id,
          farmer: req.user.id,
          status: "confirmed",
        }),
      ]);

      if (!profile) return res.json({ business: null });

      // Contact details are revealed only after this farmer has a confirmed match.
      const contactVisible = Boolean(ownMatch);

      res.json({
        business: {
          businessName: profile.businessName,
          businessType: profile.businessType,
          businessAddress: profile.businessAddress,
          contactVisible,
          representative: contactVisible ? profile.representative : null,
          businessEmail: contactVisible ? profile.businessEmail : null,
          mobile: contactVisible ? profile.mobile : null,
        },
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load business profile error");
    }
  });

  router.get("/:id", requireRole("buyer", "admin"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(404).json(NOT_FOUND);
      }

      const filter =
        req.user.role === "admin"
          ? { _id: req.params.id }
          : {
              _id: req.params.id,
              buyer: req.user.id,
            };

      const row = await Demand.findOne(filter).lean();

      if (!row) {
        return res.status(404).json(NOT_FOUND);
      }

      res.json({
        demand: await viewWith(row),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load demand error");
    }
  });

  router.post("/", writeLimiter, requireRole("buyer"), async (req, res) => {
    try {
      const { value, error } = readDemandInput(req.body);

      if (error) {
        return res.status(400).json({ error });
      }

      const active = await Demand.countDocuments({
        buyer: req.user.id,
        status: "open",
      });

      if (active >= MAX_ACTIVE_REQUESTS) {
        return res.status(400).json({
          error: "You have reached the limit of open product requests.",
        });
      }

      const doc = await Demand.create({
        ...value,
        buyer: req.user.id,
        status: "open",
        matchedQuantity: 0,
      });

      await matchDemandSafe(doc._id);

      // Farmers with an automatically created match already receive a match
      // notification. Broadcast the new demand to every other farmer account,
      // including farmers who have not uploaded any supply yet. Notification
      // failures must never undo a successfully created demand.
      try {
        const [farmers, alreadyMatchedFarmerIds] = await Promise.all([
          mongoose.model("User").find({ role: "farmer" }).select("_id").lean(),
          Match.distinct("farmer", {
            demand: doc._id,
            status: { $in: COUNTED_MATCH },
          }),
        ]);
        const alreadyAlerted = new Set(alreadyMatchedFarmerIds.map(String));
        const neededDateLabel = new Date(doc.neededDate).toLocaleDateString("en-PH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Manila",
        });
        const demandMessage = `${doc.product}: ${doc.quantity} ${doc.unit} needed in ${doc.location} by ${neededDateLabel}. Open Business Requests to see the demand and offer supply.`;
        await Promise.all(
          farmers
            .filter((farmer) => !alreadyAlerted.has(String(farmer._id)))
            .map((farmer) =>
              notify(
                farmer._id,
                "buyer_demand_created",
                "New Buyer Demand",
                demandMessage,
                null,
                null,
                doc._id
              )
            )
        );
      } catch (noticeError) {
        console.error("Broadcast buyer demand notification error:", noticeError);
      }

      const fresh = await Demand.findById(doc._id).lean();

      res.status(201).json({
        demand: await viewWith(fresh || doc),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Create demand error");
    }
  });

  router.patch("/:id", writeLimiter, requireRole("buyer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(404).json(NOT_FOUND);
      }

      const { value, error } = readDemandInput(req.body);

      if (error) {
        return res.status(400).json({ error });
      }

      const doc = await Demand.findOne({
        _id: req.params.id,
        buyer: req.user.id,
      });

      if (!doc) {
        return res.status(404).json(NOT_FOUND);
      }

      if (doc.status !== "open" || doc.matchedQuantity > 0) {
        return res.status(409).json({
          error: "This request can no longer be edited.",
        });
      }

      Object.assign(doc, value);

      await doc.save();
      await matchDemandSafe(doc._id);

      const fresh = await Demand.findById(doc._id).lean();

      res.json({
        demand: await viewWith(fresh || doc),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Update demand error");
    }
  });

  // Farmer: offer supply for one specific request. The server re-validates the demand.
  router.post("/:id/offer", writeLimiter, requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);

      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      const { image, ...offerBody } = body;
      if (!isValidMatchPhoto(image)) {
        return res.status(400).json({ error: "A product photo is required. Upload a JPG, PNG or WEBP photo." });
      }

      const { value, error } = readOfferInput(offerBody);
      if (error) return res.status(400).json({ error });

      const result = await offerSupplyToDemand({
        demandId: req.params.id,
        farmerId: req.user.id,
        input: { ...value, image },
      });
      if (result.error) return res.status(result.status).json({ error: result.error });

      res.status(201).json({
        offer: {
          matchId: String(result.match._id),
          supplyId: String(result.supply._id),
          product: result.match.product,
          quantity: result.match.quantity,
          unit: result.match.unit,
          status: result.match.status,
        },
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ error: "You already have an active offer for this request." });
      }
      respondWithSafeError(res, err, "Offer supply error");
    }
  });

  router.post("/:id/cancel", writeLimiter, requireRole("buyer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(404).json(NOT_FOUND);
      }

      const result = await cancelDemandWithMatches(
        req.params.id,
        req.user.id
      );

      if (result === "not_found") {
        return res.status(404).json(NOT_FOUND);
      }

      if (result === "locked") {
        return res.status(409).json({
          error: "This request can no longer be cancelled.",
        });
      }

      const row = await Demand.findById(req.params.id).lean();

      res.json({
        demand: await viewWith(row),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Cancel demand error");
    }
  });

  return router;
}
