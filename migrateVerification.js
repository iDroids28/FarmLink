import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGO_URI);
const users = mongoose.connection.collection("users");

const filter = { role: { $in: ["farmer", "buyer"] }, verificationStatus: { $exists: false } };
const targets = await users.find(filter, { projection: { email: 1, role: 1 } }).toArray();

console.log(`${targets.length} account(s) would be tagged verificationStatus="legacy" (role and access unchanged):`);
targets.forEach((u) => console.log(` - ${u.email} (${u.role})`));

if (apply) {
  const r = await users.updateMany(filter, { $set: { verificationStatus: "legacy" } });
  console.log(`APPLIED: ${r.modifiedCount} account(s) updated.`);
} else {
  console.log("Dry run only. Re-run with --apply to write.");
}
await mongoose.disconnect();