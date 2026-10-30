import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { JOB_API_ENDPOINT, APPLICATION_API_ENDPOINT, WORKSPACE_API_ENDPOINT } from "@/utils/data";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { setSingleJob } from "@/redux/jobSlice";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import RecommendedJobs from "./RecommendedJobs";

const Description = () => {
  const navigate = useNavigate();
  const params = useParams();
  const jobId = params.id;

  const { singleJob } = useSelector((store) => store.job);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resumeProfiles, setResumeProfiles] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [screeningQuestions, setScreeningQuestions] = useState([]);
  const [screeningAnswers, setScreeningAnswers] = useState({});
  const { user } = useSelector((store) => store.auth);

  const isIntiallyApplied =
    singleJob?.application?.some(
      (application) => application.applicant === user?._id
    ) || false;
  const [isApplied, setIsApplied] = useState(isIntiallyApplied);

  const contactRecruiter = async () => {
    if (!user) { navigate("/login"); return; }
    const recruiterId = singleJob?.company?.userId;
    if (!recruiterId) { toast.error("Recruiter contact is not available for this listing"); return; }
    try { await axios.post(`${WORKSPACE_API_ENDPOINT}/messages/conversations`, { userId: recruiterId, job: jobId }, { withCredentials: true }); navigate("/messages"); }
    catch (error) { toast.error(error.response?.data?.message || "Could not open recruiter conversation"); }
  };

  const reportJob = async () => {
    const reason = window.prompt("Briefly explain why this job should be reviewed:");
    if (!reason?.trim()) return;
    try { await axios.post(`${WORKSPACE_API_ENDPOINT}/reports`, { targetType: "job", targetId: jobId, reason: reason.trim() }, { withCredentials: true }); toast.success("Report submitted for review"); }
    catch (error) { toast.error(error.response?.data?.message || "Could not submit report"); }
  };

  const applyJobHandler = async () => {
    if (!user) {
      toast.error("Please login to apply for this job");
      navigate("/login");
      return;
    }
    try {
      const missingAnswer = screeningQuestions.find(question => question.required && !String(screeningAnswers[question._id] || "").trim());
      if (missingAnswer) { toast.error("Please answer all required screening questions"); return; }
      const res = await axios.post(
        `${APPLICATION_API_ENDPOINT}/apply/${jobId}`,
        { ...(selectedResumeId ? { resumeId: selectedResumeId } : {}), source: "job-details", screeningAnswers },
        { withCredentials: true }
      );
      if (res.data.success) {
        setIsApplied(true);
        const updateSingleJob = {
          ...singleJob,
          applications: [...singleJob.applications, { applicant: user?._id }],
        };
        dispatch(setSingleJob(updateSingleJob));
        console.log(res.data);
        toast.success(res.data.message);
      }
    } catch (error) {
      console.log(error.message);
      toast.error(error.response?.data?.message || "Unable to apply right now");
    }
  };

  useEffect(() => {
    const fetchSingleJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${JOB_API_ENDPOINT}/get/${jobId}`, {
          withCredentials: true,
        });
        console.log("API Response:", res.data);
        if (res.data.status) {
          dispatch(setSingleJob(res.data.job));
          setIsApplied(
            res.data.job.applications.some(
              (application) => application.applicant === user?._id
            )
          );
        } else {
          setError("Failed to fetch jobs.");
        }
      } catch (error) {
        console.error("Fetch Error:", error);
        setError(error.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchSingleJobs();
    if (user?.role === "Student") {
      axios.get(`${WORKSPACE_API_ENDPOINT}/student/resumes`, { withCredentials: true })
        .then(({ data }) => setResumeProfiles(data.resumes || []))
        .catch(() => setResumeProfiles([]));
      axios.get(`${WORKSPACE_API_ENDPOINT}/student/jobs/${jobId}/screening-questions`, { withCredentials: true })
        .then(({ data }) => setScreeningQuestions(data.questions || []))
        .catch(() => setScreeningQuestions([]));
    } else {
      setResumeProfiles([]);
      setScreeningQuestions([]);
    }
  }, [jobId, dispatch, user?._id, user?.role]);
  console.log("single jobs", singleJob);

  if (loading) return <div className="mx-auto max-w-7xl p-8 text-slate-500">Loading job details…</div>;
  if (error) return <div className="mx-auto max-w-7xl p-8 text-red-600">{error}</div>;
  if (!singleJob) return <div className="mx-auto max-w-7xl p-8 text-slate-500">Job not found.</div>;

  return (
    <div>
      <div className="max-w-7xl mx-auto my-10 px-4 md:px-8">
        <Button onClick={() => navigate(-1)} variant="ghost" className="mb-4 flex items-center gap-2 text-gray-600">
           <ArrowLeft size={18} />
           Back
        </Button>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
          <div>
            <h1 className="font-bold text-xl">{singleJob?.title}</h1>
            <div className="flex flex-wrap gap-2 items-center mt-4">
              <Badge className={"text-blue-600 font-bold"} variant={"ghost"}>
                {singleJob?.position} Open Positions
              </Badge>
              <Badge className={"text-[#FA4F09] font-bold"} variant={"ghost"}>
                {singleJob?.salary}LPA
              </Badge>
              <Badge className={"text-[#6B3AC2] font-bold"} variant={"ghost"}>
                {singleJob?.location}
              </Badge>
              <Badge className={"text-black font-bold"} variant={"ghost"}>
                {singleJob?.jobType}
              </Badge>
            </div>
          </div>
          <div className="w-full md:w-auto mt-4 md:mt-0">
            {user?.role === "Student" && screeningQuestions.length > 0 && !isApplied && <div className="mb-3 space-y-2">{screeningQuestions.map(question=><label key={question._id} className="block text-left text-xs font-medium text-slate-600 dark:text-slate-300">{question.question}{question.required?" *":""}<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" value={screeningAnswers[question._id]||""} onChange={e=>setScreeningAnswers(old=>({...old,[question._id]:e.target.value}))} placeholder="Your answer"/></label>)}</div>}
            {user?.role === "Student" && resumeProfiles.length > 1 && !isApplied && <select value={selectedResumeId} onChange={e => setSelectedResumeId(e.target.value)} className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Use primary resume</option>{resumeProfiles.map(resume => <option key={resume._id} value={resume._id}>{resume.name}{resume.isPrimary ? " (Primary)" : ""}</option>)}</select>}
            {user?.role === "Student" && <Button variant="outline" onClick={contactRecruiter} className="mb-2 w-full md:w-auto">Contact recruiter</Button>}
            {user?.role === "Student" && <button onClick={reportJob} className="mb-2 block w-full text-xs text-slate-500 underline md:w-auto">Report this listing</button>}
            <Button
              onClick={isApplied ? null : applyJobHandler}
              disabled={isApplied}
              className={`rounded-lg w-full md:w-auto ${
                isApplied
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-[#6B3AC2] hover:bg-[#552d9b]"
              }`}
            >
              {isApplied ? "Already Applied" : "Apply"}
            </Button>
          </div>
        </div>
        <h1 className="border-b-2 border-b-gray-400 font-medium py-4">
          {singleJob?.description}
        </h1>
        <div className="my-4">
          <h1 className="font-bold my-1 ">
            Role:{" "}
            <span className=" pl-4 font-normal text-gray-800">
              {singleJob?.position} Open Positions
            </span>
          </h1>
          <h1 className="font-bold my-1 ">
            Location:{" "}
            <span className=" pl-4 font-normal text-gray-800">
              {" "}
              {singleJob?.location}
            </span>
          </h1>
          <h1 className="font-bold my-1 ">
            Salary:{" "}
            <span className=" pl-4 font-normal text-gray-800">
              {singleJob?.salary} LPA
            </span>
          </h1>
          <h1 className="font-bold my-1 ">
            Experience:{" "}
            <span className=" pl-4 font-normal text-gray-800">
              {singleJob?.experienceLevel} Year
            </span>
          </h1>
          <h1 className="font-bold my-1 ">
            Total Applicants:{" "}
            <span className=" pl-4 font-normal text-gray-800">
              {singleJob?.applications?.length}
            </span>
          </h1>
          <h1 className="font-bold my-1 ">
            Job Type:
            <span className=" pl-4 font-normal text-gray-800">
              {singleJob?.jobType}
            </span>
          </h1>
          <h1 className="font-bold my-1 ">
            Post Date:
            <span className=" pl-4 font-normal text-gray-800">
              {singleJob?.createdAt.split("T")[0]}
            </span>
          </h1>
        </div>

        <RecommendedJobs jobId={jobId} />
      </div>
    </div>
  );
};

export default Description;
