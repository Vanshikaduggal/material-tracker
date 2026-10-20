// Creates or updates the admin account.
// Usage (PowerShell):
//   $env:ADMIN_EMAIL="you@x.com"; $env:ADMIN_PASSWORD="..."; $env:ADMIN_NAME="Your Name"; npm run seed:admin
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Administrator" } = process.env;

if (!MONGODB_URI) throw new Error("MONGODB_URI is not set (check .env.local)");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables");
if (ADMIN_PASSWORD.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

const users = mongoose.connection.collection("users");
await users.createIndex({ email: 1 }, { unique: true });

const email = ADMIN_EMAIL.trim().toLowerCase();
const now = new Date();
const res = await users.updateOne(
  { email },
  {
    $set: { name: ADMIN_NAME, role: "admin", active: true, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), updatedAt: now },
    $setOnInsert: { email, createdAt: now },
  },
  { upsert: true },
);

console.log(res.upsertedCount ? `Admin created: ${email}` : `Admin updated: ${email}`);
await mongoose.disconnect();
