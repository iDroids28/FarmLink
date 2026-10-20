import { Supply, Demand } from "./farmModels.js";
import { Match } from "./matchModel.js";
import { round2 } from "./farmValidation.js";
import { notify } from "./noticeModel.js";
import { breakdownFor } from "./demandBreakdown.js";

/* FIFO matching. Supply is allocated oldest-first (createdAt). A match is only
   POTENTIAL (pending_confirmation); the farmer confirms or declines later.
   Quantity is held on the supply right away so it cannot be given twice. */

const ACTIVE_DEMAND = ["open", "potential_match", "partially_matched"];
const SYNCABLE_DEMAND = [...ACTIVE_DEMAND, "matched"];
const CASE_INSENSITIVE = { locale: "en", strength: 2 };
const EPS = 0.001;
const MAX_ACTIVE_LISTINGS = 100; // same cap as supplyRoutes.js

// "expected" supply is a pre-order (harvest not ready yet); "onhand" is ready now.
const kindOf = (supplyType) => (supplyType === "expected" ? "pre-order, expected harvest" : "on-hand");

/* ---- atomic quantity changes (native driver: pipeline updates, no casting surprises) ---- */

async function reserveSupply(supplyId, qty) {
  const r = await Supply.collection.updateOne(
    { _id: supplyId, status: "available", availableQuantity: { $gte: qty } },
    [{
      $set: {
        reservedQuantity: { $round: [{ $add: ["$reservedQuantity", qty] }, 2] },
        availableQuantity: { $round: [{ $subtract: ["$availableQuantity", qty] }, 2] },
        updatedAt: "$$NOW",
      },
    }]
  );
  return r.modifiedCount === 1;
}

async function releaseSupply(supplyId, qty) {
  await Supply.collection.updateOne({ _id: supplyId }, [{
    $set: {
      reservedQuantity: { $max: [0, { $round: [{ $subtract: ["$reservedQuantity", qty] }, 2] }] },
      availableQuantity: { $round: [{ $add: ["$availableQuantity", qty] }, 2] },
      updatedAt: "$$NOW",
    },
  }]);
}

async function claimDemand(demandId, qty) {
  const r = await Demand.collection.updateOne(
    {
      _id: demandId,
      status: { $in: ACTIVE_DEMAND },
      $expr: { $lte: [{ $add: ["$matchedQuantity", qty] }, { $add: ["$quantity", EPS] }] },
    },
    [{
      $set: {
        matchedQuantity: { $round: [{ $add: ["$matchedQuantity", qty] }, 2] },
        updatedAt: "$$NOW",
      },
    }]
  );
  return r.modifiedCount === 1;
}

async function unclaimDemand(demandId, qty) {
  await Demand.collection.updateOne({ _id: demandId }, [{
    $set: {
      matchedQuantity: { $max: [0, { $round: [{ $subtract: ["$matchedQuantity", qty] }, 2] }] },
      updatedAt: "$$NOW",
    },
  }]);
}

/* Retires a request-specific supply once its match is gone. Only touches a
   supply that has a targetDemand and has nothing reserved, so ordinary supply
   can never be affected. This also allows a future offer after decline/cancel. */
async function retireTargetedSupply(supplyId) {
  try {
    await Supply.collection.updateOne(
      {
        _id: supplyId,
        targetDemand: { $type: "objectId" },
        status: "available",
        reservedQuantity: { $lte: 0 },
      },
      {
        $set: {
          status: "cancelled",
          availableQuantity: 0,
          updatedAt: new Date(),
        },
      }
    );
  } catch (err) {
    console.error("Retire targeted supply error:", err);
  }
}

/* ---- demand status is derived from its matches ---- */

export async function syncDemandStatus(demandId) {
  const demand = await Demand.findById(demandId).select("quantity status").lean();
  if (!demand || !SYNCABLE_DEMAND.includes(demand.status)) return;

  const rows = await Match.aggregate([
    { $match: { demand: demand._id, status: { $in: ["pending_confirmation", "confirmed"] } } },
    { $group: { _id: "$status", total: { $sum: "$quantity" } } },
  ]);
  const pending = round2(rows.find((r) => r._id === "pending_confirmation")?.total || 0);
  const confirmed = round2(rows.find((r) => r._id === "confirmed")?.total || 0);

  let status;
  if (pending + confirmed === 0) status = "open";
  else if (confirmed + EPS >= demand.quantity) status = "matched";
  else if (pending > 0) status = "potential_match";
  else status = "partially_matched";

  if (status !== demand.status) {
    await Demand.updateOne({ _id: demand._id, status: { $in: SYNCABLE_DEMAND } }, { status });
  }
}

/* ---- one allocation: hold supply -> claim demand -> create match (undo on failure) ---- */

async function allocate(supply, demand, rawQty, opts = {}) {
  const qty = round2(rawQty);
  // Safety net: never match a person with themselves.
  if (String(supply.farmer) === String(demand.buyer)) return null;
  if (qty <= 0) return null;

  if (!(await reserveSupply(supply._id, qty))) return null;

  if (!(await claimDemand(demand._id, qty))) {
    await releaseSupply(supply._id, qty);
    return null;
  }

  try {
    const match = await Match.create({
      demand: demand._id,
      supply: supply._id,
      farmer: supply.farmer,
      buyer: demand.buyer,
      product: supply.product,
      unit: supply.unit,
      quantity: qty,
      location: supply.location,
      neededDate: demand.neededDate,
      availabilityDate: supply.availabilityDate,
      status: "pending_confirmation",
    });
    const kind = kindOf(supply.supplyType);
    const note = opts.notice || {
      title: "New match request",
      message: `A buyer needs ${qty} ${supply.unit} of ${supply.product} (${kind}). Open this notification to accept or decline.`,
    };
    await notify(supply.farmer, "match_created", note.title, note.message, match._id);
    await notify(
      demand.buyer, "match_created", "Match found",
      `A farmer's ${kind} supply matches your request: ${qty} ${supply.unit} of ${supply.product}. Waiting for the farmer to accept.`,
      match._id
    );
    return match;
  } catch (err) {
    await releaseSupply(supply._id, qty);
    await unclaimDemand(demand._id, qty);
    throw err;
  }
}

/* ---- demand-driven: find supply oldest-first for one demand ---- */

export async function matchDemand(demandId) {
  const demand = await Demand.findById(demandId).lean();
  if (!demand || !ACTIVE_DEMAND.includes(demand.status)) return 0;

  let remaining = round2(demand.quantity - demand.matchedQuantity);
  if (remaining <= 0) return 0;

  const declined = new Set(
    (await Match.find({ demand: demand._id, status: { $in: ["declined", "cancelled"] } }).select("supply").lean())
      .map((m) => String(m.supply))
  );

  const supplies = await Supply.find({
    status: "available",
    availableQuantity: { $gt: 0 },
    product: demand.product,
    unit: demand.unit,
    location: demand.location,
    availabilityDate: { $lte: demand.neededDate },
    farmer: { $ne: demand.buyer },
    targetDemand: null, // request-specific offers never enter general FIFO
  })
    .collation(CASE_INSENSITIVE)
    .sort({ createdAt: 1 })
    .lean();

  let created = 0;
  for (const s of supplies) {
    if (remaining <= 0) break;
    if (declined.has(String(s._id))) continue;
    const qty = round2(Math.min(s.availableQuantity, remaining));
    if (await allocate(s, demand, qty)) {
      remaining = round2(remaining - qty);
      created += 1;
    }
  }
  if (created) await syncDemandStatus(demand._id);
  return created;
}

/* ---- supply-driven: a new/changed supply looks for waiting demands (oldest demand first) ---- */

export async function matchSupply(supplyId) {
  const supply = await Supply.findById(supplyId).lean();
  if (!supply || supply.status !== "available") return 0;
  if (supply.targetDemand) return 0; // request-specific offer: never re-routed by FIFO

  let remaining = round2(supply.availableQuantity);
  if (remaining <= 0) return 0;

  const declined = new Set(
    (await Match.find({ supply: supply._id, status: { $in: ["declined", "cancelled"] } }).select("demand").lean())
      .map((m) => String(m.demand))
  );

  const demands = await Demand.find({
    status: { $in: ACTIVE_DEMAND },
    product: supply.product,
    unit: supply.unit,
    location: supply.location,
    neededDate: { $gte: supply.availabilityDate },
    buyer: { $ne: supply.farmer },
    $expr: { $lt: ["$matchedQuantity", "$quantity"] },
  })
    .collation(CASE_INSENSITIVE)
    .sort({ createdAt: 1 })
    .lean();

  let created = 0;
  for (const d of demands) {
    if (remaining <= 0) break;
    if (declined.has(String(d._id))) continue;
    const qty = round2(Math.min(remaining, d.quantity - d.matchedQuantity));
    if (await allocate(supply, d, qty)) {
      remaining = round2(remaining - qty);
      created += 1;
      await syncDemandStatus(d._id);
    }
  }
  return created;
}

/* ---- wrappers used by routes: a matching problem must never fail the user's request ---- */

export async function matchDemandSafe(id) {
  try { await matchDemand(id); } catch (err) { console.error("Matching error (demand):", err); }
}
export async function matchSupplySafe(id) {
  try { await matchSupply(id); } catch (err) { console.error("Matching error (supply):", err); }
}
/* ---------- Stage 2: farmer decisions + buyer cancel ---------- */

export async function confirmMatch(matchId, farmerId) {
  const m = await Match.findOneAndUpdate(
    { _id: matchId, farmer: farmerId, status: "pending_confirmation" },
    { status: "confirmed" },
    { returnDocument: "after" }
  ).lean();
  if (!m) return null;
  await syncDemandStatus(m.demand);

  const demand = await Demand.findById(m.demand).select("quantity status unit product").lean();
  const sup = await Supply.findById(m.supply).select("supplyType").lean();
  const kind = kindOf(sup?.supplyType);
  const b = (await breakdownFor([m.demand])).get(String(m.demand)) || { pending: 0, confirmed: 0 };

  if (demand && demand.status === "matched") {
    // Every unit is confirmed: the request is complete / pre-ordered.
    await notify(
      m.buyer, "match_confirmed", "Requirement matched (pre-ordered)",
      `Your request for ${demand.quantity} ${demand.unit} of ${demand.product} is fully confirmed by farmers. It is now pre-ordered.`,
      m._id
    );
  } else {
    await notify(
      m.buyer, "match_confirmed", "Match confirmed",
      `A farmer accepted ${m.quantity} ${m.unit} of ${m.product} (${kind}). Confirmed so far: ${b.confirmed} of ${demand ? demand.quantity : m.quantity} ${m.unit}.`,
      m._id
    );
  }
  await notify(
    m.farmer, "match_confirmed", "Product pre-ordered",
    `You accepted ${m.quantity} ${m.unit} of ${m.product} (${kind}). The buyer has pre-ordered it.`,
    m._id
  );
  return m;
}

export async function declineMatch(matchId, farmerId) {
  const m = await Match.findOneAndUpdate(
    { _id: matchId, farmer: farmerId, status: "pending_confirmation" },
    { status: "declined" },
    { returnDocument: "after" }
  ).lean();
  if (!m) return null;

  await releaseSupply(m.supply, m.quantity);
  await unclaimDemand(m.demand, m.quantity);
  await retireTargetedSupply(m.supply); // no-op for ordinary supply
  await syncDemandStatus(m.demand);

  await notify(
    m.buyer, "match_declined", "Match declined",
    `A farmer declined ${m.quantity} ${m.unit} of ${m.product}. FarmLink is looking for the next available supply.`,
    m._id
  );
  // and the freed quantity may serve another waiting demand.
  await matchDemandSafe(m.demand);
  await matchSupplySafe(m.supply);
  return m;
}

// Buyer cancels ONE pending match (the farmer has not answered yet).
// Supply is released, the request's remaining quantity goes back up, and the
// engine looks for other supply. The same supply is not offered again.
export async function cancelMatchByBuyer(matchId, buyerId) {
  const m = await Match.findOneAndUpdate(
    { _id: matchId, buyer: buyerId, status: "pending_confirmation" },
    { status: "cancelled" },
    { returnDocument: "after" }
  ).lean();
  if (!m) return null;

  await releaseSupply(m.supply, m.quantity);
  await unclaimDemand(m.demand, m.quantity);
  await retireTargetedSupply(m.supply); // no-op for ordinary supply
  await syncDemandStatus(m.demand);

  await notify(
    m.farmer, "match_cancelled", "Match request cancelled",
    `A buyer cancelled the request for ${m.quantity} ${m.unit} of ${m.product}.`,
    m._id
  );
  await matchDemandSafe(m.demand);
  await matchSupplySafe(m.supply);
  return m;
}

// Returns "ok" | "not_found" | "locked"
export async function cancelDemandWithMatches(demandId, buyerId) {
  const demand = await Demand.findOne({ _id: demandId, buyer: buyerId }).select("status").lean();
  if (!demand) return "not_found";
  if (!["open", "potential_match"].includes(demand.status)) return "locked";
  if (await Match.exists({ demand: demand._id, status: "confirmed" })) return "locked";

  // Stop new matches first.
  const flipped = await Demand.findOneAndUpdate(
    { _id: demand._id, buyer: buyerId, status: { $in: ["open", "potential_match"] } },
    { status: "cancelled" }
  );
  if (!flipped) return "locked";

  const pending = await Match.find({ demand: demand._id, status: "pending_confirmation" }).lean();
  for (const p of pending) {
    const m = await Match.findOneAndUpdate(
      { _id: p._id, status: "pending_confirmation" },
      { status: "cancelled" },
      { returnDocument: "after" }
    ).lean();
    if (!m) continue; // the farmer acted first; leave it
    await releaseSupply(m.supply, m.quantity);
    await unclaimDemand(m.demand, m.quantity);
    await retireTargetedSupply(m.supply); // no-op for ordinary supply
    await notify(
      m.farmer, "match_cancelled", "Match request cancelled",
      `A buyer cancelled the request for ${m.quantity} ${m.unit} of ${m.product}.`,
      m._id
    );
    await matchSupplySafe(m.supply); // freed quantity can serve other demands
  }
  return "ok";
}

/* ---------- Request-specific offer ---------- */

const norm = (s) => String(s).trim().replace(/\s+/g, " ").toLowerCase();

// Returns { match, supply } on success, or { status, error } on rejection.
export async function offerSupplyToDemand({ demandId, farmerId, input }) {
  const demand = await Demand.findById(demandId).lean();
  if (!demand) return { status: 404, error: "Demand not found." };
  if (String(demand.buyer) === String(farmerId)) {
    return { status: 403, error: "You cannot offer supply to your own request." };
  }
  if (!ACTIVE_DEMAND.includes(demand.status)) {
    return { status: 409, error: "This request is no longer accepting offers." };
  }
  if (norm(input.product) !== norm(demand.product)) {
    return { status: 400, error: "The product must match this request." };
  }
  if (input.unit !== demand.unit) {
    return { status: 400, error: "The unit must match this request." };
  }

  const qty = round2(input.quantity);
  const remaining = round2(demand.quantity - demand.matchedQuantity);
  if (remaining <= 0) {
    return { status: 409, error: "This request is already fully covered." };
  }
  if (qty > remaining + EPS) {
    return {
      status: 400,
      error: `Only ${remaining} ${demand.unit} is still needed for this request.`,
    };
  }
  if (input.availabilityDate > demand.neededDate) {
    return { status: 400, error: "The availability date must be on or before the needed date." };
  }

  const duplicate = {
    status: 409,
    error: "You already have an active offer for this request.",
  };
  if (await Supply.exists({
    farmer: farmerId,
    targetDemand: demand._id,
    status: "available",
  })) {
    return duplicate;
  }

  const active = await Supply.countDocuments({ farmer: farmerId, status: "available" });
  if (active >= MAX_ACTIVE_LISTINGS) {
    return { status: 400, error: "You have reached the limit of active supply listings." };
  }

  const expected = input.supplyType === "expected";
  let supply;
  try {
    supply = await Supply.create({
      farmer: farmerId,
      targetDemand: demand._id,
      product: demand.product, // from database, never from client
      unit: demand.unit, // from database
      location: demand.location, // from database
      supplyType: input.supplyType,
      estimatedQuantity: expected ? qty : null,
      actualQuantity: expected ? null : qty,
      reservedQuantity: 0,
      availableQuantity: qty,
      availabilityDate: input.availabilityDate,
      status: "available",
    });
  } catch (err) {
    if (err && err.code === 11000) return duplicate;
    throw err;
  }

  let match = null;
  try {
    match = await allocate(supply, demand, qty, {
      notice: {
        title: "Offer submitted",
        message: `Your offer of ${qty} ${demand.unit} of ${demand.product} was received. Review it in Matches.`,
      },
    });
  } catch (err) {
    await retireTargetedSupply(supply._id);
    throw err;
  }

  if (!match) {
    await retireTargetedSupply(supply._id);
    return {
      status: 409,
      error: "The remaining quantity just changed. Please refresh and try again.",
    };
  }

  await syncDemandStatus(demand._id);
  return { match, supply };
}