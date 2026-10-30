import mongoose from "mongoose";
const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeSnapshot: { type: String },
    resumeLabel: { type: String },
    source: { type: String, default: "job-listing", maxlength: 80 },
    screeningAnswers: { type: Map, of: String, default: {} },
    interviewDate: { type: Date },
    interviewMode: { type: String, enum: ["online", "offline", "phone", ""] },
    meetingLink: { type: String },
    notes: { type: String, maxlength: 2000 },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "assessment", "interview", "selected", "rejected", "pending", "accepted"],
      default: "applied",
    },
  },
  {
    timestamps: true,
  }
);

export const Application = mongoose.model("Application", applicationSchema);
