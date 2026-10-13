import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const [email, name, password] = process.argv.slice(2);
const cleanEmail = (email || "").trim().toLowerCase();

if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(cleanEmail) || !name || !password) {
  console.error('Usage: node createAdmin.js you@gmail.com "Name" "Password"');
  process.exit(1);
}
if (password.length < 8 || password.length > 64) {
  console.error("Password must be 8-64 characters.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const hash = await bcrypt.hash(password, 10);
await mongoose.connection.collection("users").updateOne(
  { email: cleanEmail },
  {
    $set: {
      name: name.trim(),
      password: hash,
      role: "admin",
      consentAt: new Date(),
      failedLoginAttempts: 0,
      lockUntil: null,
      lockCount: 0,
      tokenVersion: 0,
      updatedAt: new Date(),
    },
    $setOnInsert: { createdAt: new Date() },
  },
  { upsert: true }
);
console.log(`Admin ready: ${cleanEmail}`);
await mongoose.disconnect();