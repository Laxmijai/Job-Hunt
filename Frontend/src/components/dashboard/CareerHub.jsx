import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import Navbar from "../components_lite/Navbar";
import { APPLICATION_API_ENDPOINT, JOB_API_ENDPOINT } from "@/utils/data";
import { BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, Lightbulb, Target, TrendingUp, WandSparkles } from "lucide-react";
import useGetAllJobs from "@/hooks/useGetAllJobs";

const stages = ["applied", "shortlisted", "assessment", "interview", "selected", "rejected"];
const normalizeStatus = (status = "pending") => ({ pending: "applied", accepted: "selected" }[status] || status);
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const Panel = ({ children, className = "" }) => <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</section>;
const Metric = ({ icon: Icon, label, value, hint }) => <Panel><div className="flex items-center justify-between"><span className="text-sm text-slate-500 dark:text-slate-400">{label}</span><span className="rounded-xl bg-violet-50 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Icon size={19}/></span></div><p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</Panel>;

const CareerHub = () => {
  const { user } = useSelector((state) => state.auth);
  const { allJobs } = useSelector((state) => state.jobs);
  const navigate = useNavigate();
  useGetAllJobs();
  const [applications, setApplications] = useState([]);
  const [adminJobs, setAdminJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [savedAlert, setSavedAlert] = useState(() => localStorage.getItem("jobhunt-saved-alert") || "");
  const [alertInput, setAlertInput] = useState(savedAlert);
  const [aiMatch, setAiMatch] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user.role === "Student") {
          const response = await axios.get(`${APPLICATION_API_ENDPOINT}/get`, { withCredentials: true });
          if (alive) setApplications(response.data.application || []);
        } else {
          const response = await axios.get(`${JOB_API_ENDPOINT}/getadminjobs`, { withCredentials: true });
          if (alive) setAdminJobs(response.data.jobs || []);
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to load your career dashboard");
      } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [user?._id, user?.role, navigate]);

  const jobs = allJobs || [];
  const selectedJob = jobs.find((job) => job._id === selectedJobId) || jobs[0];
  const match = useMemo(() => {
    if (!selectedJob) return { score: 0, matched: [], missing: [] };
    const profileSkills = (user?.profile?.skills || []).map((skill) => skill.trim().toLowerCase()).filter(Boolean);
    const requirements = (selectedJob.requirements || []).flatMap((item) => String(item).split(/[,\n]/)).map((item) => item.trim()).filter(Boolean);
    const fallback = String(selectedJob.description || "").match(/\b(react|javascript|typescript|html|css|node\.?js|express|mongodb|sql|python|java|git|redux|tailwind|rest api|testing)\b/gi) || [];
    const expected = [...new Set((requirements.length ? requirements : fallback).map((skill) => skill.toLowerCase()))];
    const matched = expected.filter((skill) => profileSkills.some((candidate) => candidate.includes(skill) || skill.includes(candidate)));
    const missing = expected.filter((skill) => !matched.includes(skill));
    return { score: expected.length ? Math.round((matched.length / expected.length) * 100) : 0, matched, missing };
  }, [selectedJob, user?.profile?.skills]);

  const questionSet = useMemo(() => {
    if (!selectedJob) return [];
    const role = selectedJob.title || "this role";
    const skillQuestions = (user?.profile?.skills || []).slice(0, 5).map((skill) => `Explain a project where you used ${skill}. What challenges did you solve?`);
    return [
      `Walk me through your experience and why you are interested in ${role}.`,
      `What are the most important technical skills for succeeding as a ${role}?`,
      `Describe a difficult bug you faced and how you debugged it.`,
      ...skillQuestions,
      `How would you approach a task when the requirements for ${role} are unclear?`,
      "Tell me about a time you received feedback and changed your implementation."
    ];
  }, [selectedJob, user?.profile?.skills]);

  const personalizedJobs = useMemo(() => {
    const skills = (user?.profile?.skills || []).map((skill) => skill.toLowerCase());
    return jobs.map((job) => {
      const requirements = (job.requirements || []).map((item) => String(item).toLowerCase());
      const overlap = requirements.filter((requirement) => skills.some((skill) => requirement.includes(skill) || skill.includes(requirement)));
      return { ...job, profileMatch: requirements.length ? Math.round((overlap.length / requirements.length) * 100) : 0 };
    }).sort((a, b) => b.profileMatch - a.profileMatch).slice(0, 3);
  }, [jobs, user?.profile?.skills]);

  const counts = useMemo(() => stages.reduce((result, stage) => {
    result[stage] = applications.filter((application) => normalizeStatus(application.status) === stage).length;
    return result;
  }, {}), [applications]);
  const upcomingInterviews = applications.filter((item) => item.interviewDate && new Date(item.interviewDate) >= new Date()).sort((a,b) => new Date(a.interviewDate)-new Date(b.interviewDate));

  const analyzeWithAI = async () => {
    if (!selectedJob) return;
    setMatchLoading(true);
    try {
      const response = await axios.get(`${JOB_API_ENDPOINT}/match/${selectedJob._id}`, { withCredentials: true });
      if (response.data.success) { setAiMatch(response.data.match); toast.success(response.data.match.source === "ai" ? "AI match analysis ready" : "Profile-based match analysis ready"); }
    } catch (error) { toast.error(error.response?.data?.message || "Could not analyze this job"); }
    finally { setMatchLoading(false); }
  };

  const saveAlert = (event) => {
    event.preventDefault();
    const value = alertInput.trim();
    if (!value) { toast.error("Enter a role, skill or location to save a search"); return; }
    localStorage.setItem("jobhunt-saved-alert", value);
    setSavedAlert(value);
    toast.success("Search preference saved on this device");
  };

  const totalApplicants = adminJobs.reduce((sum, job) => sum + (job.applications?.length || 0), 0);
  const maxApplicants = Math.max(1, ...adminJobs.map((job) => job.applications?.length || 0));

  if (loading) return <><Navbar/><main className="mx-auto max-w-7xl p-8"><div className="h-8 w-64 animate-pulse rounded bg-slate-200"/><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="h-28 animate-pulse rounded-xl bg-slate-100"/><div className="h-28 animate-pulse rounded-xl bg-slate-100"/><div className="h-28 animate-pulse rounded-xl bg-slate-100"/></div></main></>;

  if (user?.role === "Recruiter") return <><Navbar/><main className="mx-auto max-w-7xl space-y-7 px-4 py-8 md:px-8"><div><p className="text-sm font-semibold uppercase tracking-wider text-violet-600">Recruiter workspace</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Hiring insights</h1><p className="mt-2 text-slate-500">A snapshot of the jobs and applicant activity managed by your account.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Metric icon={BriefcaseBusiness} label="Active job listings" value={adminJobs.length}/><Metric icon={TrendingUp} label="Applications received" value={totalApplicants}/><Metric icon={CheckCircle2} label="Jobs with applicants" value={adminJobs.filter((job) => (job.applications?.length || 0) > 0).length}/></div>
    <Panel><div className="mb-5 flex items-center gap-2"><BarChart3 className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Applications by job</h2></div>{adminJobs.length === 0 ? <p className="text-sm text-slate-500">You haven't posted any jobs yet.</p> : <div className="space-y-4">{adminJobs.map((job) => <div key={job._id}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium dark:text-slate-200">{job.title}</span><span className="text-slate-500">{job.applications?.length || 0}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-orange-400" style={{ width: `${((job.applications?.length || 0) / maxApplicants) * 100}%` }}/></div></div>)}</div>}</Panel>
    <div className="flex flex-wrap gap-3"><button onClick={() => navigate("/admin/jobs")} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800">Manage jobs</button><button onClick={() => navigate("/admin/companies")} className="rounded-xl border px-5 py-3 font-semibold dark:border-slate-700 dark:text-white">Manage companies</button></div>
  </main></>;

  return <><Navbar/><main className="mx-auto max-w-7xl space-y-7 px-4 py-8 md:px-8"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-wider text-violet-600">Your career workspace</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Career Hub</h1><p className="mt-2 text-slate-500">Track applications, understand your fit and prepare for interviews.</p></div><button onClick={() => navigate("/Jobs")} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800">Explore jobs</button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={BriefcaseBusiness} label="Applications" value={applications.length}/><Metric icon={Target} label="Shortlisted" value={counts.shortlisted + counts.interview}/><Metric icon={CalendarDays} label="Upcoming interviews" value={upcomingInterviews.length}/><Metric icon={CheckCircle2} label="Selected" value={counts.selected}/></div>
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"><Panel><div className="mb-4 flex items-center gap-2"><BarChart3 className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Application pipeline</h2></div><div className="grid gap-3 sm:grid-cols-3">{stages.map((stage) => { const items = applications.filter((item) => normalizeStatus(item.status) === stage); return <div key={stage} className="min-h-32 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold dark:text-slate-200">{titleCase(stage)}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs dark:bg-slate-700 dark:text-white">{items.length}</span></div>{items.slice(0,3).map((item) => <div key={item._id} className="mb-2 rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold dark:text-white">{item.job?.title || "Job listing"}</p><p className="mt-1 text-slate-500">{item.job?.company?.name || "Company"}</p></div>)}{items.length === 0 && <p className="text-xs text-slate-400">No applications yet</p>}</div>; })}</div></Panel>
      <Panel><div className="mb-4 flex items-center gap-2"><WandSparkles className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Smart job match</h2></div><label className="mb-2 block text-sm text-slate-600 dark:text-slate-300">Choose a job to compare with your profile</label><select value={selectedJob?._id || ""} onChange={(event) => setSelectedJobId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Select a job</option>{jobs.map((job) => <option key={job._id} value={job._id}>{job.title}</option>)}</select>{selectedJob ? <><div className="my-5 flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-violet-500 text-xl font-bold text-violet-700 dark:text-violet-300">{match.score}%</div><div><p className="font-semibold dark:text-white">Estimated skill match</p><p className="text-xs text-slate-500">Based on profile skills and job requirements</p></div></div><button onClick={analyzeWithAI} disabled={matchLoading} className="mb-4 w-full rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{matchLoading ? "Analyzing…" : "Analyze match with AI"}</button>{aiMatch && aiMatch.source && <div className="mb-4 rounded-lg bg-violet-50 p-3 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-100"><p className="font-semibold">{aiMatch.score}% {aiMatch.source === "ai" ? "AI-assisted" : "profile-based"} match</p><p className="mt-1">{aiMatch.summary}</p></div>}<p className="mb-2 text-xs font-bold uppercase text-emerald-700">Matching skills</p><div className="flex flex-wrap gap-1.5">{match.matched.length ? match.matched.map((skill) => <span key={skill} className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{skill}</span>) : <span className="text-xs text-slate-500">Add skills to your profile to improve this analysis.</span>}</div><p className="mb-2 mt-4 text-xs font-bold uppercase text-orange-700">Skills to develop</p><div className="flex flex-wrap gap-1.5">{match.missing.length ? match.missing.map((skill) => <span key={skill} className="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">{skill}</span>) : <span className="text-xs text-slate-500">No missing listed skills detected.</span>}</div></> : <p className="mt-4 text-sm text-slate-500">Browse jobs to enable your match analysis.</p>}</Panel></div>
    <Panel><div className="mb-4 flex items-center gap-2"><WandSparkles className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Recommended for your profile</h2></div>{personalizedJobs.length ? <div className="grid gap-3 md:grid-cols-3">{personalizedJobs.map((job) => <button key={job._id} onClick={() => navigate(`/description/${job._id}`)} className="rounded-xl border p-4 text-left transition hover:border-violet-400 dark:border-slate-700"><p className="font-semibold dark:text-white">{job.title}</p><p className="mt-1 text-xs text-slate-500">{job.company?.name || "Company"} · {job.location}</p><p className="mt-3 text-sm font-bold text-violet-700">{job.profileMatch}% profile skill overlap</p></button>)}</div> : <p className="text-sm text-slate-500">Add skills to your profile and browse available jobs to get recommendations.</p>}</Panel>
    <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="mb-4 flex items-center gap-2"><Lightbulb className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Interview practice</h2></div><p className="mb-3 text-sm text-slate-500">Practice questions tailored to {selectedJob?.title || "your target role"}.</p><ol className="list-decimal space-y-2 pl-5 text-sm dark:text-slate-200">{questionSet.slice(0,7).map((question, index) => <li key={index}>{question}</li>)}</ol>{!selectedJob && <p className="mt-3 text-xs text-slate-500">Select a job above to tailor questions to its role.</p>}</Panel>
      <div className="space-y-6"><Panel><div className="mb-3 flex items-center gap-2"><CalendarDays className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Interview schedule</h2></div>{upcomingInterviews.length ? <div className="space-y-3">{upcomingInterviews.map((item) => <div key={item._id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="font-semibold dark:text-white">{item.job?.title}</p><p className="text-sm text-slate-500">{new Date(item.interviewDate).toLocaleString()} · {item.interviewMode || "Details pending"}</p>{item.meetingLink && <a className="text-sm text-violet-700 underline" href={item.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a>}</div>)}</div> : <p className="text-sm text-slate-500">No interviews scheduled yet. Recruiter-scheduled interviews will appear here.</p>}</Panel>
      <Panel><div className="mb-3 flex items-center gap-2"><Target className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Saved job alert</h2></div><p className="mb-3 text-sm text-slate-500">Save a search phrase on this device for quick reuse. This is a local preference, not an automatic email alert.</p><form onSubmit={saveAlert} className="flex gap-2"><input value={alertInput} onChange={(event) => setAlertInput(event.target.value)} placeholder="e.g. React fresher remote" className="min-w-0 flex-1 rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"/><button className="rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white">Save</button></form>{savedAlert && <p className="mt-2 text-xs text-emerald-700">Saved search: {savedAlert}</p>}</Panel></div></div>
    <Panel><div className="mb-3 flex items-center gap-2"><FileText className="text-violet-600"/><h2 className="text-lg font-bold dark:text-white">Resume quick view</h2></div><p className="text-sm text-slate-500">Your profile currently lists {user?.profile?.skills?.length || 0} skills and {user?.profile?.resume ? "a resume link" : "no resume link"}. Keep your profile updated before applying.</p><div className="mt-4 flex flex-wrap gap-3">{user?.profile?.resume && <a href={user.profile.resume} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm font-semibold text-violet-700 dark:border-slate-700">View uploaded resume</a>}<button onClick={() => navigate("/Profile")} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-slate-700 dark:text-white">Update profile</button><button onClick={() => navigate("/resume-builder")} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Open resume builder</button></div></Panel>
  </main></>;
};
export default CareerHub;
