import express from "express";

import authenticateToken from "../middleware/isAuthenticated.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  getAllCompanies,
  getCompanyById,
  registerCompany,
  updateCompany,
} from "../controllers/company.controller.js";
import { singleUpload } from "../middleware/multer.js";

const router = express.Router();

router.route("/register").post(authenticateToken, requireRole("Recruiter"), registerCompany);
router.route("/get").get(authenticateToken, requireRole("Recruiter"), getAllCompanies);
router.route("/get/:id").get(authenticateToken, requireRole("Recruiter"), getCompanyById);
router.route("/update/:id").put(authenticateToken, requireRole("Recruiter"), singleUpload, updateCompany);

export default router;
