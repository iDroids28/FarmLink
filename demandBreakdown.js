import { Match } from "./matchModel.js";
import { round2 } from "./farmValidation.js";

// Only these match statuses count toward demand progress.
export const COUNTED_MATCH = ["pending_confirmation", "confirmed"];

// Pending vs confirmed quantity per demand, counted from real Match records.
// demandIds must be ObjectIds (aggregate() does not cast strings).
export async function breakdownFor(demandIds) {
  const map = new Map();

  if (!demandIds.length) return map;

  const rows = await Match.aggregate([
    {
      $match: {
        demand: { $in: demandIds },
        status: { $in: COUNTED_MATCH },
      },
    },
    {
      $group: {
        _id: {
          demand: "$demand",
          status: "$status",
        },
        total: { $sum: "$quantity" },
      },
    },
  ]);

  for (const r of rows) {
    const key = String(r._id.demand);
    const cur = map.get(key) || { pending: 0, confirmed: 0 };

    if (r._id.status === "confirmed") {
      cur.confirmed = round2(r.total);
    } else {
      cur.pending = round2(r.total);
    }

    map.set(key, cur);
  }

  return map;
}