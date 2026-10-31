import express from "express";
import authenticateToken from "../middleware/isAuthenticated.js";
import { requireRole } from "../middleware/requireRole.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  generateJobDraft, saveJobDraft, getJobDrafts, publishDraft, bulkCreateJobs,
  createCareerRecord, getCareerRecords, deleteCareerRecord, analyzeResume, startMockInterview, submitMockInterview, generateRoadmap,
  addRecruiterNote, getRecruiterNotes, addScreeningQuestion, getScreeningQuestions, bulkApplicationAction,
  scheduleInterview, getInterviews, saveInterviewFeedback, startConversation, getConversations, getMessages, sendMessage, searchMessageRecipients,
  studentAnalytics, recruiterAnalytics, reportContent,
  adminOverview, adminUsers, adminSetSuspension, adminCompanies, adminVerifyCompany, adminJobs, adminSetJobStatus, adminReports, adminUpdateReport, adminActivity, rankApplicants, compareCandidates, getResumeProfiles, createResumeProfile, setPrimaryResume, deleteResumeProfile, updateCareerRecord, generateCompanyPrep, saveSelfAssessment, getPublicScreeningQuestions,
} from "../controllers/workspace.controller.js";
const router = express.Router();
router.use(authenticateToken);

router.post("/reports", reportContent);
router.get("/analytics/student", requireRole("Student"), studentAnalytics);
router.get("/analytics/recruiter", requireRole("Recruiter"), recruiterAnalytics);

router.post("/student/resume/analyze", requireRole("Student"), rateLimit({ max: 8, keyPrefix: "ai-resume" }), analyzeResume);
router.get("/student/jobs/:jobId/screening-questions", requireRole("Student"), getPublicScreeningQuestions);
router.get("/student/resumes", requireRole("Student"), getResumeProfiles);
router.post("/student/resumes", requireRole("Student"), createResumeProfile);
router.patch("/student/resumes/:id/primary", requireRole("Student"), setPrimaryResume);
router.delete("/student/resumes/:id", requireRole("Student"), deleteResumeProfile);
router.post("/student/mock-interviews", requireRole("Student"), rateLimit({ max: 8, keyPrefix: "ai-interview" }), startMockInterview);
router.post("/student/mock-interviews/:id/submit", requireRole("Student"), rateLimit({ max: 8, keyPrefix: "ai-interview-submit" }), submitMockInterview);
router.post("/student/roadmaps", requireRole("Student"), rateLimit({ max: 8, keyPrefix: "ai-roadmap" }), generateRoadmap);
router.post("/student/company-prep", requireRole("Student"), rateLimit({ max: 8, keyPrefix: "ai-company" }), generateCompanyPrep);
router.post("/student/assessment", requireRole("Student"), saveSelfAssessment);
router.get("/student/records", requireRole("Student"), getCareerRecords);
router.post("/student/records", requireRole("Student"), createCareerRecord);
router.patch("/student/records/:id", requireRole("Student"), updateCareerRecord);
router.delete("/student/records/:id", requireRole("Student"), deleteCareerRecord);

router.post("/recruiter/jobs/generate", requireRole("Recruiter"), rateLimit({ max: 10, keyPrefix: "ai-job" }), generateJobDraft);
router.get("/recruiter/jobs/drafts", requireRole("Recruiter"), getJobDrafts);
router.post("/recruiter/jobs/drafts", requireRole("Recruiter"), saveJobDraft);
router.post("/recruiter/jobs/drafts/:id/publish", requireRole("Recruiter"), publishDraft);
router.post("/recruiter/jobs/bulk", requireRole("Recruiter"), bulkCreateJobs);
router.post("/recruiter/notes", requireRole("Recruiter"), addRecruiterNote);
router.get("/recruiter/notes", requireRole("Recruiter"), getRecruiterNotes);
router.post("/recruiter/screening-questions", requireRole("Recruiter"), addScreeningQuestion);
router.get("/recruiter/screening-questions/:jobId", requireRole("Recruiter"), getScreeningQuestions);
router.post("/recruiter/applications/bulk", requireRole("Recruiter"), bulkApplicationAction);
router.get("/recruiter/jobs/:jobId/candidates", requireRole("Recruiter"), rankApplicants);
router.post("/recruiter/jobs/:jobId/compare", requireRole("Recruiter"), compareCandidates);
router.post("/recruiter/interviews", requireRole("Recruiter"), scheduleInterview);
router.post("/recruiter/interviews/:id/feedback", requireRole("Recruiter"), saveInterviewFeedback);
router.get("/interviews", getInterviews);

router.get("/messages/recipients", requireRole("Student", "Recruiter"), searchMessageRecipients);
router.post("/messages/conversations", startConversation);
router.get("/messages/conversations", getConversations);
router.get("/messages/conversations/:id", getMessages);
router.post("/messages/conversations/:id", sendMessage);

router.get("/admin/overview", requireRole("Admin"), adminOverview);
router.get("/admin/users", requireRole("Admin"), adminUsers);
router.patch("/admin/users/:id/suspension", requireRole("Admin"), adminSetSuspension);
router.get("/admin/companies", requireRole("Admin"), adminCompanies);
router.patch("/admin/companies/:id/verification", requireRole("Admin"), adminVerifyCompany);
router.get("/admin/jobs", requireRole("Admin"), adminJobs);
router.patch("/admin/jobs/:id/status", requireRole("Admin"), adminSetJobStatus);
router.get("/admin/reports", requireRole("Admin"), adminReports);
router.patch("/admin/reports/:id", requireRole("Admin"), adminUpdateReport);
router.get("/admin/activity", requireRole("Admin"), adminActivity);
export default router;
