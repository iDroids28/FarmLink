import express from "express";
import mongoose from "mongoose";
import { authenticate } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";
import { isValidId } from "./farmValidation.js";
import { PreOrderRequest } from "./requestRoutes.js";

/* The farmer's photo of the products, shown on the order made from a confirmed
   match. The photo itself is saved in MongoDB (collection "match_photos") when the
   farmer accepts the match; "match_orders" links the match to the order. Nothing
   is kept in the browser, so it is still there after logging out and in. */

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

      const photos = await MatchPhoto.find({ match: { $in: links.map((l) => l.match) } }).select("match").lean();
      const withPhoto = new Set(photos.map((p) => String(p.match)));
      res.json({ orders: links.filter((l) => withPhoto.has(String(l.match))).map((l) => String(l.order)) });
    } catch (err) {
      respondWithSafeError(res, err, "Load order photos error");
    }
  });

  // The photo of one order: only the buyer and the farmer of that order can open it.
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
      const photo = link ? await MatchPhoto.findOne({ match: link.match }).select("image updatedAt").lean() : null;
      if (!photo) return res.status(404).json({ error: "Photo not found." });

      res.json({ image: photo.image, updatedAt: photo.updatedAt });
    } catch (err) {
      respondWithSafeError(res, err, "Load order photo error");
    }
  });

  return router;
}