import mongoose from "mongoose";
const { Schema } = mongoose;

const jobDraftSchema = new Schema({ owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, title: String, description: String, requirements: [String], salary: String, experienceLevel: Number, location: String, jobType: String, position: Number, company: { type: Schema.Types.ObjectId, ref: "Company" }, publishAt: Date, expiresAt: Date }, { timestamps: true });
const resumeSchema = new Schema({ owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, name: { type: String, required: true, maxlength: 100 }, targetRole: String, url: { type: String, required: true }, isPrimary: { type: Boolean, default: false } }, { timestamps: true });
const careerRecordSchema = new Schema({ owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, kind: { type: String, enum: ["resume-analysis", "mock-interview", "roadmap", "prep-log", "job-alert", "company-prep", "assessment"], required: true }, title: String, payload: { type: Schema.Types.Mixed, default: {} } }, { timestamps: true });
const interviewSchema = new Schema({ job: { type: Schema.Types.ObjectId, ref: "Job", required: true }, application: { type: Schema.Types.ObjectId, ref: "Application", required: true }, recruiter: { type: Schema.Types.ObjectId, ref: "User", required: true }, student: { type: Schema.Types.ObjectId, ref: "User", required: true }, scheduledAt: { type: Date, required: true }, mode: { type: String, enum: ["online", "offline", "phone"], default: "online" }, meetingLink: String, location: String, status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" }, reminderSentAt: Date, feedback: String, rating: { type: Number, min: 1, max: 5 } }, { timestamps: true });
const recruiterNoteSchema = new Schema({ recruiter: { type: Schema.Types.ObjectId, ref: "User", required: true }, application: { type: Schema.Types.ObjectId, ref: "Application", required: true }, note: { type: String, required: true, maxlength: 3000 } }, { timestamps: true });
const screeningQuestionSchema = new Schema({ recruiter: { type: Schema.Types.ObjectId, ref: "User", required: true }, job: { type: Schema.Types.ObjectId, ref: "Job", required: true }, question: { type: String, required: true, maxlength: 500 }, type: { type: String, enum: ["text", "yes-no", "choice"], default: "text" }, options: [String], required: { type: Boolean, default: false } }, { timestamps: true });
const conversationSchema = new Schema({ participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }], job: { type: Schema.Types.ObjectId, ref: "Job" }, lastMessageAt: Date }, { timestamps: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
const messageSchema = new Schema({ conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true }, sender: { type: Schema.Types.ObjectId, ref: "User", required: true }, text: { type: String, required: true, maxlength: 4000 }, readAt: Date }, { timestamps: true });
const reportSchema = new Schema({ reporter: { type: Schema.Types.ObjectId, ref: "User", required: true }, targetType: { type: String, enum: ["job", "company", "user", "message"], required: true }, targetId: { type: Schema.Types.ObjectId, required: true }, reason: { type: String, required: true, maxlength: 2000 }, status: { type: String, enum: ["open", "reviewing", "resolved", "dismissed"], default: "open" }, adminNote: String }, { timestamps: true });
const adminLogSchema = new Schema({ admin: { type: Schema.Types.ObjectId, ref: "User", required: true }, action: { type: String, required: true }, targetType: String, targetId: Schema.Types.ObjectId, details: String }, { timestamps: true });

export const JobDraft = mongoose.models.JobDraft || mongoose.model("JobDraft", jobDraftSchema);
export const ResumeProfile = mongoose.models.ResumeProfile || mongoose.model("ResumeProfile", resumeSchema);
export const CareerRecord = mongoose.models.CareerRecord || mongoose.model("CareerRecord", careerRecordSchema);
export const Interview = mongoose.models.Interview || mongoose.model("Interview", interviewSchema);
export const RecruiterNote = mongoose.models.RecruiterNote || mongoose.model("RecruiterNote", recruiterNoteSchema);
export const ScreeningQuestion = mongoose.models.ScreeningQuestion || mongoose.model("ScreeningQuestion", screeningQuestionSchema);
export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
export const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export const PlatformReport = mongoose.models.PlatformReport || mongoose.model("PlatformReport", reportSchema);
export const AdminLog = mongoose.models.AdminLog || mongoose.model("AdminLog", adminLogSchema);
