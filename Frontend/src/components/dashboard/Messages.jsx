import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Search, Send, MessageCircle, UserRound } from "lucide-react";
import Navbar from "../components_lite/Navbar";
import { WORKSPACE_API_ENDPOINT } from "@/utils/data";

const Messages = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [busy, setBusy] = useState(false);

  const get = useCallback(async (path) => (await axios.get(`${WORKSPACE_API_ENDPOINT}${path}`, { withCredentials: true })).data, []);
  const load = useCallback(async () => {
    try { const result = await get("/messages/conversations"); setConversations(result.conversations || []); }
    catch (error) { toast.error(error.response?.data?.message || "Unable to load conversations"); }
  }, [get]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!["Student", "Recruiter"].includes(user.role)) { navigate("/"); return; }
    load();
  }, [user, navigate, load]);

  useEffect(() => {
    if (search.trim().length < 2) { setRecipients([]); return undefined; }
    const timer = window.setTimeout(async () => {
      try {
        const result = await get(`/messages/recipients?search=${encodeURIComponent(search.trim())}`);
        setRecipients(result.recipients || []);
      } catch (error) { toast.error(error.response?.data?.message || "Could not search users"); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, get]);

  const open = useCallback(async (conversation) => {
    setActive(conversation);
    try { const result = await get(`/messages/conversations/${conversation._id}`); setMessages(result.messages || []); }
    catch (error) { toast.error(error.response?.data?.message || "Unable to open conversation"); }
  }, [get]);

  useEffect(() => {
    if (!active?._id) return undefined;
    const timer = window.setInterval(async () => {
      try { const result = await get(`/messages/conversations/${active._id}`); setMessages(result.messages || []); }
      catch { /* Keep the current conversation visible during a temporary refresh failure. */ }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [active?._id, get]);

  const start = async () => {
    if (!selectedRecipient) return toast.error("Select a person from the search results first");
    try {
      const result = await axios.post(`${WORKSPACE_API_ENDPOINT}/messages/conversations`, { userId: selectedRecipient._id }, { withCredentials: true });
      await load();
      const conversation = (await get("/messages/conversations")).conversations?.find((item) => item._id === result.data.conversation._id);
      if (conversation) open(conversation);
      setSearch(""); setRecipients([]); setSelectedRecipient(null);
    } catch (error) { toast.error(error.response?.data?.message || "Could not start conversation"); }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || !active) return;
    setBusy(true);
    try {
      await axios.post(`${WORKSPACE_API_ENDPOINT}/messages/conversations/${active._id}`, { text: text.trim() }, { withCredentials: true });
      setText(""); await open(active); await load();
    } catch (error) { toast.error(error.response?.data?.message || "Message could not be sent"); }
    finally { setBusy(false); }
  };

  const other = active?.participants?.find((person) => String(person._id) !== String(user?._id));
  return <><Navbar/><main className="mx-auto max-w-6xl px-4 py-8">
    <div className="mb-5"><p className="text-sm font-medium text-violet-700">COMMUNICATION</p><h1 className="mt-1 text-3xl font-bold dark:text-white">Messages</h1><p className="mt-2 text-sm text-slate-500">Connect with students or recruiters connected to your applications. You don't need to enter a user ID.</p></div>
    <div className="grid min-h-[600px] overflow-hidden rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[320px_1fr]">
      <aside className="border-b p-4 dark:border-slate-800 md:border-b-0 md:border-r">
        <h2 className="font-semibold dark:text-white">Start a conversation</h2>
        <div className="relative mt-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedRecipient(null); }} placeholder={user?.role === "Recruiter" ? "Search applicants by name or email" : "Search recruiters by name or email"}/></div>
        {recipients.length > 0 && <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border dark:border-slate-700">{recipients.map((person) => <button key={person._id} onClick={() => { setSelectedRecipient(person); setSearch(person.fullname); setRecipients([]); }} className="flex w-full items-center gap-3 border-b p-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700"><UserRound size={17}/></span><span className="min-w-0"><span className="block truncate text-sm font-medium dark:text-white">{person.fullname}</span><span className="block truncate text-xs text-slate-500">{person.email}</span></span></button>)}</div>}
        {search.trim().length >= 2 && !recipients.length && !selectedRecipient && <p className="mt-2 text-xs text-slate-500">No eligible users found. You can message people connected to your applications.</p>}
        {selectedRecipient && <div className="mt-2 rounded-lg bg-violet-50 p-3 text-sm dark:bg-violet-950/40"><p className="font-medium dark:text-white">{selectedRecipient.fullname}</p><p className="text-xs text-slate-500">{selectedRecipient.email}</p><button onClick={start} className="mt-2 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white">Open conversation</button></div>}
        <div className="mb-2 mt-6 flex items-center gap-2"><MessageCircle size={16} className="text-slate-500"/><h2 className="font-semibold dark:text-white">Your conversations</h2></div>
        <div className="space-y-1">{conversations.map((conversation) => { const person = conversation.participants?.find((participant) => String(participant._id) !== String(user?._id)); return <button key={conversation._id} onClick={() => open(conversation)} className={`w-full rounded-lg p-3 text-left text-sm ${active?._id === conversation._id ? "bg-violet-50 dark:bg-violet-950/50" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}><span className="block font-semibold dark:text-white">{person?.fullname || "Conversation"}</span><span className="mt-1 block text-xs text-slate-500">{person?.role || "Member"} · {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : "No messages yet"}</span></button>; })}{!conversations.length && <p className="py-4 text-sm text-slate-500">Your conversations will appear here.</p>}</div>
      </aside>
      <section className="flex min-h-[500px] flex-col"><div className="border-b p-4 dark:border-slate-800"><p className="font-semibold dark:text-white">{other?.fullname || "Select a conversation"}</p><p className="text-xs text-slate-500">{other?.role || "Choose a conversation from the left"}</p></div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message) => <div key={message._id} className={`max-w-[80%] rounded-xl p-3 text-sm ${String(message.sender?._id) === String(user?._id) ? "ml-auto bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100" : "bg-slate-100 dark:bg-slate-800 dark:text-white"}`}><p>{message.text}</p><p className="mt-1 text-right text-[10px] opacity-60">{new Date(message.createdAt).toLocaleString()}</p></div>)}{!messages.length && <p className="pt-12 text-center text-sm text-slate-500">Choose a conversation to view messages or search for an eligible contact.</p>}</div><form onSubmit={send} className="flex gap-2 border-t p-3 dark:border-slate-800"><input className="min-w-0 flex-1 rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a message..." disabled={!active}/><button type="submit" disabled={!active || busy || !text.trim()} aria-label="Send message" className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Send size={15}/>Send</button></form></section>
    </div>
  </main></>;
};
export default Messages;
