import express from "express";
import {
  forgotPassword,
  login,
  logout,
  register,
  resendOtp,
  resetPassword,
  updateProfile,
  getSavedJobs,
  toggleSavedJob,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  verifyOtp,
} from "../controllers/user.controller.js";
import authenticateToken from "../middleware/isAuthenticated.js";
import { singleUpload } from "../middleware/multer.js";

const router = express.Router();

router.route("/register").post(singleUpload, register);
router.route("/verify-otp").post(verifyOtp);
router.route("/resend-otp").post(resendOtp);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);
router.route("/login").post(login);
router.route("/logout").post(logout);
router.route("/saved-jobs").get(authenticateToken, getSavedJobs);
router.route("/saved-jobs/:jobId").post(authenticateToken, toggleSavedJob);
router.route("/notifications").get(authenticateToken, getNotifications);
router.route("/notifications/read-all").patch(authenticateToken, markAllNotificationsRead);
router.route("/notifications/:id/read").patch(authenticateToken, markNotificationRead);
router
  .route("/profile/update")
  .post(authenticateToken, singleUpload, updateProfile);

export default router;
