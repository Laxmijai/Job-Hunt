import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Avatar, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { LogOut, User2, Menu, X, Sun, Moon, Bookmark, Bell } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import axios from "axios";
import { setUser } from "@/redux/authSlice";
import { clearSavedJobs, setSavedJobs } from "@/redux/jobSlice";
import { USER_API_ENDPOINT } from "@/utils/data";
import { useTheme } from "@/context/ThemeContext";

const Navbar = () => {
  const { user } = useSelector((store) => store.auth);
  const savedJobs = useSelector((store) => store.job.savedJobs || []);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    let active = true;
    if (user?.role === "Student") {
      axios.get(`${USER_API_ENDPOINT}/saved-jobs`, { withCredentials: true })
        .then(({ data }) => { if (active && data.success) dispatch(setSavedJobs(data.jobs || [])); })
        .catch(() => { if (active) dispatch(clearSavedJobs()); });
    } else {
      dispatch(clearSavedJobs());
    }
    return () => { active = false; };
  }, [user?._id, user?.role, dispatch]);

  const logoutHandler = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await axios.post(`${USER_API_ENDPOINT}/logout`, {}, { withCredentials: true });
      dispatch(setUser(null));
      dispatch(clearSavedJobs());
      navigate("/");
      toast.success(res.data?.message || "Logged out successfully");
    } catch (error) {
      // Clear client state even if the network is unavailable; the cookie expires server-side.
      dispatch(setUser(null));
      dispatch(clearSavedJobs());
      navigate("/");
      toast.error("Logged out on this device. Please check your connection.");
    } finally { setLoggingOut(false); }
  };


  useEffect(() => {
    let active = true;
    if (!user) { setNotifications([]); setUnreadCount(0); return undefined; }
    const loadNotifications = async () => {
      try {
        const response = await axios.get(`${USER_API_ENDPOINT}/notifications`, { withCredentials: true });
        if (active && response.data.success) { setNotifications(response.data.notifications || []); setUnreadCount(response.data.unreadCount || 0); }
      } catch { /* Notification polling should never interrupt navigation. */ }
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 45000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user?._id]);

  const markAllRead = async () => {
    try {
      await axios.patch(`${USER_API_ENDPOINT}/notifications/read-all`, {}, { withCredentials: true });
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch { toast.error("Could not update notifications"); }
  };
  const openNotification = async (notification) => {
    if (!notification.read) {
      try { await axios.patch(`${USER_API_ENDPOINT}/notifications/${notification._id}/read`, {}, { withCredentials: true }); } catch { /* navigation can continue */ }
      setNotifications((items) => items.map((item) => item._id === notification._id ? { ...item, read: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    navigate(notification.link || "/career-hub");
  };

  const themeButton = <Button type="button" variant="outline" size="icon" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={toggleTheme} className="shrink-0">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</Button>;
  const linkClass = "hover:text-[#FA4F09] transition-colors";

  return (
    <header className="bg-white dark:bg-slate-950 dark:text-slate-100 sticky top-0 z-50 shadow-sm border-b dark:border-slate-800">
      <div className="flex items-center justify-between mx-auto max-w-7xl h-16 px-4 md:px-8">
        <Link to="/" aria-label="Job Hunt home"><h1 className="text-2xl font-bold"><span className="text-[#6B3AC2]">Job </span><span className="text-[#FA4F09]">Hunt</span></h1></Link>
        <nav className="hidden md:flex items-center gap-7">
          <ul className="flex font-medium items-center gap-6">
            {user?.role === "Recruiter" ? <>
              <li><Link to="/admin/companies" className={linkClass}>Companies</Link></li>
              <li><Link to="/admin/jobs" className={linkClass}>Jobs</Link></li>
              <li><Link to="/career-hub" className={linkClass}>Hiring Insights</Link></li>
            </> : <>
              <li><Link to="/Home" className={linkClass}>Home</Link></li>
              <li><Link to="/Browse" className={linkClass}>Browse</Link></li>
              <li><Link to="/Jobs" className={linkClass}>Jobs</Link></li>
              {user?.role === "Student" && <>
                <li><Link to="/saved-jobs" className={`${linkClass} inline-flex items-center gap-1`}><Bookmark size={15}/> Saved Jobs {savedJobs.length > 0 && <span className="bg-violet-100 text-violet-700 text-xs rounded-full px-2 py-0.5">{savedJobs.length}</span>}</Link></li>
                <li><Link to="/career-hub" className={linkClass}>Career Hub</Link></li>
              </>}
            </>}
          </ul>
          {user && <Popover><PopoverTrigger asChild><button aria-label="Notifications" className="relative rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Bell size={18}/>{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button></PopoverTrigger><PopoverContent align="end" className="w-80 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><div className="mb-3 flex items-center justify-between"><p className="font-semibold">Notifications</p><button onClick={markAllRead} className="text-xs font-semibold text-violet-600">Mark all read</button></div><div className="max-h-80 space-y-2 overflow-y-auto">{notifications.length ? notifications.map((notification) => <button key={notification._id} onClick={() => openNotification(notification)} className={`block w-full rounded-lg p-3 text-left ${notification.read ? "bg-slate-50 dark:bg-slate-800" : "bg-violet-50 dark:bg-violet-950/60"}`}><p className="text-sm font-semibold">{notification.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{notification.message}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p></button>) : <p className="py-6 text-center text-sm text-slate-500">You're all caught up.</p>}</div></PopoverContent></Popover>}
          {themeButton}
          {!user ? <div className="flex items-center gap-2"><Link to="/login"><Button variant="outline">Login</Button></Link><Link to="/register"><Button className="bg-[#6B3AC2] hover:bg-[#552d9b]">Register</Button></Link></div> :
            <Popover><PopoverTrigger asChild><button aria-label="Open account menu"><Avatar className="cursor-pointer"><AvatarImage src={user?.profile?.profilePhoto} alt={user?.fullname || "Profile"}/></Avatar></button></PopoverTrigger>
              <PopoverContent className="w-72 dark:bg-slate-900 dark:text-white dark:border-slate-700">
                <div className="flex items-center gap-3"><Avatar><AvatarImage src={user?.profile?.profilePhoto}/></Avatar><div className="min-w-0"><p className="font-semibold truncate">{user?.fullname}</p><p className="text-xs text-muted-foreground truncate">{user?.email}</p></div></div>
                <div className="mt-4 flex flex-col gap-2">{user?.role === "Student" && <Link to="/Profile" className="flex items-center gap-2 text-sm hover:text-violet-600"><User2 size={17}/> Profile</Link>}<Button variant="ghost" className="justify-start px-0 text-red-600" onClick={logoutHandler} disabled={loggingOut}><LogOut size={17} className="mr-2"/>{loggingOut ? "Logging out…" : "Logout"}</Button></div>
              </PopoverContent>
            </Popover>}
        </nav>
        <div className="md:hidden flex items-center gap-2">{user && <Popover><PopoverTrigger asChild><button aria-label="Notifications" className="relative rounded-lg border p-2 dark:border-slate-700"><Bell size={18}/>{unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-1 text-[10px] text-white">{unreadCount}</span>}</button></PopoverTrigger><PopoverContent align="end" className="w-80 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><div className="mb-3 flex items-center justify-between"><p className="font-semibold">Notifications</p><button onClick={markAllRead} className="text-xs text-violet-600">Mark all read</button></div><div className="max-h-72 space-y-2 overflow-y-auto">{notifications.map((notification) => <button key={notification._id} onClick={() => openNotification(notification)} className="block w-full rounded-lg bg-slate-50 p-3 text-left text-sm dark:bg-slate-800"><p className="font-semibold">{notification.title}</p><p className="text-xs text-slate-500">{notification.message}</p></button>)}{!notifications.length && <p className="py-5 text-center text-sm text-slate-500">You're all caught up.</p>}</div></PopoverContent></Popover>}{themeButton}<Button variant="ghost" size="icon" onClick={() => setIsMenuOpen((open) => !open)} aria-label="Toggle navigation">{isMenuOpen ? <X size={24}/> : <Menu size={24}/>}</Button></div>
      </div>
      {isMenuOpen && <nav className="md:hidden bg-white dark:bg-slate-950 dark:text-slate-100 border-t dark:border-slate-800 px-5 py-4 shadow-lg"><ul className="flex flex-col gap-4 font-medium">
        {user?.role === "Recruiter" ? <><li><Link onClick={() => setIsMenuOpen(false)} to="/admin/companies">Companies</Link></li><li><Link onClick={() => setIsMenuOpen(false)} to="/admin/jobs">Jobs</Link></li><li><Link onClick={() => setIsMenuOpen(false)} to="/career-hub">Hiring Insights</Link></li></> : <><li><Link onClick={() => setIsMenuOpen(false)} to="/Home">Home</Link></li><li><Link onClick={() => setIsMenuOpen(false)} to="/Browse">Browse</Link></li><li><Link onClick={() => setIsMenuOpen(false)} to="/Jobs">Jobs</Link></li>{user?.role === "Student" && <><li><Link onClick={() => setIsMenuOpen(false)} to="/saved-jobs">Saved Jobs ({savedJobs.length})</Link></li><li><Link onClick={() => setIsMenuOpen(false)} to="/career-hub">Career Hub</Link></li></>}</>}
        {!user ? <><li><Link onClick={() => setIsMenuOpen(false)} to="/login">Login</Link></li><li><Link onClick={() => setIsMenuOpen(false)} to="/register">Register</Link></li></> : <><li><Link onClick={() => setIsMenuOpen(false)} to="/Profile">Profile</Link></li><li><button onClick={logoutHandler} className="text-red-600">Logout</button></li></>}
      </ul></nav>}
    </header>
  );
};
export default Navbar;
