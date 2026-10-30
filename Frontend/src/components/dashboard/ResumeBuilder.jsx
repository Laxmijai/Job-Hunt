import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Navbar from "../components_lite/Navbar";
import { FileText, Printer, Save } from "lucide-react";
import { toast } from "sonner";

const ResumeBuilder = () => {
  const { user } = useSelector((state) => state.auth);
  const [form, setForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem("jobhunt-resume-draft") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    if (!form.fullname && user) setForm({ fullname: user.fullname || "", email: user.email || "", phone: user.phoneNumber || "", summary: user.profile?.bio || "", skills: (user.profile?.skills || []).join(", "), education: "", projects: "", experience: "" });
  }, [user]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => { localStorage.setItem("jobhunt-resume-draft", JSON.stringify(form)); toast.success("Resume draft saved on this device"); };
  return <><Navbar/><main className="mx-auto max-w-6xl px-4 py-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-violet-600">Career tools</p><h1 className="mt-1 text-3xl font-bold dark:text-white">Resume builder</h1><p className="mt-2 text-sm text-slate-500">Create a clean, printable resume draft. Use your browser's Print → Save as PDF.</p></div><div className="flex gap-2"><button onClick={save} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold dark:border-slate-700 dark:text-white"><Save size={16}/> Save draft</button><button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white"><Printer size={16}/> Export PDF</button></div></div>
  <div className="grid gap-6 lg:grid-cols-2"><section className="space-y-4 rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">{[{key:"fullname",label:"Full name"},{key:"email",label:"Email"},{key:"phone",label:"Phone"},{key:"summary",label:"Professional summary",area:true},{key:"skills",label:"Skills (comma separated)",area:true},{key:"education",label:"Education",area:true},{key:"projects",label:"Projects",area:true},{key:"experience",label:"Experience / internships",area:true}].map((field) => <label key={field.key} className="block text-sm font-medium text-slate-700 dark:text-slate-200">{field.label}{field.area ? <textarea rows={field.key === "summary" ? 3 : 4} value={form[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"/> : <input value={form[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"/>}</label>)}</section>
  <section className="resume-print min-h-[700px] rounded-2xl border bg-white p-8 shadow-sm dark:border-slate-800"><div className="border-b-2 border-violet-700 pb-4"><h2 className="text-3xl font-bold text-slate-900">{form.fullname || "Your Name"}</h2><p className="mt-2 text-sm text-slate-600">{[form.email, form.phone].filter(Boolean).join(" · ")}</p></div>{[["Professional Summary",form.summary],["Skills",form.skills],["Education",form.education],["Projects",form.projects],["Experience",form.experience]].map(([heading, content]) => <div key={heading} className="mt-6"><h3 className="border-b border-slate-200 pb-1 text-sm font-bold uppercase tracking-wider text-violet-800">{heading}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{content || `Add your ${heading.toLowerCase()} details in the editor.`}</p></div>)}<p className="mt-8 text-xs text-slate-400">Review all details and links before submitting this resume.</p></section></div></main></>;
};
export default ResumeBuilder;
