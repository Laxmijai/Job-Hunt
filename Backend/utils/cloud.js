import { v2 as cloudinary } from "cloudinary";

import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API,
  api_secret: process.env.API_SECRET,
});
console.log("Cloudinary config:", {
  cloud_name: process.env.CLOUD_NAME,
  api_key_exists: !!process.env.CLOUD_API,
  api_secret_exists: !!process.env.API_SECRET,
});

export default cloudinary;
