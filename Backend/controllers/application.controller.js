import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";

export const applyJob = async (req, res) => {
  try {
    const userId = req.id;
    const applicant = await User.findById(userId).select("role");
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
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found", success: false });
    }
    // create a new application

    const newApplication = await Application.create({
      job: jobId,
      applicant: userId,
    });
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
      populate: { path: "applicant", options: { sort: { createdAt: -1 } } },
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

    return res
      .status(200)
      .json({ message: "Application status updated", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};
