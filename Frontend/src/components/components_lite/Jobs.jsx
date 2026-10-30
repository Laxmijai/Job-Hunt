import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import FilterCard from "./Filtercard";
import Job1 from "./Job1";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import axios from "axios";
import { JOB_API_ENDPOINT } from "@/utils/data";
import { setAllJobs } from "@/redux/jobSlice";

const PAGE_SIZE = 9;
const Jobs = () => {
  const { allJobs, searchedQuery } = useSelector((store) => store.job);
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [jobType, setJobType] = useState(searchParams.get("type") || "");
  const [experience, setExperience] = useState(searchParams.get("experience") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "latest");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const next = new URLSearchParams();
      search.trim() && next.set("q", search.trim());
      location.trim() && next.set("location", location.trim());
      jobType && next.set("type", jobType);
      experience && next.set("experience", experience);
      sort !== "latest" && next.set("sort", sort);
      page > 1 && next.set("page", String(page));
      setSearchParams(next, { replace: true });
      setLoading(true);
      setError("");
      try {
        const legacyQuery = Array.isArray(searchedQuery) ? searchedQuery.filter(Boolean).join(" ") : searchedQuery || "";
        const params = new URLSearchParams({ keyword: search.trim() || legacyQuery, location: location.trim(), type: jobType, experience, sort, page: String(page), limit: String(PAGE_SIZE) });
        const response = await axios.get(`${JOB_API_ENDPOINT}/get?${params.toString()}`);
        if (response.data.status) {
          dispatch(setAllJobs(response.data.jobs || []));
          setTotal(response.data.pagination?.total ?? response.data.jobs?.length ?? 0);
        } else setError("Unable to fetch jobs right now.");
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || "Unable to fetch jobs right now.");
      } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, location, jobType, experience, sort, page, searchedQuery, dispatch, setSearchParams]);

  const clearFilters = () => { setSearch(""); setLocation(""); setJobType(""); setExperience(""); setSort("latest"); setPage(1); };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950"><Navbar/><div className="mx-auto max-w-7xl px-4 py-7 md:px-8">
    <div className="mb-6"><p className="text-sm font-semibold uppercase tracking-wider text-violet-600">Find your next opportunity</p><h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Explore jobs</h1><p className="mt-2 text-sm text-slate-500">Search by role, company, skill or location. Filters are shareable through the page URL.</p></div>
    <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
      <label className="relative md:col-span-2"><Search className="absolute left-3 top-3 text-slate-400" size={18}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Job title, company or skill" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/></label>
      <input value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} placeholder="Location (e.g. Remote)" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/>
      <div className="flex gap-2"><select value={jobType} onChange={(event) => { setJobType(event.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">All job types</option><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option><option>Remote</option></select><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="latest">Latest</option><option value="oldest">Oldest</option><option value="salary">Highest salary</option></select></div>
      <select value={experience} onChange={(event) => { setExperience(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Any experience</option><option value="0">Fresher (0 years)</option><option value="1">Up to 1 year</option><option value="2">Up to 2 years</option><option value="3">Up to 3 years</option></select>
      <div className="flex items-center justify-between md:col-span-4"><p className="flex items-center gap-2 text-sm text-slate-500"><SlidersHorizontal size={15}/>{total} matching jobs</p><button onClick={clearFilters} className="text-sm font-semibold text-violet-700 hover:underline">Clear filters</button></div>
    </div>
    <div className="flex flex-col gap-5 lg:flex-row"><aside className="w-full shrink-0 lg:w-64"><FilterCard/></aside><section className="min-w-0 flex-1">{loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"/>)}</div> : error ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-red-600 dark:border-slate-800 dark:bg-slate-900">{error}</div> : allJobs?.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><Search className="mx-auto mb-3 text-slate-400"/><h2 className="font-semibold dark:text-white">No jobs found</h2><p className="mt-1 text-sm text-slate-500">Try changing your search or clearing some filters.</p><button onClick={clearFilters} className="mt-4 text-sm font-semibold text-violet-700">Clear all filters</button></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{allJobs.map((job) => <motion.div key={job._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="h-full"><Job1 job={job}/></motion.div>)}</div>}
      {total > PAGE_SIZE && <div className="mt-6 flex items-center justify-center gap-3"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700 dark:text-white">Previous</button><span className="text-sm text-slate-500">Page {page} of {pageCount}</span><button disabled={page === pageCount || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700 dark:text-white">Next</button></div>}
    </section></div></div></div>;
};
export default Jobs;
