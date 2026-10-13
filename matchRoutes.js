import express from "express";
import { Match } from "./matchModel.js";
import { authenticate, requireRole, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { isValidId, round2 } from "./farmValidation.js";
import { confirmMatch, declineMatch } from "./matchingEngine.js";
import { businessNamesFor, businessProfileFor } from "./businessProfile.js";
import { Demand } from "./farmModels.js";
import { breakdownFor, COUNTED_MATCH } from "./demandBreakdown.js";

const NOT_FOUND = { error: "Match not found." };
const NOT_PENDING = { error: "This match request can no longer be changed." };

// Farmer sees the request and approved business name, but not buyer user ID,
// personal name, or email in the generic Matches response.
function farmerView(m, businessName) {
  const view = {
    id: String(m._id),
    product: m.product,
    quantity: m.quantity,
    unit: m.unit,
    neededDate: m.neededDate,
    location: m.location,
    status: m.status,
    createdAt: m.createdAt,
  };
  if (businessName !== undefined) view.businessName = businessName || null;
  return view;
}
function buyerView(m) {
  return {
    id: String(m._id), product: m.product, quantity: m.quantity, unit: m.unit,
    availabilityDate: m.availabilityDate, location: m.location, status: m.status, createdAt: m.createdAt,
  };
}

export default function createMatchRouter() {
  const router = express.Router();
  router.use(authenticate);

  router.get("/mine", requireRole("farmer", "buyer"), async (req, res) => {
    try {
      const isFarmer = req.user.role === "farmer";
      const rows = await Match.find(isFarmer ? { farmer: req.user.id } : { buyer: req.user.id })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      if (isFarmer) {
        const names = await businessNamesFor(rows.map((row) => row.buyer));
        return res.json({
          matches: rows.map((row) =>
            farmerView(row, names.get(String(row.buyer)) ?? null)
          ),
        });
      }
      res.json({ matches: rows.map(buyerView) });
    } catch (err) {
      respondWithSafeError(res, err, "Load matches error");
    }
  });


  // Farmer-only details for the "View Details" modal, in one call.
  // Ownership: the lookup filters by farmer, so someone else's match is a 404.
  // Nothing returned contains the demand id, buyer id, or application documents.
  router.get("/:id/details", requireRole("farmer"), async (req, res) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);

      const m = await Match.findOne({ _id: req.params.id, farmer: req.user.id })
        .select("demand buyer product unit quantity status")
        .lean();
      if (!m) return res.status(404).json(NOT_FOUND);

      const [demand, breakdowns, profile] = await Promise.all([
        Demand.findById(m.demand)
          .select("product quantity unit neededDate location")
          .lean(),
        breakdownFor([m.demand]),
        businessProfileFor(m.buyer),
      ]);
      if (!demand) return res.status(404).json(NOT_FOUND);

      // Same rules as /demands/for-farmers: pending + confirmed only,
      // capped at the requested quantity, never negative.
      const b = breakdowns.get(String(demand._id)) || { pending: 0, confirmed: 0 };
      const covered = Math.min(round2(b.confirmed + b.pending), demand.quantity);
      const percent =
        demand.quantity > 0
          ? Math.min(100, Math.max(0, (covered / demand.quantity) * 100))
          : 0;

      // Contacts only while this farmer has a pending/confirmed match on the demand.
      const contactVisible =
        COUNTED_MATCH.includes(m.status) ||
        Boolean(
          await Match.exists({
            demand: demand._id,
            farmer: req.user.id,
            status: { $in: COUNTED_MATCH },
          })
        );

      res.json({
        details: {
          match: {
            id: String(m._id),
            status: m.status,
            product: m.product,
            quantity: m.quantity,
            unit: m.unit,
          },
          demand: {
            product: demand.product,
            quantity: demand.quantity,
            unit: demand.unit,
            neededDate: demand.neededDate,
            location: demand.location,
            confirmedQuantity: b.confirmed,
            pendingQuantity: b.pending,
            matchedQuantity: covered,
            remainingQuantity: Math.max(0, round2(demand.quantity - covered)),
            progressPercent: Math.round(percent * 10) / 10,
          },
          business: profile
            ? {
                businessName: profile.businessName,
                businessType: profile.businessType,
                businessAddress: profile.businessAddress,
                contactVisible,
                representative: contactVisible ? profile.representative : null,
                businessEmail: contactVisible ? profile.businessEmail : null,
                mobile: contactVisible ? profile.mobile : null,
              }
            : null,
        },
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load match details error");
    }
  });

  async function decide(req, res, action, label) {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
      const m = await action(req.params.id, req.user.id);
      if (m) return res.json({ match: farmerView(m) });

      // Same "not found" for someone else's match; 409 only for the owner.
      const own = await Match.exists({ _id: req.params.id, farmer: req.user.id });
      if (!own) return res.status(404).json(NOT_FOUND);
      res.status(409).json(NOT_PENDING);
    } catch (err) {
      respondWithSafeError(res, err, label);
    }
  }

  router.post("/:id/confirm", writeLimiter, requireRole("farmer"), (req, res) =>
    decide(req, res, confirmMatch, "Confirm match error"));
  router.post("/:id/decline", writeLimiter, requireRole("farmer"), (req, res) =>
    decide(req, res, declineMatch, "Decline match error"));

  return router;
}
