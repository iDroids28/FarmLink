import express from "express";
import { Notice } from "./noticeModel.js";
import { authenticate, writeLimiter } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";

export default function createNoticeRouter() {
  const router = express.Router();
  router.use(authenticate);

  router.get("/mine", async (req, res) => {
    try {
      const [rows, unread] = await Promise.all([
        Notice.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean(),
        Notice.countDocuments({ user: req.user.id, read: false }),
      ]);
      res.json({
        unread,
        notifications: rows.map((n) => ({
          id: String(n._id), type: n.type, title: n.title,
          message: n.message, read: n.read, createdAt: n.createdAt,
        })),
      });
    } catch (err) {
      respondWithSafeError(res, err, "Load notices error");
    }
  });

  router.post("/read-all", writeLimiter, async (req, res) => {
    try {
      await Notice.updateMany({ user: req.user.id, read: false }, { read: true });
      res.json({ ok: true });
    } catch (err) {
      respondWithSafeError(res, err, "Mark notices read error");
    }
  });

  return router;
}