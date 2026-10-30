import React, { useState } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import axios from "axios";
import { APPLICATION_API_ENDPOINT } from "@/utils/data";
import { setAllApplicants } from "@/redux/applicationSlice";

const workflow = ["applied", "shortlisted", "assessment", "interview", "selected", "rejected"];
const ApplicantsTable = () => {
  const { applicants } = useSelector((store) => store.application);
  const dispatch = useDispatch();
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const getDraft = (item) => ({ status: item.status === "pending" ? "applied" : item.status || "applied", interviewDate: item.interviewDate ? new Date(item.interviewDate).toISOString().slice(0,16) : "", interviewMode: item.interviewMode || "online", meetingLink: item.meetingLink || "", notes: item.notes || "", ...(drafts[item._id] || {}) });
  const changeDraft = (id, key, value) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));

  const saveUpdate = async (item) => {
    const draft = getDraft(item);
    setSavingId(item._id);
    try {
      const response = await axios.post(`${APPLICATION_API_ENDPOINT}/status/${item._id}/update`, { ...draft, interviewDate: draft.interviewDate || null }, { withCredentials: true });
      if (response.data.success) {
        const updated = { ...applicants, applications: applicants.applications.map((application) => application._id === item._id ? { ...application, ...draft, interviewDate: draft.interviewDate || null } : application) };
        dispatch(setAllApplicants(updated));
        toast.success("Applicant details updated");
      }
    } catch (error) { toast.error(error.response?.data?.message || "Could not update applicant"); }
    finally { setSavingId(null); }
  };

  return <Table>
    <TableCaption>Applicants and interview workflow for this job</TableCaption>
    <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Contact</TableHead><TableHead>Resume</TableHead><TableHead>Applied</TableHead><TableHead>Stage</TableHead><TableHead>Interview scheduling</TableHead><TableHead>Save</TableHead></TableRow></TableHeader>
    <TableBody>{applicants?.applications?.map((item) => { const draft = getDraft(item); return <TableRow key={item._id}>
      <TableCell><p className="font-semibold">{item.applicant?.fullname || "Candidate"}</p><p className="text-xs text-muted-foreground">{item.applicant?.email}</p></TableCell>
      <TableCell>{item.applicant?.phoneNumber || "—"}</TableCell>
      <TableCell>{item.applicant?.profile?.resume ? <a className="text-violet-700 underline" href={item.applicant.profile.resume} target="_blank" rel="noreferrer">View resume</a> : "Not provided"}</TableCell>
      <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</TableCell>
      <TableCell><select value={draft.status} onChange={(event) => changeDraft(item._id, "status", event.target.value)} className="rounded-md border bg-background px-2 py-1.5 text-xs"><option value="applied">Applied</option><option value="shortlisted">Shortlisted</option><option value="assessment">Assessment</option><option value="interview">Interview</option><option value="selected">Selected</option><option value="rejected">Rejected</option></select></TableCell>
      <TableCell><details className="min-w-52"><summary className="cursor-pointer text-sm font-medium text-violet-700">{item.interviewDate ? "Edit interview" : "Schedule interview"}</summary><div className="mt-2 space-y-2 rounded-lg border p-3 dark:border-slate-700"><label className="block text-xs">Date and time<input type="datetime-local" value={draft.interviewDate} onChange={(event) => changeDraft(item._id, "interviewDate", event.target.value)} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"/></label><label className="block text-xs">Interview type<select value={draft.interviewMode} onChange={(event) => changeDraft(item._id, "interviewMode", event.target.value)} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"><option value="online">Online</option><option value="offline">Offline</option></select></label><label className="block text-xs">Meeting link / location<input value={draft.meetingLink} onChange={(event) => changeDraft(item._id, "meetingLink", event.target.value)} placeholder="https://... or office address" className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"/></label><label className="block text-xs">Private recruiter notes<textarea value={draft.notes} onChange={(event) => changeDraft(item._id, "notes", event.target.value)} rows={2} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"/></label></div></details></TableCell>
      <TableCell><button disabled={savingId === item._id} onClick={() => saveUpdate(item)} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{savingId === item._id ? "Saving…" : "Save"}</button></TableCell>
    </TableRow>; })}</TableBody>
  </Table>;
};
export default ApplicantsTable;
