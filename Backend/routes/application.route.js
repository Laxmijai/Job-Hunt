import express from "express";

import authenticateToken from "../middleware/isAuthenticated.js";
import { requireRole } from "../middleware/requireRole.js";
import { applyJob, getApplicants, getAppliedJobs, updateStatus } from "../controllers/application.controller.js";

const router = express.Router();

router.route("/apply/:id").post(authenticateToken, requireRole("Student"), applyJob);
router.route("/get").get(authenticateToken, getAppliedJobs);
router.route("/:id/applicants").get(authenticateToken, requireRole("Recruiter"), getApplicants);
router.route("/status/:id/update").post(authenticateToken, requireRole("Recruiter"), updateStatus);

export default router;
