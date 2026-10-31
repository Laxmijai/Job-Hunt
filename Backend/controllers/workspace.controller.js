import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Job } from "../models/job.model.js";
import { Company } from "../models/company.model.js";
import { Application } from "../models/application.model.js";
import { Notification } from "../models/notification.model.js";
import { JobDraft, ResumeProfile, CareerRecord, Interview, RecruiterNote, ScreeningQuestion, Conversation, Message, PlatformReport, AdminLog } from "../models/workspace.model.js";
import askAI from "../utils/aiClient.js";
import { sendNotificationEmail } from "../utils/mailer.js";
import { notifyMatchingStudents } from "../utils/jobAlerts.js";

const fail = (res, error, status = 500) => res.status(status).json({ success: false, message: error });
const safeJson = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(text); } catch { /* Try to isolate a JSON object/array from short model commentary. */ }
  const start = Math.min(...[text.indexOf("{"), text.indexOf("[")].filter(index => index >= 0));
  if (!Number.isFinite(start)) return null;
  const opening = text[start], closing = opening === "{" ? "}" : "]";
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === opening) depth++;
    if (char === closing && --depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
};
const notify = async (recipient, title, message, link = "/career-hub", type = "system") => {
  if (!recipient) return;
  await Notification.create({ recipient, title, message, link, type });
  const user = await User.findById(recipient).select("email notificationPreferences");
  if (user?.notificationPreferences?.email !== false && user?.email && process.env.BREVO_API_KEY) {
    try { await sendNotificationEmail(user.email, title, message); }
    catch (error) { console.error("Notification email failed:", error.message); }
  }
};
const ownsJob = async (jobId, userId) => Job.findOne({ _id: jobId, created_by: userId });
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// Recruiter: AI-assisted job draft. Nothing is published until the recruiter confirms it.
export const generateJobDraft = async (req, res) => {
  try {
    if (req.userRole !== "Recruiter") return fail(res, "Recruiter access required", 403);
    const { title, company, experienceLevel, location, jobType, notes } = req.body;
    if (!title?.trim() || !location?.trim() || !jobType) return fail(res, "Enter a job title, location and job type first", 400);
    const prompt = `Create a practical job description for a real hiring team. Return JSON with keys title, description, requirements (array), salary (string), experienceLevel (number), location, jobType, position (number). Do not invent company-specific facts. Use the supplied facts and sensible editable suggestions. If no salary is supplied, use "Not specified" rather than inventing one. Keep language natural, concise and non-promotional.\n${JSON.stringify({ title, company, experienceLevel, location, jobType, notes })}`;
    let draft;
    try { draft = safeJson(await askAI("You write clear, realistic job descriptions. Return JSON only.", prompt)); } catch (e) { return fail(res, e.message || "AI service unavailable. Please try again later.", 503); }
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return fail(res, "The AI response could not be read. Please try again.", 502);
    draft.title = String(draft.title || title).slice(0, 150);
    draft.description = String(draft.description || "").slice(0, 12000);
    draft.requirements = Array.isArray(draft.requirements) ? draft.requirements.map(String).slice(0, 40) : [];
    draft.salary = String(draft.salary || "Not specified").slice(0, 100);
    draft.location = String(draft.location || location).slice(0, 150);
    draft.jobType = String(draft.jobType || jobType).slice(0, 60);
    draft.experienceLevel = Math.max(0, Number(draft.experienceLevel ?? experienceLevel) || 0);
    draft.position = Math.max(1, Number(draft.position) || 1);
    return res.json({ success: true, draft });
  } catch (e) { return fail(res, e.message); }
};

export const saveJobDraft = async (req, res) => {
  try {
    const payload = { ...req.body, owner: req.id, updatedAt: new Date() };
    delete payload._id;
    const draft = req.body._id && validId(req.body._id)
      ? await JobDraft.findOneAndUpdate({ _id: req.body._id, owner: req.id }, payload, { new: true, runValidators: true })
      : await JobDraft.create(payload);
    if (!draft) return fail(res, "Draft not found", 404);
    res.status(200).json({ success: true, draft });
  } catch (e) { fail(res, e.message, 400); }
};
export const getJobDrafts = async (req, res) => { try { res.json({ success: true, drafts: await JobDraft.find({ owner: req.id }).sort({ updatedAt: -1 }) }); } catch (e) { fail(res, e.message); } };
export const publishDraft = async (req, res) => {
  try {
    const draft = await JobDraft.findOne({ _id: req.params.id, owner: req.id });
    if (!draft) return fail(res, "Draft not found", 404);
    if (!draft.company || !(await Company.exists({ _id: draft.company, userId: req.id }))) return fail(res, "Choose a company belonging to your account", 400);
    const scheduled = draft.publishAt && new Date(draft.publishAt) > new Date();
    const publishTime = scheduled ? new Date(draft.publishAt) : new Date();
    if (draft.expiresAt && new Date(draft.expiresAt) <= publishTime) return fail(res, "Expiry must be after the publish time", 400);
    const job = await Job.create({ title: draft.title, description: draft.description, requirements: draft.requirements, salary: draft.salary || "Not specified", experienceLevel: draft.experienceLevel || 0, location: draft.location, jobType: draft.jobType, position: draft.position || 1, company: draft.company, created_by: req.id, status: scheduled ? "draft" : "published", publishAt: draft.publishAt || undefined, expiresAt: draft.expiresAt || undefined });
    await draft.deleteOne();
    if (!scheduled) await notifyMatchingStudents(job);
    res.status(201).json({ success: true, job, message: scheduled ? "Job scheduled for publishing" : "Job published" });
  } catch (e) { fail(res, e.message, 400); }
};
export const duplicateJob = async (req, res) => {
  try {
    const source = await ownsJob(req.params.id, req.id);
    if (!source) return fail(res, "Job not found", 404);
    const draft = await JobDraft.create({ owner: req.id, title: `${source.title} (Copy)`, description: source.description, requirements: source.requirements, salary: source.salary, experienceLevel: source.experienceLevel, location: source.location, jobType: source.jobType, position: source.position, company: source.company });
    res.status(201).json({ success: true, draft });
  } catch (e) { fail(res, e.message); }
};
export const bulkCreateJobs = async (req, res) => {
  try {
    if (!Array.isArray(req.body.jobs) || req.body.jobs.length < 1 || req.body.jobs.length > 100) return fail(res, "Upload between 1 and 100 job rows", 400);
    const companies = await Company.find({ userId: req.id }).select("_id");
    const allowed = new Set(companies.map(c => String(c._id)));
    const created = [], errors = [];
    for (let i = 0; i < req.body.jobs.length; i++) {
      const row = req.body.jobs[i];
      if (!row.title || !row.description || !row.location || !row.jobType || !row.company || !allowed.has(String(row.company))) { errors.push({ row: i + 2, message: "Missing required fields or company does not belong to your account" }); continue; }
      try { created.push(await Job.create({ title: String(row.title).slice(0,150), description: String(row.description).slice(0,12000), requirements: Array.isArray(row.requirements) ? row.requirements : String(row.requirements || "").split(",").map(x=>x.trim()).filter(Boolean), salary: String(row.salary || "Not specified"), experienceLevel: Math.max(0, Number(row.experienceLevel)||0), location: String(row.location), jobType: String(row.jobType), position: Math.max(1,Number(row.position)||1), company: row.company, created_by: req.id })); } catch (e) { errors.push({ row: i + 2, message: e.message }); }
    }
    for (const job of created) await notifyMatchingStudents(job);
    res.status(200).json({ success: true, created: created.length, errors, jobs: created });
  } catch (e) { fail(res, e.message); }
};

// Student career records are private to the authenticated student.
export const createCareerRecord = async (req, res) => {
  try {
    const allowed = ["resume-analysis", "mock-interview", "roadmap", "prep-log", "job-alert", "company-prep", "assessment"];
    if (!allowed.includes(req.body.kind)) return fail(res, "Invalid career record type", 400);
    const record = await CareerRecord.create({ owner: req.id, kind: req.body.kind, title: String(req.body.title || "").slice(0,150), payload: req.body.payload || {} });
    res.status(201).json({ success: true, record });
  } catch (e) { fail(res, e.message, 400); }
};
export const getCareerRecords = async (req, res) => {
  try { const filter = { owner: req.id }; if (req.query.kind) filter.kind = req.query.kind; res.json({ success: true, records: await CareerRecord.find(filter).sort({ createdAt: -1 }).limit(100) }); }
  catch (e) { fail(res, e.message); }
};
export const deleteCareerRecord = async (req, res) => {
  try { const record = await CareerRecord.findOneAndDelete({ _id: req.params.id, owner: req.id }); if (!record) return fail(res, "Record not found", 404); res.json({ success: true }); }
  catch (e) { fail(res, e.message, 400); }
};
export const analyzeResume = async (req, res) => {
  try {
    const { resumeText, jobDescription = "", targetRole = "" } = req.body;
    if (!resumeText || String(resumeText).trim().length < 80) return fail(res, "Paste at least a few paragraphs of resume text. PDF text extraction can be added through your local PDF reader and pasted here.", 400);
    const prompt = `Review this resume text for the target role. Return JSON only with keys score (0-100), summary, strengths (array), missingKeywords (array), improvements (array), jobMatch (0-100 or null). Do not claim this is a real ATS score; label it an estimate. Be specific and constructive. Target role: ${targetRole}\nJob description: ${jobDescription}\nResume: ${String(resumeText).slice(0,18000)}`;
    const result = safeJson(await askAI("You are a practical resume reviewer. Never guarantee ATS outcomes. Return valid JSON only.", prompt));
    if (!result || !Number.isFinite(Number(result.score))) return fail(res, "Could not interpret the AI analysis. Please retry.", 502);
    const analysis = { score: Math.max(0,Math.min(100,Number(result.score))), summary: String(result.summary||""), strengths: Array.isArray(result.strengths)?result.strengths.slice(0,10):[], missingKeywords: Array.isArray(result.missingKeywords)?result.missingKeywords.slice(0,30):[], improvements: Array.isArray(result.improvements)?result.improvements.slice(0,15):[], jobMatch: result.jobMatch == null ? null : Math.max(0,Math.min(100,Number(result.jobMatch))) };
    const record = await CareerRecord.create({ owner: req.id, kind: "resume-analysis", title: targetRole || "Resume analysis", payload: analysis });
    res.json({ success: true, analysis, record });
  } catch (e) { fail(res, e.message, 503); }
};
export const startMockInterview = async (req, res) => {
  try {
    const { role = "Software Developer", skills = [], type = "mixed" } = req.body;
    const content = await askAI("Create realistic interview questions for a student. Return JSON array only. Include question and a short evaluation focus.", `Role: ${role}; interview type: ${type}; skills: ${JSON.stringify(skills)}. Generate 8 questions, mix technical, project and HR where relevant.`);
    const generated = safeJson(content);
    if (!Array.isArray(generated) || !generated.length) return fail(res, "Could not generate questions. Try again.", 502);
    const questions = generated.slice(0,12).map(item => typeof item === "string" ? { question: item, evaluationFocus: "Clarity, accuracy and examples" } : { question: String(item.question || item.prompt || "Explain your approach."), evaluationFocus: String(item.evaluationFocus || item.focus || "Clarity, accuracy and examples") });
    const record = await CareerRecord.create({ owner: req.id, kind: "mock-interview", title: `${role} practice`, payload: { role, type, questions, answers: [], completed: false } });
    res.status(201).json({ success: true, record });
  } catch (e) { fail(res, e.message, 503); }
};
export const submitMockInterview = async (req, res) => {
  try {
    const record = await CareerRecord.findOne({ _id: req.params.id, owner: req.id, kind: "mock-interview" });
    if (!record) return fail(res, "Interview session not found", 404);
    const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0,12) : [];
    if (!answers.length || answers.some(a => !String(a.answer || "").trim())) return fail(res, "Please answer each question before submitting", 400);
    const feedback = safeJson(await askAI("Evaluate a student's interview answers fairly. Return JSON with overallFeedback, strengths array, improvements array, and suggestedAnswers array. Be encouraging and specific.", JSON.stringify({ role: record.payload.role, questions: record.payload.questions, answers })));
    if (!feedback) return fail(res, "Could not evaluate the answers", 502);
    record.payload = { ...record.payload, answers, feedback, completed: true };
    await record.save(); res.json({ success: true, record });
  } catch (e) { fail(res, e.message, 503); }
};
export const generateRoadmap = async (req, res) => {
  try {
    const { targetRole, currentSkills = [], targetSkills = [] } = req.body;
    if (!targetRole) return fail(res, "Target role is required", 400);
    const result = safeJson(await askAI("Create a realistic skill-gap roadmap. Return JSON with gaps array and milestones array. Each milestone has title, tasks array, and suggestedResources array. Avoid invented URLs.", JSON.stringify({ targetRole, currentSkills, targetSkills })));
    if (!result) return fail(res, "Could not generate a roadmap", 502);
    const record = await CareerRecord.create({ owner: req.id, kind: "roadmap", title: `${targetRole} roadmap`, payload: { targetRole, ...result, completedMilestones: [] } });
    res.status(201).json({ success: true, record });
  } catch (e) { fail(res, e.message, 503); }
};

// Recruiter: applicant tools, interview scheduling, notes and screening questions.
export const addRecruiterNote = async (req, res) => {
  try {
    const app = await Application.findById(req.body.application).populate("job");
    if (!app || String(app.job.created_by) !== String(req.id)) return fail(res, "Application not found", 404);
    const note = await RecruiterNote.create({ recruiter: req.id, application: app._id, note: String(req.body.note || "").trim() });
    res.status(201).json({ success: true, note });
  } catch (e) { fail(res, e.message, 400); }
};
export const getRecruiterNotes = async (req, res) => { try { const apps = await Application.find({ job: { $in: await Job.find({ created_by: req.id }).distinct("_id") } }).distinct("_id"); res.json({ success: true, notes: await RecruiterNote.find({ recruiter: req.id, application: { $in: apps } }).populate({ path: "application", populate: { path: "job", select: "title" } }) }); } catch (e) { fail(res, e.message); } };
export const addScreeningQuestion = async (req, res) => {
  try { if (!(await ownsJob(req.body.job, req.id))) return fail(res, "Job not found", 404); const question = await ScreeningQuestion.create({ recruiter: req.id, job: req.body.job, question: req.body.question, type: req.body.type, options: req.body.options || [], required: Boolean(req.body.required) }); res.status(201).json({ success: true, question }); }
  catch (e) { fail(res, e.message, 400); }
};
export const getScreeningQuestions = async (req, res) => { try { if (!(await ownsJob(req.params.jobId, req.id))) return fail(res, "Job not found", 404); res.json({ success: true, questions: await ScreeningQuestion.find({ job: req.params.jobId, recruiter: req.id }) }); } catch (e) { fail(res, e.message); } };
export const bulkApplicationAction = async (req, res) => {
  try {
    const { applicationIds = [], status } = req.body;
    const allowed = ["shortlisted", "rejected", "assessment", "interview", "selected"];
    if (!Array.isArray(applicationIds) || !applicationIds.length || applicationIds.length > 100 || !allowed.includes(status)) return fail(res, "Choose applications and a valid status", 400);
    const jobs = await Job.find({ created_by: req.id }).distinct("_id");
    const filter = { _id: { $in: applicationIds }, job: { $in: jobs } };
    const matched = await Application.find(filter).populate("job", "title");
    const result = await Application.updateMany(filter, { $set: { status } });
    for (const application of matched) await notify(application.applicant, "Application status updated", `Your application for ${application.job?.title || "a job"} is now ${status}.`);
    res.json({ success: true, modified: result.modifiedCount });
  } catch (e) { fail(res, e.message, 400); }
};
export const scheduleInterview = async (req, res) => {
  try {
    const app = await Application.findById(req.body.application).populate("job");
    if (!app || String(app.job.created_by) !== String(req.id)) return fail(res, "Application not found", 404);
    const when = new Date(req.body.scheduledAt);
    if (!Number.isFinite(when.getTime()) || when <= new Date()) return fail(res, "Choose a future interview date", 400);
    const interview = await Interview.create({ job: app.job._id, application: app._id, recruiter: req.id, student: app.applicant, scheduledAt: when, mode: req.body.mode || "online", meetingLink: req.body.meetingLink || "", location: req.body.location || "" });
    app.interviewDate = when; app.interviewMode = interview.mode; app.meetingLink = interview.meetingLink; app.status = "interview"; await app.save();
    await notify(app.applicant, "Interview scheduled", `Your interview for ${app.job.title} is scheduled for ${when.toLocaleString()}.${interview.meetingLink ? ` Meeting link: ${interview.meetingLink}` : ""}`);
    res.status(201).json({ success: true, interview });
  } catch (e) { fail(res, e.message, 400); }
};
export const getInterviews = async (req, res) => { try { const filter = req.userRole === "Recruiter" ? { recruiter: req.id } : { student: req.id }; res.json({ success: true, interviews: await Interview.find(filter).populate("job", "title").populate("student", "fullname email").populate("recruiter", "fullname email").sort({ scheduledAt: 1 }) }); } catch (e) { fail(res, e.message); } };
export const saveInterviewFeedback = async (req, res) => { try { const interview = await Interview.findOne({ _id: req.params.id, recruiter: req.id }); if (!interview) return fail(res, "Interview not found", 404); interview.feedback = String(req.body.feedback || "").slice(0,4000); interview.rating = req.body.rating ? Number(req.body.rating) : undefined; interview.status = "completed"; await interview.save(); res.json({ success: true, interview }); } catch (e) { fail(res, e.message, 400); } };

// Search only people with a legitimate hiring relationship to the current user.
export const searchMessageRecipients = async (req, res) => {
  try {
    const term = String(req.query.search || "").trim().slice(0, 80);
    if (term.length < 2) return res.json({ success: true, recipients: [] });
    let allowedIds = [];
    if (req.userRole === "Recruiter") {
      const jobIds = await Job.find({ created_by: req.id }).distinct("_id");
      allowedIds = await Application.find({ job: { $in: jobIds } }).distinct("applicant");
    } else if (req.userRole === "Student") {
      const appliedJobIds = await Application.find({ applicant: req.id }).distinct("job");
      allowedIds = await Job.find({ _id: { $in: appliedJobIds } }).distinct("created_by");
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const recipients = await User.find({ _id: { $in: allowedIds, $ne: req.id }, $or: [{ fullname: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }] }).select("fullname email role profile.profilePhoto").limit(12);
    res.json({ success: true, recipients });
  } catch (e) { fail(res, "Could not search message recipients"); }
};

// Basic persisted messaging. Conversation membership is checked on every read/write.
export const startConversation = async (req, res) => {
  try {
    const otherId = req.body.userId;
    if (!validId(otherId) || String(otherId) === String(req.id)) return fail(res, "Choose a valid recipient", 400);
    const other = await User.findById(otherId).select("role"); if (!other) return fail(res, "Recipient not found", 404);
    if (!["Student", "Recruiter"].includes(req.userRole) || !["Student", "Recruiter"].includes(other.role) || other.role === req.userRole) return fail(res, "Messaging is available between students and recruiters only", 403);
    let related = false;
    if (req.userRole === "Recruiter") {
      const ownedJobs = await Job.find({ created_by: req.id }).distinct("_id");
      related = await Application.exists({ job: { $in: ownedJobs }, applicant: otherId });
    } else {
      const appliedJobs = await Application.find({ applicant: req.id }).distinct("job");
      related = await Job.exists({ _id: { $in: appliedJobs }, created_by: otherId });
    }
    if (!related) return fail(res, "You can message only students or recruiters connected through an application", 403);
    const participants = [req.id, otherId].sort();
    let conversation = await Conversation.findOne({ participants: { $all: participants }, $expr: { $eq: [{ $size: "$participants" }, 2] } });
    if (!conversation) conversation = await Conversation.create({ participants, job: req.body.job || undefined });
    res.status(200).json({ success: true, conversation });
  } catch (e) { fail(res, e.message, 400); }
};
export const getConversations = async (req, res) => { try { res.json({ success: true, conversations: await Conversation.find({ participants: req.id }).populate("participants", "fullname role profile.profilePhoto").sort({ lastMessageAt: -1 }) }); } catch (e) { fail(res, e.message); } };
export const getMessages = async (req, res) => { try { const c = await Conversation.findOne({ _id: req.params.id, participants: req.id }); if (!c) return fail(res, "Conversation not found", 404); const messages = await Message.find({ conversation: c._id }).populate("sender", "fullname").sort({ createdAt: 1 }).limit(500); await Message.updateMany({ conversation: c._id, sender: { $ne: req.id }, readAt: null }, { $set: { readAt: new Date() } }); res.json({ success: true, messages }); } catch (e) { fail(res, e.message); } };
export const sendMessage = async (req, res) => { try { const c = await Conversation.findOne({ _id: req.params.id, participants: req.id }); const text = String(req.body.text || "").trim(); if (!c) return fail(res, "Conversation not found", 404); if (!text || text.length > 4000) return fail(res, "Message must be between 1 and 4000 characters", 400); const message = await Message.create({ conversation: c._id, sender: req.id, text }); c.lastMessageAt = new Date(); await c.save(); const recipient = c.participants.find(id => String(id) !== String(req.id)); await notify(recipient, "New message", "You have received a new message.", "/messages"); res.status(201).json({ success: true, message }); } catch (e) { fail(res, e.message, 400); } };

export const studentAnalytics = async (req, res) => {
  try {
    const [apps, user, records, resumes] = await Promise.all([
      Application.find({ applicant: req.id }).populate("job", "title company"),
      User.findById(req.id).select("profile"),
      CareerRecord.find({ owner: req.id }),
      ResumeProfile.countDocuments({ owner: req.id }),
    ]);
    const total = apps.length; const count = status => apps.filter(a => a.status === status).length;
    const completedInterviews = records.filter(r => r.kind === "mock-interview" && r.payload?.completed).length;
    const prepDays = new Set(records.filter(r => r.kind === "prep-log").map(r => new Date(r.createdAt).toISOString().slice(0,10))).size;
    const parts = [];
    if (user?.profile?.resume || resumes > 0) parts.push({ label: "Resume", score: 100, weight: 20 });
    if ((user?.profile?.skills || []).length) parts.push({ label: "Skills", score: Math.min(100, Math.round((user.profile.skills.length / 8) * 100)), weight: 25 });
    if (records.some(r => r.kind === "mock-interview")) parts.push({ label: "Mock interview", score: Math.min(100, completedInterviews * 50), weight: 25 });
    if (records.some(r => r.kind === "prep-log")) parts.push({ label: "Preparation consistency", score: Math.min(100, prepDays * 10), weight: 10 });
    const assessment = records.filter(r => r.kind === "assessment").sort((a,b) => b.createdAt - a.createdAt)[0];
    if (assessment) parts.push({ label: "Self assessment", score: Math.max(0,Math.min(100,Number(assessment.payload?.score)||0)), weight: 20 });
    const availableWeight = parts.reduce((sum, p) => sum + p.weight, 0);
    const readiness = availableWeight ? Math.round(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / availableWeight) : null;
    res.json({ success: true, analytics: { total, shortlisted: count("shortlisted"), interviews: count("interview"), selected: count("selected"), rejected: count("rejected"), conversionRate: total ? Math.round((count("selected") / total) * 100) : 0, applications: apps, readiness, readinessBreakdown: parts, readinessNote: "Readiness is an indicative progress score. Categories without data are excluded, not counted as zero." } });
  }
  catch (e) { fail(res, e.message); }
};
export const recruiterAnalytics = async (req, res) => {
  try {
    const jobs = await Job.find({ created_by: req.id }).select("title applications views createdAt status");
    const ids = jobs.map(j => j._id); const apps = await Application.find({ job: { $in: ids } }).select("status createdAt source job");
    const stages = ["applied","shortlisted","assessment","interview","selected","rejected"];
    const monthly = {};
    for (const app of apps) { const key = `${app.createdAt.getFullYear()}-${String(app.createdAt.getMonth()+1).padStart(2,"0")}`; monthly[key] = (monthly[key]||0)+1; }
    const sources = {}; for (const app of apps) { const key = app.source || "unknown"; sources[key] = (sources[key]||0)+1; }
    const jobMetrics = jobs.map(job => ({ _id: job._id, title: job.title, views: job.views || 0, applications: apps.filter(a=>String(a.job)===String(job._id)).length, createdAt: job.createdAt, status: job.status }));
    res.json({ success: true, analytics: { jobs: jobMetrics, monthly: Object.entries(monthly).sort(([a],[b])=>a.localeCompare(b)).map(([month,count])=>({month,count})), sources, totalJobs: jobs.length, totalViews: jobs.reduce((n,j)=>n+j.views,0), totalApplications: apps.length, stages: Object.fromEntries(stages.map(s=>[s,apps.filter(a=>a.status===s).length])) } });
  }
  catch (e) { fail(res, e.message); }
};
export const reportContent = async (req, res) => { try { if (!validId(req.body.targetId)) return fail(res, "Invalid report target", 400); const report = await PlatformReport.create({ reporter: req.id, targetType: req.body.targetType, targetId: req.body.targetId, reason: String(req.body.reason || "").trim() }); res.status(201).json({ success: true, report }); } catch (e) { fail(res, e.message, 400); } };

// Admin-only endpoints. Admin accounts are provisioned via the seed script, never public registration.
export const adminOverview = async (req, res) => {
  try { const [users, recruiters, students, jobs, companies, reports, applications] = await Promise.all([User.countDocuments(),User.countDocuments({role:"Recruiter"}),User.countDocuments({role:"Student"}),Job.countDocuments(),Company.countDocuments(),PlatformReport.countDocuments({status:"open"}),Application.countDocuments()]); res.json({ success: true, overview: { users, recruiters, students, jobs, companies, openReports: reports, applications } }); }
  catch (e) { fail(res, e.message); }
};
export const adminUsers = async (req, res) => { try { const users = await User.find({ role: { $ne: "Admin" } }).select("fullname email role isVerified isSuspended createdAt").sort({ createdAt: -1 }).limit(300); res.json({ success: true, users }); } catch (e) { fail(res, e.message); } };
export const adminSetSuspension = async (req, res) => { try { const user = await User.findOneAndUpdate({ _id: req.params.id, role: { $ne: "Admin" } }, { isSuspended: Boolean(req.body.suspended) }, { new: true }).select("fullname email role isSuspended"); if (!user) return fail(res, "User not found", 404); await AdminLog.create({ admin: req.id, action: user.isSuspended ? "suspend-user" : "restore-user", targetType: "User", targetId: user._id }); res.json({ success: true, user }); } catch (e) { fail(res, e.message, 400); } };
export const adminCompanies = async (req, res) => { try { res.json({ success: true, companies: await Company.find().populate("userId", "fullname email").sort({ createdAt: -1 }) }); } catch (e) { fail(res, e.message); } };
export const adminVerifyCompany = async (req, res) => { try { const company = await Company.findByIdAndUpdate(req.params.id, { isVerified: Boolean(req.body.verified), verifiedAt: req.body.verified ? new Date() : null }, { new: true }); if (!company) return fail(res, "Company not found", 404); await AdminLog.create({ admin: req.id, action: company.isVerified ? "verify-company" : "unverify-company", targetType: "Company", targetId: company._id }); res.json({ success: true, company }); } catch (e) { fail(res, e.message, 400); } };
export const adminJobs = async (req, res) => { try { res.json({ success: true, jobs: await Job.find().populate("company", "name").populate("created_by", "fullname email").sort({ createdAt: -1 }).limit(500) }); } catch (e) { fail(res, e.message); } };
export const adminSetJobStatus = async (req, res) => { try { const status = req.body.status; if (!["published","pending_review","expired"].includes(status)) return fail(res, "Invalid job status", 400); const job = await Job.findByIdAndUpdate(req.params.id, { status }, { new: true }); if (!job) return fail(res, "Job not found", 404); await AdminLog.create({ admin: req.id, action: `job-${status}`, targetType: "Job", targetId: job._id }); res.json({ success: true, job }); } catch (e) { fail(res, e.message, 400); } };
export const adminReports = async (req, res) => { try { res.json({ success: true, reports: await PlatformReport.find().populate("reporter", "fullname email").sort({ createdAt: -1 }).limit(500) }); } catch (e) { fail(res, e.message); } };
export const adminUpdateReport = async (req, res) => { try { const status = req.body.status; if (!["reviewing","resolved","dismissed","open"].includes(status)) return fail(res, "Invalid report status", 400); const report = await PlatformReport.findByIdAndUpdate(req.params.id, { status, adminNote: String(req.body.adminNote || "").slice(0,2000) }, { new: true }); if (!report) return fail(res, "Report not found", 404); await AdminLog.create({ admin: req.id, action: `report-${status}`, targetType: "Report", targetId: report._id }); res.json({ success: true, report }); } catch (e) { fail(res, e.message, 400); } };
export const adminActivity = async (req, res) => { try { res.json({ success: true, activity: await AdminLog.find().populate("admin", "fullname email").sort({ createdAt: -1 }).limit(200) }); } catch (e) { fail(res, e.message); } };

const candidateFit = (application, job) => {
  const required = [...new Set((job.requirements || []).flatMap(item => String(item).split(/[;,\n]/)).map(x => x.trim().toLowerCase()).filter(x => x.length > 1))];
  const skills = (application.applicant?.profile?.skills || []).map(x => String(x).trim().toLowerCase());
  const matched = required.filter(r => skills.some(s => s === r || s.includes(r) || r.includes(s)));
  const missing = required.filter(r => !matched.includes(r));
  return { score: required.length ? Math.round(matched.length / required.length * 100) : null, matched, missing, reason: required.length ? `${matched.length} of ${required.length} listed skills matched` : "Job has no structured skill requirements" };
};
export const rankApplicants = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, created_by: req.id });
    if (!job) return fail(res, "Job not found", 404);
    const applications = await Application.find({ job: job._id }).populate("applicant", "fullname email profile createdAt").sort({ createdAt: -1 });
    const candidates = applications.map(application => ({ application, fit: candidateFit(application, job) }));
    const filtered = candidates.filter(({ application, fit }) => (!req.query.status || application.status === req.query.status) && (!req.query.skill || fit.matched.some(s => s.includes(String(req.query.skill).toLowerCase()))) && (!req.query.minScore || (fit.score || 0) >= Number(req.query.minScore)));
    filtered.sort((a,b) => (b.fit.score ?? -1) - (a.fit.score ?? -1));
    res.json({ success: true, job, candidates: filtered });
  } catch (e) { fail(res, e.message, 400); }
};
export const compareCandidates = async (req, res) => {
  try {
    const { applicationIds = [] } = req.body;
    if (!Array.isArray(applicationIds) || applicationIds.length < 2 || applicationIds.length > 3) return fail(res, "Select 2 or 3 candidates to compare", 400);
    const job = await Job.findOne({ _id: req.params.jobId, created_by: req.id });
    if (!job) return fail(res, "Job not found", 404);
    const applications = await Application.find({ _id: { $in: applicationIds }, job: job._id }).populate("applicant", "fullname email profile");
    if (applications.length !== applicationIds.length) return fail(res, "One or more candidates do not belong to this job", 400);
    res.json({ success: true, candidates: applications.map(application => ({ application, fit: candidateFit(application, job) })) });
  } catch (e) { fail(res, e.message, 400); }
};

export const getResumeProfiles = async (req, res) => { try { res.json({ success: true, resumes: await ResumeProfile.find({ owner: req.id }).sort({ isPrimary: -1, updatedAt: -1 }) }); } catch (e) { fail(res, e.message); } };
export const createResumeProfile = async (req, res) => {
  try {
    const { name, targetRole, url, isPrimary } = req.body;
    if (!name?.trim() || !url || !/^https:\/\//i.test(url)) return fail(res, "Enter a resume name and a secure HTTPS file URL", 400);
    const count = await ResumeProfile.countDocuments({ owner: req.id });
    const primary = Boolean(isPrimary) || count === 0;
    if (primary) await ResumeProfile.updateMany({ owner: req.id }, { $set: { isPrimary: false } });
    const resume = await ResumeProfile.create({ owner: req.id, name: name.trim().slice(0,100), targetRole: String(targetRole||"").slice(0,100), url, isPrimary: primary });
    res.status(201).json({ success: true, resume });
  } catch (e) { fail(res, e.message, 400); }
};
export const setPrimaryResume = async (req, res) => { try { const resume = await ResumeProfile.findOne({ _id: req.params.id, owner: req.id }); if (!resume) return fail(res, "Resume not found", 404); await ResumeProfile.updateMany({ owner: req.id }, { $set: { isPrimary: false } }); resume.isPrimary = true; await resume.save(); res.json({ success: true, resume }); } catch (e) { fail(res, e.message, 400); } };
export const deleteResumeProfile = async (req, res) => { try { const resume = await ResumeProfile.findOneAndDelete({ _id: req.params.id, owner: req.id }); if (!resume) return fail(res, "Resume not found", 404); if (resume.isPrimary) { const next = await ResumeProfile.findOne({ owner: req.id }).sort({ updatedAt: -1 }); if (next) { next.isPrimary = true; await next.save(); } } res.json({ success: true }); } catch (e) { fail(res, e.message, 400); } };
export const updateCareerRecord = async (req, res) => {
  try {
    const record = await CareerRecord.findOne({ _id: req.params.id, owner: req.id });
    if (!record) return fail(res, "Record not found", 404);
    if (record.kind === "prep-log" && typeof req.body.completed === "boolean") record.payload = { ...record.payload, completed: req.body.completed };
    if (typeof req.body.title === "string") record.title = req.body.title.slice(0,150);
    await record.save(); res.json({ success: true, record });
  } catch (e) { fail(res, e.message, 400); }
};
export const generateCompanyPrep = async (req, res) => {
  try {
    const { companyName, targetRole } = req.body;
    if (!companyName?.trim() || !targetRole?.trim()) return fail(res, "Company and target role are required", 400);
    const result = safeJson(await askAI("Create a company interview preparation guide. Return JSON with companyOverview (clearly mark uncertain/general information), preparationTopics array, eligibilityChecklist array, interviewRounds array, sampleQuestions array, and a 7-day plan array. Do not invent current hiring criteria, salaries, or exact interview processes. Remind the student to verify facts from official sources.", JSON.stringify({ companyName, targetRole })));
    if (!result) return fail(res, "Could not create a preparation guide", 502);
    const record = await CareerRecord.create({ owner: req.id, kind: "company-prep", title: `${companyName} · ${targetRole}`, payload: { companyName, targetRole, ...result, verificationNote: "Confirm eligibility, open roles and hiring rounds from the company's official careers page." } });
    res.status(201).json({ success: true, record });
  } catch (e) { fail(res, e.message, 503); }
};
export const saveSelfAssessment = async (req, res) => {
  try {
    const keys = ["technical", "communication", "projects", "problemSolving"];
    const values = keys.map(key => Number(req.body[key]));
    if (values.some(value => !Number.isInteger(value) || value < 1 || value > 5)) return fail(res, "Rate each area from 1 to 5", 400);
    const score = Math.round(values.reduce((sum,value)=>sum+value,0) / 20 * 100);
    const record = await CareerRecord.create({ owner: req.id, kind: "assessment", title: "Placement self-assessment", payload: { technical: values[0], communication: values[1], projects: values[2], problemSolving: values[3], score } });
    res.status(201).json({ success: true, record, score });
  } catch (e) { fail(res, e.message, 400); }
};

export const getPublicScreeningQuestions = async (req, res) => {
  try { const job = await Job.findOne({ _id: req.params.jobId, status: { $in: ["published", null] } }); if (!job) return fail(res, "Job not found", 404); const questions = await ScreeningQuestion.find({ job: job._id }).select("question type options required"); res.json({ success: true, questions }); } catch (e) { fail(res, e.message, 400); }
};
