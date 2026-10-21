import express from "express";
import mongoose from "mongoose";
import { authenticate } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { isValidId } from "./farmValidation.js";
import { PreOrderRequest } from "./requestRoutes.js";

/* Private product photos are saved in MongoDB (collection "match_photos") and
   linked to their match. Request-specific offer photos are buyer-only; older
   general-supply matches retain the existing photo visibility rules. */

const models = () => ({
  MatchOrder: mongoose.models.MatchOrder,
  MatchPhoto: mongoose.models.MatchPhoto,
});

export default function createOrderPhotoRouter() {
  const router = express.Router();
  router.use(authenticate);

  // Ids of my orders (buyer: my pre-orders, farmer: orders on my supply) that have the farmer's photo.
  router.get("/mine", async (req, res) => {
    try {
      const { MatchOrder, MatchPhoto } = models();
      const field = req.user.role === "buyer" ? "requester" : req.user.role === "farmer" ? "owner" : null;
      if (!field || !MatchOrder || !MatchPhoto) return res.json({ orders: [] });

      const orders = await PreOrderRequest.find({ [field]: req.user.id }).select("_id").limit(500).lean();
      if (!orders.length) return res.json({ orders: [] });

      const links = await MatchOrder.find({ order: { $in: orders.map((o) => o._id) } }).select("match order").lean();
      if (!links.length) return res.json({ orders: [] });

      let visibleLinks = links;
      // Photos submitted with request-specific offers are exposed to the matched
      // buyer only, including after a pre-order is created. Do not advertise those
      // photo IDs in the farmer's order list.
      if (field === "owner") {
        // Fail closed if the match/supply records cannot be resolved.
        if (!mongoose.models.Match || !mongoose.models.Supply) return res.json({ orders: [] });
        const matches = await mongoose.models.Match.find({ _id: { $in: links.map((l) => l.match) } }).select("_id supply").lean();
        const supplies = matches.length
          ? await mongoose.models.Supply.find({ _id: { $in: matches.map((m) => m.supply) } }).select("_id targetDemand").lean()
          : [];
        const supplyById = new Map(supplies.map((s) => [String(s._id), s]));
        const generalMatches = new Set(
          matches
            .filter((m) => {
              const supply = supplyById.get(String(m.supply));
              return Boolean(supply && !supply.targetDemand);
            })
            .map((m) => String(m._id))
        );
        visibleLinks = links.filter((l) => generalMatches.has(String(l.match)));
      }
      if (!visibleLinks.length) return res.json({ orders: [] });

      const photos = await MatchPhoto.find({ match: { $in: visibleLinks.map((l) => l.match) } }).select("match").lean();
      const withPhoto = new Set(photos.map((p) => String(p.match)));
      res.json({ orders: visibleLinks.filter((l) => withPhoto.has(String(l.match))).map((l) => String(l.order)) });
    } catch (err) {
      respondWithSafeError(res, err, "Load order photos error");
    }
  });

  // Buyer may open the order photo; farmer access is retained only for general-supply matches.
  router.get("/:orderId", async (req, res) => {
    try {
      if (!isValidId(req.params.orderId)) return res.status(404).json({ error: "Photo not found." });
      const { MatchOrder, MatchPhoto } = models();
      if (!MatchOrder || !MatchPhoto) return res.status(404).json({ error: "Photo not found." });

      const order = await PreOrderRequest.findById(req.params.orderId).select("requester owner").lean();
      const uid = String(req.user.id);
      if (!order || (String(order.requester) !== uid && String(order.owner) !== uid)) {
        return res.status(404).json({ error: "Photo not found." });
      }

      const link = await MatchOrder.findOne({ order: order._id }).select("match").lean();
      if (!link) return res.status(404).json({ error: "Photo not found." });

      // Block the farmer from reading photos attached during a request-specific offer.
      // The matched buyer remains authorized to view the photo for their own order.
      if (String(order.owner) === uid) {
        if (!mongoose.models.Match || !mongoose.models.Supply) return res.status(404).json({ error: "Photo not found." });
        const match = await mongoose.models.Match.findById(link.match).select("supply").lean();
        const supply = match ? await mongoose.models.Supply.findById(match.supply).select("targetDemand").lean() : null;
        if (!supply || supply.targetDemand) return res.status(404).json({ error: "Photo not found." });
      }

      const photo = await MatchPhoto.findOne({ match: link.match }).select("image updatedAt").lean();
      if (!photo) return res.status(404).json({ error: "Photo not found." });

      res.json({ image: photo.image, updatedAt: photo.updatedAt });
    } catch (err) {
      respondWithSafeError(res, err, "Load order photo error");
    }
  });

  return router;
}