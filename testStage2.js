import "dotenv/config";
import mongoose from "mongoose";
import { Supply, Demand } from "./farmModels.js";
import { Match } from "./matchModel.js";
import { Notice } from "./noticeModel.js";
import {
  matchDemand, matchSupply, confirmMatch, declineMatch, cancelDemandWithMatches,
} from "./matchingEngine.js";

await mongoose.connect(process.env.MONGO_URI, { dbName: "farmlink_matching_test" });
await mongoose.connection.dropDatabase();

let failed = 0;
const check = (label, ok) => { console.log(ok ? "PASS" : "FAIL", label); if (!ok) failed += 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 60 * 60 * 1000;
const id = () => new mongoose.Types.ObjectId();

async function addSupply(qty) {
  const s = await Supply.create({
    farmer: id(), product: "Potato", supplyType: "onhand",
    actualQuantity: qty, availableQuantity: qty, unit: "kg",
    availabilityDate: new Date(Date.now() - DAY), location: "Pangasinan", status: "available",
  });
  await wait(20);
  return s;
}
const addDemand = (qty) =>
  Demand.create({
    buyer: id(), product: "Potato", quantity: qty, unit: "kg",
    neededDate: new Date(Date.now() + 30 * DAY), location: "Pangasinan",
  });

const A = await addSupply(30);
const B = await addSupply(25);
const C = await addSupply(150);
const d1 = await addDemand(200);
await matchDemand(d1._id);

const mA = await Match.findOne({ demand: d1._id, supply: A._id });
const mB = await Match.findOne({ demand: d1._id, supply: B._id });

// --- Farmer A declines -> fallback to next FIFO supply
check("wrong farmer cannot decline", (await declineMatch(mA._id, id())) === null);
check("owner declines", (await declineMatch(mA._id, A.farmer)) !== null);
check("buyer notified of the decline", (await Notice.countDocuments({ user: d1.buyer, type: "match_declined" })) === 1);check("declined match status", (await Match.findById(mA._id)).status === "declined");
const A1 = await Supply.findById(A._id).lean();
check("A hold released (available 30, reserved 0)", A1.availableQuantity === 30 && A1.reservedQuantity === 0);
const c5 = await Match.find({ demand: d1._id, supply: C._id, status: "pending_confirmation" }).sort({ createdAt: 1 }).lean();
check("fallback gave C the leftover 5 kg", c5.length === 2 && c5[1].quantity === 5);
check("declined supply A not re-matched to same demand",
  (await Match.countDocuments({ demand: d1._id, supply: A._id })) === 1);
check("demand matched 175", (await Demand.findById(d1._id)).matchedQuantity === 175);

// --- New supply D covers the rest
const D = await addSupply(40);
await matchSupply(D._id);
const mD = await Match.findOne({ demand: d1._id, supply: D._id });
check("new supply D matched 25", mD && mD.quantity === 25);
check("demand fully covered (200)", (await Demand.findById(d1._id)).matchedQuantity === 200);

// --- Confirm
check("wrong farmer cannot confirm", (await confirmMatch(mB._id, id())) === null);
check("owner confirms", (await confirmMatch(mB._id, B.farmer)) !== null);
check("buyer notified of the confirmation", (await Notice.countDocuments({ user: d1.buyer, type: "match_confirmed" })) === 1);
check("match confirmed", (await Match.findById(mB._id)).status === "confirmed");
check("cannot confirm twice", (await confirmMatch(mB._id, B.farmer)) === null);

// --- Buyer cancel is blocked when something is confirmed
check("cancel blocked with confirmed match",
  (await cancelDemandWithMatches(d1._id, d1.buyer)) === "locked");
check("other buyer sees not_found", (await cancelDemandWithMatches(d1._id, id())) === "not_found");

// --- Buyer cancels a demand with only pending matches
const d2 = await addDemand(10);
await matchDemand(d2._id);
const m2 = await Match.findOne({ demand: d2._id });
check("d2 matched from oldest free supply (A)", m2 && String(m2.supply) === String(A._id));
check("cancel ok", (await cancelDemandWithMatches(d2._id, d2.buyer)) === "ok");
check("d2 match cancelled", (await Match.findById(m2._id)).status === "cancelled");
const A2 = await Supply.findById(A._id).lean();
check("A hold released after cancel", A2.availableQuantity === 30 && A2.reservedQuantity === 0);
const d2b = await Demand.findById(d2._id).lean();
check("d2 cancelled, matched 0", d2b.status === "cancelled" && d2b.matchedQuantity === 0);

console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
process.exit(failed === 0 ? 0 : 1);