import { Job } from "../models/job.model.js";
import { Company } from "../models/company.model.js";
import askAI from "../utils/aiClient.js";
import { notifyMatchingStudents } from "../utils/jobAlerts.js";
//Admin job posting
export const postJob = async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      salary,
      location,
      jobType,
      experience,
      position,
      companyId,
    } = req.body;
    const userId = req.id;

    if (!title?.trim() || !description?.trim() || !salary || !location?.trim() || !jobType || experience === undefined || experience === null || Number(experience) < 0 || !position || Number(position) < 1 || !companyId) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }
    const company = await Company.findOne({ _id: companyId, userId });
    if (!company) return res.status(403).json({ message: "Choose a company registered under your account", success: false });
    const job = await Job.create({
      title: title.trim(),
      description: description.trim(),
      requirements: Array.isArray(requirements) ? requirements : String(requirements).split(",").map(item => item.trim()).filter(Boolean),
      salary: String(salary),
      location,
      jobType,
      experienceLevel: Number(experience),
      position: Number(position),
      company: companyId,
      created_by: userId,
    });
    await notifyMatchingStudents(job);
    res.status(201).json({
      message: "Job posted successfully.",
      job,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error", status: false });
  }
};

//Users
export const getAllJobs = async (req, res) => {
  try {
    const { keyword = "", location = "", type = "", sort = "latest", experience = "" } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filters = [];
    if (keyword.trim()) {
      const expression = new RegExp(escapeRegex(keyword.trim()), "i");
      filters.push({ $or: [{ title: expression }, { description: expression }, { requirements: expression }] });
    }
    if (location.trim()) filters.push({ location: new RegExp(escapeRegex(location.trim()), "i") });
    if (type.trim()) filters.push({ jobType: new RegExp(`^${escapeRegex(type.trim())}$`, "i") });
    if (experience !== "" && Number.isFinite(Number(experience))) filters.push({ experienceLevel: { $lte: Number(experience) } });
    filters.push({ status: { $in: ["published", null] } });
    filters.push({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    const query = { $and: filters };
    const total = await Job.countDocuments(query);
    let jobs;
    if (sort === "salary") {
      const allMatchingJobs = await Job.find(query).populate("company");
      allMatchingJobs.sort((a, b) => Number.parseFloat(String(b.salary).replace(/[^0-9.]/g, "")) - Number.parseFloat(String(a.salary).replace(/[^0-9.]/g, "")));
      jobs = allMatchingJobs.slice((page - 1) * limit, page * limit);
    } else {
      const sortOption = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
      jobs = await Job.find(query).populate("company").sort(sortOption).skip((page - 1) * limit).limit(limit);
    }
    return res.status(200).json({ jobs, status: true, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error", status: false });
  }
};

//Users
export const getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findOneAndUpdate({ _id: jobId, status: { $in: ["published", null] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }, { $inc: { views: 1 } }, { new: true }).populate("company", "name logo userId website location").populate({
      path: "applications",
    });
    if (!job) {
      return res.status(404).json({ message: "Job not found", status: false });
    }
    return res.status(200).json({ job, status: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error", status: false });
  }
};

// AI based "related jobs" recommendation for a single job.
export const getRecommendedJobs = async (req, res) => {
  try {
    const jobId = req.params.id;

    const currentJob = await Job.findOne({ _id: jobId, status: { $in: ["published", null] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).populate("company");
    if (!currentJob) {
      return res.status(404).json({ message: "Job not found", status: false });
    }

    // all other jobs are the candidates we can recommend from
    // keep this small so the AI prompt stays light and responds fast
    const candidates = await Job.find({ _id: { $ne: jobId }, status: { $in: ["published", null] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
      .populate("company")
      .sort({ createdAt: -1 })
      .limit(12);

    if (candidates.length === 0) {
      return res.status(200).json({ jobs: [], status: true });
    }

    // keep the prompt small - only send what the AI needs to compare
    const candidateList = candidates.map((job) => ({
      id: job._id.toString(),
      title: job.title,
      location: job.location,
      jobType: job.jobType,
      salary: job.salary,
      experienceLevel: job.experienceLevel,
      requirements: job.requirements,
    }));

    let recommendedIds = [];

    try {
      const systemPrompt =
        "You are a job recommendation engine. From the candidate jobs, pick the ones most related to the target job (similar role, skills, location or type). Reply ONLY with a JSON array of the matching candidate ids, ordered best first. No extra text.";

      const userPrompt = `Target job:\n${JSON.stringify({
        title: currentJob.title,
        location: currentJob.location,
        jobType: currentJob.jobType,
        salary: currentJob.salary,
        experienceLevel: currentJob.experienceLevel,
        requirements: currentJob.requirements,
      })}\n\nCandidate jobs:\n${JSON.stringify(candidateList)}`;

      const aiText = await askAI(systemPrompt, userPrompt);

      // the model should return a JSON array, but be safe and pull it out
      const match = aiText.match(/\[[\s\S]*\]/);
      if (match) {
        recommendedIds = JSON.parse(match[0]);
      }
    } catch (aiError) {
      console.error("AI recommendation failed, using fallback:", aiError.message);
    }

    let recommendedJobs = [];

    if (recommendedIds.length > 0) {
      // keep only valid ids and preserve the AI order
      const candidateMap = new Map(
        candidates.map((job) => [job._id.toString(), job])
      );
      recommendedJobs = recommendedIds
        .map((id) => candidateMap.get(id))
        .filter(Boolean);
    }

    // fallback - if AI gave nothing useful, match by jobType / location
    if (recommendedJobs.length === 0) {
      recommendedJobs = candidates.filter(
        (job) =>
          job.jobType === currentJob.jobType ||
          job.location === currentJob.location
      );
      if (recommendedJobs.length === 0) {
        recommendedJobs = candidates;
      }
    }

    return res.status(200).json({
      jobs: recommendedJobs.slice(0, 6),
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error", status: false });
  }
};

//Admin job created

export const getAdminJobs = async (req, res) => {
  try {
    const adminId = req.id;
    const jobs = await Job.find({ created_by: adminId }).populate({
      path: "company",
      sort: { createdAt: -1 },
    });
    if (!jobs) {
      return res.status(404).json({ message: "No jobs found", status: false });
    }
    return res.status(200).json({ jobs, status: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error", status: false });
  }
};

// Compare a student's saved profile skills with one job. AI is optional; a transparent
// deterministic fallback keeps the feature usable when AI credentials are not configured.
export const analyzeJobMatch = async (req, res) => {
  try {
    const { User } = await import("../models/user.model.js");
    const [user, job] = await Promise.all([
      User.findById(req.id).select("fullname profile role"),
      Job.findOne({ _id: req.params.id, status: { $in: ["published", null] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
    ]);
    if (!user || user.role !== "Student") return res.status(403).json({ success: false, message: "Only students can analyze job matches" });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    const skills = (user.profile?.skills || []).map((item) => String(item).trim()).filter(Boolean);
    const requirements = (job.requirements || []).map((item) => String(item).trim()).filter(Boolean);
    const fallbackMatched = requirements.filter((requirement) => skills.some((skill) => skill.toLowerCase().includes(requirement.toLowerCase()) || requirement.toLowerCase().includes(skill.toLowerCase())));
    const fallbackMissing = requirements.filter((requirement) => !fallbackMatched.includes(requirement));
    let result = {
      score: requirements.length ? Math.round((fallbackMatched.length / requirements.length) * 100) : 0,
      matchedSkills: fallbackMatched,
      missingSkills: fallbackMissing,
      summary: "This estimate compares the skills saved in your Job Hunt profile with the job's listed requirements. Add more profile skills for a more useful comparison.",
      source: "profile-based-fallback",
    };
    try {
      const prompt = "Assess candidate-job skill fit. Return ONLY valid JSON with keys score (integer 0-100), matchedSkills (array of strings), missingSkills (array of strings), summary (one short sentence). Do not infer experience or qualifications not supplied.";
      const response = await askAI(prompt, JSON.stringify({ candidateSkills: skills, job: { title: job.title, description: job.description, requirements } }));
      const json = response.match(/\{[\s\S]*\}/)?.[0];
      if (json) {
        const parsed = JSON.parse(json);
        if (Number.isFinite(Number(parsed.score))) result = { score: Math.max(0, Math.min(100, Math.round(Number(parsed.score)))), matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : fallbackMatched, missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : fallbackMissing, summary: String(parsed.summary || result.summary), source: "ai" };
      }
    } catch (aiError) { console.warn("AI match analysis unavailable; using profile-based fallback:", aiError.message); }
    return res.status(200).json({ success: true, match: result });
  } catch (error) {
    console.error("analyzeJobMatch:", error);
    return res.status(500).json({ success: false, message: "Could not analyze this job match" });
  }
};
