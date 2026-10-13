import "dotenv/config";
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const users = await db.collection("users")
  .find({}, { projection: { name: 1, email: 1, role: 1, verificationStatus: 1 } }).toArray();

const countBy = async (coll, field) => {
  const rows = await db.collection(coll).aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((r) => [String(r._id), r.n]));
};
const [supplies, demands, matchF, matchB, oldReqs, oldSups] = await Promise.all([
  countBy("supplies", "farmer"), countBy("demands", "buyer"),
  countBy("matches", "farmer"), countBy("matches", "buyer"),
  countBy("farmlink_requirements", "buyer"), countBy("farmlink_supplies", "farmer"),
]);
const apps = await db.collection("farmlink_applications").find({}, { projection: { user: 1, status: 1 } }).toArray();
const appBy = new Map(apps.map((a) => [String(a.user), a.status]));

const table = users.map((u) => {
  const id = String(u._id);
  const row = {
    email: u.email, role: u.role, verification: u.verificationStatus || "(missing)",
    supplies: supplies.get(id) || 0, demands: demands.get(id) || 0,
    matchesAsFarmer: matchF.get(id) || 0, matchesAsBuyer: matchB.get(id) || 0,
    oldRequirements: oldReqs.get(id) || 0, oldSupplies: oldSups.get(id) || 0,
    oldApplication: appBy.get(id) || "-",
  };
  const activity = row.supplies + row.demands + row.matchesAsFarmer + row.matchesAsBuyer + row.oldRequirements + row.oldSupplies;
  row.note = u.role === "admin" ? "" : activity === 0 && row.oldApplication === "-" ? "no activity" : activity > 0 ? "has data" : "";
  return row;
});
console.table(table);
console.log(`${users.length} user(s). Nothing was changed.`);
await mongoose.disconnect();