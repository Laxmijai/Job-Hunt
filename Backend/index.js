import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./utils/db.js";
import userRoute from "./routes/user.route.js";
import companyRoute from "./routes/company.route.js";
import jobRoute from "./routes/job.route.js";
import applicationRoute from "./routes/application.route.js";
import workspaceRoute from "./routes/workspace.route.js";
import { startScheduledTasks } from "./utils/scheduledTasks.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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
app.use("/api/workspace", workspaceRoute);

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error?.name === "MulterError" || /Only JPG|PNG|WEBP|GIF/.test(error?.message || "") ? 400 : 500;
  return res.status(status).json({ success: false, message: status === 400 ? error.message : "An unexpected server error occurred." });
});

// Port
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  startScheduledTasks();
};
startServer();