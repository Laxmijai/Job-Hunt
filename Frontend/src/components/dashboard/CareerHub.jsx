import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import Navbar from "../components_lite/Navbar";
import { APPLICATION_API_ENDPOINT, JOB_API_ENDPOINT, WORKSPACE_API_ENDPOINT } from "@/utils/data";
import { BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, Lightbulb, Target, TrendingUp, WandSparkles, Users } from "lucide-react";
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
  const [recruiterAnalytics, setRecruiterAnalytics] = useState(null);
  const [insightJob, setInsightJob] = useState("all");
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
          const [response, insightResponse] = await Promise.all([
            axios.get(`${JOB_API_ENDPOINT}/getadminjobs`, { withCredentials: true }),
            axios.get(`${WORKSPACE_API_ENDPOINT}/analytics/recruiter`, { withCredentials: true }),
          ]);
          if (alive) { setAdminJobs(response.data.jobs || []); setRecruiterAnalytics(insightResponse.data.analytics || null); }
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

  if (user?.role === "Recruiter") {
    const reportJobs = recruiterAnalytics?.jobs || [];
    const selectedMetrics = insightJob === "all" ? null : reportJobs.find(job => String(job._id) === insightJob);
    const totals = selectedMetrics ? { views: selectedMetrics.views, applications: selectedMetrics.applications, stages: selectedMetrics.stages || {}, applyRate: selectedMetrics.applyRate } : { views: recruiterAnalytics?.totalViews || 0, applications: recruiterAnalytics?.totalApplications || 0, stages: recruiterAnalytics?.stages || {}, applyRate: recruiterAnalytics?.totalViews ? Math.round((recruiterAnalytics.totalApplications / recruiterAnalytics.totalViews) * 1000) / 10 : 0 };
    const pipeline = stages.map(stage => ({ stage, count: totals.stages?.[stage] || 0 }));
    const maxPipeline = Math.max(1, ...pipeline.map(item => item.count));
    const exportInsights = () => { const rows = [["Job","Status","Views","Applications","Application rate (%)"], ...reportJobs.map(job => [job.title,job.status,job.views,job.applications,job.applyRate])]; const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); const link=document.createElement("a"); link.href=url; link.download="hiring-insights.csv"; link.click(); URL.revokeObjectURL(url); };
    return <><Navbar/><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-700">Recruiter intelligence</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Hiring Insights</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Understand what is working across your roles, where candidates are progressing and where your hiring funnel needs attention.</p></div><div className="flex flex-wrap gap-2"><button onClick={exportInsights} className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-slate-700 dark:text-white">Export report</button><button onClick={() => navigate("/recruiter/tools")} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white">Open recruiter workspace</button></div></header>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900 dark:text-white">Report scope</h2><p className="mt-1 text-xs text-slate-500">Choose whether to view your full hiring portfolio or one role.</p></div><select value={insightJob} onChange={e=>setInsightJob(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="all">All jobs</option>{reportJobs.map(job=><option key={job._id} value={job._id}>{job.title}</option>)}</select></div></section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={BriefcaseBusiness} label="Job listings" value={selectedMetrics ? 1 : recruiterAnalytics?.totalJobs || 0} hint={selectedMetrics ? selectedMetrics.status : `${recruiterAnalytics?.activeJobs || 0} currently published`}/><Metric icon={TrendingUp} label="Job views" value={totals.views} hint="Views recorded on selected listings"/><Metric icon={Users} label="Applications" value={totals.applications} hint="Submitted applications"/><Metric icon={Target} label="View-to-apply rate" value={`${totals.applyRate}%`} hint="Applications divided by recorded views"/></div>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><Panel><div className="mb-4 flex items-start justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">Hiring funnel</h2><p className="mt-1 text-xs text-slate-500">How applicants are distributed across each stage</p></div><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">{totals.applications} total</span></div><div className="space-y-4">{pipeline.map(({stage,count})=><div key={stage}><div className="mb-1.5 flex justify-between text-sm"><span className="capitalize text-slate-600 dark:text-slate-300">{stage}</span><b className="text-slate-900 dark:text-white">{count}</b></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-violet-600 transition-all" style={{width:`${(count/maxPipeline)*100}%`}}/></div></div>)}</div>{!totals.applications&&<p className="mt-4 text-xs text-slate-500">The funnel will populate when students apply to your jobs.</p>}</Panel><Panel><h2 className="font-bold text-slate-900 dark:text-white">Hiring signals</h2><p className="mt-1 text-xs text-slate-500">Quick indicators from the selected scope</p><div className="mt-4 space-y-3"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Shortlisted candidates</p><p className="mt-1 text-2xl font-bold dark:text-white">{totals.stages.shortlisted||0}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Interviews in pipeline</p><p className="mt-1 text-2xl font-bold dark:text-white">{totals.stages.interview||0}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Selected candidates</p><p className="mt-1 text-2xl font-bold dark:text-white">{totals.stages.selected||0}</p></div></div><p className="mt-3 text-xs text-slate-500">Use the funnel to spot stages where candidates may be getting stuck. Counts are current pipeline totals, not a historical cohort conversion.</p></Panel></div>
      <Panel><div className="mb-4"><h2 className="font-bold text-slate-900 dark:text-white">Job performance comparison</h2><p className="mt-1 text-xs text-slate-500">Compare visibility and applicant interest across your listings.</p></div>{reportJobs.length?<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Job listing","Status","Views","Applications","Apply rate"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{reportJobs.filter(job=>insightJob==="all"||String(job._id)===insightJob).map(job=><tr key={job._id} className="border-b border-slate-100 dark:border-slate-800"><td className="px-3 py-3 font-semibold dark:text-white">{job.title}</td><td className="px-3 py-3 capitalize text-slate-500">{job.status||"published"}</td><td className="px-3 py-3">{job.views}</td><td className="px-3 py-3">{job.applications}</td><td className="px-3 py-3 font-semibold text-violet-700">{job.applyRate}%</td></tr>)}</tbody></table></div>:<p className="py-8 text-center text-sm text-slate-500">No job performance data yet. Publish a role to start collecting insights.</p>}</Panel>
      <div className="grid gap-5 lg:grid-cols-2"><Panel><h2 className="font-bold text-slate-900 dark:text-white">Application trend</h2><p className="mt-1 text-xs text-slate-500">Monthly application volume across all your jobs</p><div className="mt-4 space-y-3">{(recruiterAnalytics?.monthly||[]).slice(-6).map(item=><div key={item.month} className="flex items-center gap-3"><span className="w-20 text-xs text-slate-500">{item.month}</span><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-violet-600" style={{width:`${(item.count/Math.max(1,...(recruiterAnalytics?.monthly||[]).map(x=>x.count)))*100}%`}}/></div><b className="w-8 text-right text-sm dark:text-white">{item.count}</b></div>)}{!(recruiterAnalytics?.monthly||[]).length&&<p className="text-sm text-slate-500">Monthly trends appear after applications are received.</p>}</div></Panel><Panel><h2 className="font-bold text-slate-900 dark:text-white">Application sources</h2><p className="mt-1 text-xs text-slate-500">Where candidates discovered your jobs</p><div className="mt-4 space-y-3">{Object.entries(recruiterAnalytics?.sources||{}).sort((a,b)=>b[1]-a[1]).map(([source,count])=><div key={source} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"><span className="capitalize text-slate-600 dark:text-slate-300">{source.replaceAll("-"," ")}</span><b className="dark:text-white">{count}</b></div>)}{!Object.keys(recruiterAnalytics?.sources||{}).length&&<p className="text-sm text-slate-500">Source attribution will appear as applications are submitted.</p>}</div></Panel></div>
      <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/20"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-bold text-slate-900 dark:text-white">Turn insights into action</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Review candidates, move applications through stages and schedule interviews from one workspace.</p></div><button onClick={()=>navigate("/recruiter/tools")} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white">Manage hiring pipeline</button></div></div>
    </main></>;
  }

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
