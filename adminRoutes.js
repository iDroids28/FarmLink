import express from "express";
import { Supply, Demand } from "./farmModels.js";
import { authenticate, requireRole } from "./security.js";
import { respondWithSafeError } from "./safeErrors.js";

/* Read-only monitoring. Every number is counted from the database. */
export default function createAdminRouter({ User }) {
  const router = express.Router();
  router.use(authenticate, requireRole("admin"));

  router.get("/stats", async (req, res) => {
    try {
      const [users, farmers, buyers, admins, supplyTotal, supplyActive, demandTotal, demandOpen] =
        await Promise.all([
          User.countDocuments({}),
          User.countDocuments({ role: "farmer" }),
          User.countDocuments({ role: "buyer" }),
          User.countDocuments({ role: "admin" }),
          Supply.countDocuments({}),
          Supply.countDocuments({ status: "available" }),
          Demand.countDocuments({}),
          Demand.countDocuments({ status: "open" }),
        ]);
      res.json({
        users: { total: users, farmer: farmers, buyer: buyers, admin: admins },
        supplies: { total: supplyTotal, active: supplyActive },
        demands: { total: demandTotal, open: demandOpen },
      });
    } catch (err) {
      respondWithSafeError(res, err, "Admin stats error");
    }
  });

  return router;
}
