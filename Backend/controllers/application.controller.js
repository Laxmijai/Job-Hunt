import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { ResumeProfile, ScreeningQuestion } from "../models/workspace.model.js";
import { sendNotificationEmail } from "../utils/mailer.js";

export const applyJob = async (req, res) => {
  try {
    const userId = req.id;
    const applicant = await User.findById(userId).select("role profile.resume");
    if (!applicant || applicant.role !== "Student") return res.status(403).json({ message: "Only students can apply for jobs", success: false });
    const jobId = req.params.id;
    if (!jobId) {
      return res
        .status(400)
        .json({ message: "Invalid job id", success: false });
    }
    // check if the user already has applied for this job
    const existingApplication = await Application.findOne({
      job: jobId,
      applicant: userId,
    });
    if (existingApplication) {
      return res.status(400).json({
        message: "You have already applied for this job",
        success: false,
      });
    }
    //check if the job exists or not
    const job = await Job.findOne({ _id: jobId, status: { $in: ["published", null] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    if (!job) {
      return res.status(404).json({ message: "Job not found", success: false });
    }
    // create a new application

    let resumeSnapshot = applicant.profile?.resume || "";
    let resumeLabel = "Profile resume";
    if (req.body?.resumeId) {
      const selectedResume = await ResumeProfile.findOne({ _id: req.body.resumeId, owner: userId });
      if (!selectedResume) return res.status(400).json({ message: "Selected resume was not found", success: false });
      resumeSnapshot = selectedResume.url;
      resumeLabel = selectedResume.name;
    } else {
      const primaryResume = await ResumeProfile.findOne({ owner: userId, isPrimary: true });
      if (primaryResume) { resumeSnapshot = primaryResume.url; resumeLabel = primaryResume.name; }
    }
    const requiredQuestions = await ScreeningQuestion.find({ job: jobId, required: true }).select("_id question type options");
    const screeningAnswers = req.body?.screeningAnswers && typeof req.body.screeningAnswers === "object" ? req.body.screeningAnswers : {};
    for (const question of requiredQuestions) {
      const answer = String(screeningAnswers[question._id] || "").trim();
      if (!answer) return res.status(400).json({ message: `Please answer: ${question.question}`, success: false });
      if (question.type === "choice" && !question.options.includes(answer)) return res.status(400).json({ message: `Choose a valid answer for: ${question.question}`, success: false });
      if (question.type === "yes-no" && !["yes", "no"].includes(answer.toLowerCase())) return res.status(400).json({ message: `Answer yes or no for: ${question.question}`, success: false });
    }
    const newApplication = await Application.create({ job: jobId, applicant: userId, resumeSnapshot, resumeLabel, source: String(req.body?.source || "job-listing").slice(0,80), screeningAnswers });
    job.applications.push(newApplication._id);
    await job.save();

    return res
      .status(201)
      .json({ message: "Application submitted", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};

export const getAppliedJobs = async (req, res) => {
  try {
    const userId = req.id;
    const application = await Application.find({ applicant: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "job",
        options: { sort: { createdAt: -1 } },
        populate: { path: "company", options: { sort: { createdAt: -1 } } },
      });
    if (!application) {
      return res
        .status(404)
        .json({ message: "No applications found", success: false });
    }

    return res.status(200).json({ application, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};

export const getApplicants = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).populate({
      path: "applications",
      options: { sort: { createdAt: -1 } },
      populate: { path: "applicant", select: "fullname email role profile createdAt", options: { sort: { createdAt: -1 } } },
    });
    if (!job) {
      return res.status(404).json({ message: "Job not found", success: false });
    }
    if (job.created_by.toString() !== req.id.toString()) {
      return res.status(403).json({ message: "You are not allowed to view these applicants", success: false });
    }

    return res.status(200).json({ job, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { status, interviewDate, interviewMode, meetingLink, notes } = req.body;
    const applicationId = req.params.id;
    if (!status) {
      return res.status(400).json({
        message: "status is required",
        success: false,
      });
    }

    // find the application by applicantion id
    const application = await Application.findOne({ _id: applicationId });
    if (!application) {
      return res.status(404).json({
        message: "Application not found.",
        success: false,
      });
    }

    // Only the recruiter who created the related job can change its application.
    const job = await Job.findById(application.job);
    if (!job || job.created_by.toString() !== req.id.toString()) {
      return res.status(403).json({ message: "You are not allowed to update this application", success: false });
    }
    const allowedStatuses = ["applied", "shortlisted", "assessment", "interview", "selected", "rejected", "pending", "accepted"];
    if (!allowedStatuses.includes(status.toLowerCase())) return res.status(400).json({ message: "Invalid application status", success: false });
    application.status = status.toLowerCase();
    const interviewWasChanged = interviewDate !== undefined && Boolean(interviewDate) && (!application.interviewDate || new Date(interviewDate).getTime() !== new Date(application.interviewDate).getTime());
    if (interviewDate !== undefined) application.interviewDate = interviewDate || null;
    if (interviewMode !== undefined) application.interviewMode = interviewMode;
    if (meetingLink !== undefined) application.meetingLink = meetingLink;
    if (notes !== undefined) application.notes = notes;
    await application.save();
    const notificationMessage = interviewWasChanged
      ? `Your interview for ${job.title} has been scheduled for ${new Date(interviewDate).toLocaleString()}.`
      : `Your application for ${job.title} is now ${application.status}.`;
    await Notification.create({
      recipient: application.applicant,
      title: interviewWasChanged ? "Interview scheduled" : "Application status updated",
      message: notificationMessage,
      type: interviewWasChanged ? "interview" : "application",
      link: "/career-hub",
    });
    const applicantUser = await User.findById(application.applicant).select("email notificationPreferences");
    if (applicantUser?.email && applicantUser.notificationPreferences?.email !== false && process.env.BREVO_API_KEY) {
      try { await sendNotificationEmail(applicantUser.email, interviewWasChanged ? "Interview scheduled" : "Application update", notificationMessage); }
      catch (emailError) { console.error("Application notification email failed:", emailError.message); }
    }

    return res
      .status(200)
      .json({ message: "Application status updated", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};
