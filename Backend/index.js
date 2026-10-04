import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./utils/db.js";
import userRoute from "./routes/user.route.js";
import companyRoute from "./routes/company.route.js";
import jobRoute from "./routes/job.route.js";
import applicationRoute from "./routes/application.route.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
const frontendURL = process.env.CORS_ORIGIN;

console.log("CORS_ORIGIN:", frontendURL);

app.use(
  cors({
    origin: frontendURL,
    credentials: true,
  })
);

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Job Hunt Backend is running",
  });
});

// API routes
app.use("/api/user", userRoute);
app.use("/api/company", companyRoute);
app.use("/api/job", jobRoute);
app.use("/api/application", applicationRoute);

// Port
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  connectDB();
  console.log(`Server is running on port ${PORT}`);
});