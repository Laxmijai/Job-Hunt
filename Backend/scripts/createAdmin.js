import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
dotenv.config();
const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Platform Admin" } = process.env;
if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("Set MONGO_URI, ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in Backend/.env");
  process.exit(1);
}
try {
  await mongoose.connect(MONGO_URI);
  const email = ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = "Admin"; existing.isVerified = true; existing.isSuspended = false;
    if (existing.password && !(await bcrypt.compare(ADMIN_PASSWORD, existing.password))) existing.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await existing.save();
    console.log(`Admin account updated: ${email}`);
  } else {
    await User.create({ fullname: ADMIN_NAME, email, phoneNumber: `admin-${Date.now()}`, password: await bcrypt.hash(ADMIN_PASSWORD, 12), role: "Admin", isVerified: true });
    console.log(`Admin account created: ${email}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
