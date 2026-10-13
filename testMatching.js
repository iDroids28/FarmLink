import "dotenv/config";
import mongoose from "mongoose";
import { Supply, Demand } from "./farmModels.js";
import { Match } from "./matchModel.js";
import { Notice } from "./noticeModel.js";
import { matchDemand } from "./matchingEngine.js";

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
  await wait(20); // keep createdAt order distinct
  return s;
}
const addDemand = (qty, over = {}) =>
  Demand.create({
    buyer: id(), product: "Potato", quantity: qty, unit: "kg",
    neededDate: new Date(Date.now() + 30 * DAY), location: "Pangasinan", ...over,
  });

const A = await addSupply(30);
const B = await addSupply(25);
const C = await addSupply(150);

const d1 = await addDemand(200);
await matchDemand(d1._id);
const m1 = await Match.find({ demand: d1._id }).sort({ createdAt: 1 }).lean();
check("3 matches created", m1.length === 3);
check("allocation 30 / 25 / 145", m1.map((m) => m.quantity).join() === "30,25,145");
check("all matches pending", m1.every((m) => m.status === "pending_confirmation"));
check("each of the 3 farmers got a match notice", (await Notice.countDocuments({ type: "match_created" })) === 3);
const C1 = await Supply.findById(C._id).lean();
check("farmer C: reserved 145, available 5", C1.reservedQuantity === 145 && C1.availableQuantity === 5);
const d1b = await Demand.findById(d1._id).lean();
check("demand matchedQuantity 200", d1b.matchedQuantity === 200);
check("demand status potential_match", d1b.status === "potential_match");

// Leftover 5 kg keeps its place; different casing must still match.
const d2 = await addDemand(10, { product: "potato", location: "pangasinan" });
await matchDemand(d2._id);
const m2 = await Match.find({ demand: d2._id }).lean();
check("second demand gets the leftover 5 kg", m2.length === 1 && m2[0].quantity === 5);
const d2b = await Demand.findById(d2._id).lean();
check("second demand partially covered (matched 5 of 10)", d2b.matchedQuantity === 5 && d2b.status === "potential_match");
const C2 = await Supply.findById(C._id).lean();
check("farmer C fully held (available 0)", C2.availableQuantity === 0 && C2.reservedQuantity === 150);

// Different unit must NOT match.
const d3 = await addDemand(5, { unit: "ton" });
check("different unit gives no match", (await matchDemand(d3._id)) === 0);

// Same person on both sides must NOT match.
const me = id();
await Supply.create({
  farmer: me, product: "Cabbage", supplyType: "onhand",
  actualQuantity: 10, availableQuantity: 10, unit: "kg",
  availabilityDate: new Date(Date.now() - DAY), location: "Pangasinan", status: "available",
});
const d4 = await addDemand(10, { buyer: me, product: "Cabbage" });
check("self-match is blocked", (await matchDemand(d4._id)) === 0);

console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
process.exit(failed === 0 ? 0 : 1);