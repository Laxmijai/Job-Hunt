import { Job } from "../models/job.model.js";
import { Interview } from "../models/workspace.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { sendNotificationEmail } from "./mailer.js";
import { notifyMatchingStudents } from "./jobAlerts.js";

let running = false;
export const runScheduledTasks = async () => {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const scheduledJobs = await Job.find({ status: "draft", publishAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).limit(100);
    for (const job of scheduledJobs) { job.status = "published"; job.publishedAt = now; await job.save(); await notifyMatchingStudents(job); }
    await Job.updateMany({ status: "published", expiresAt: { $lte: now } }, { $set: { status: "expired" } });
    const due = await Interview.find({ status: "scheduled", reminderSentAt: null, scheduledAt: { $gt: now, $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }).limit(100);
    for (const interview of due) {
      // Mark first so multiple server instances do not send duplicate reminders.
      const claimed = await Interview.updateOne({ _id: interview._id, reminderSentAt: null }, { $set: { reminderSentAt: now } });
      if (!claimed.modifiedCount) continue;
      const recipients = await User.find({ _id: { $in: [interview.student, interview.recruiter] } }).select("email notificationPreferences");
      for (const recipient of recipients) {
        const message = `Reminder: your interview is scheduled for ${interview.scheduledAt.toLocaleString()}.`;
        await Notification.create({ recipient: recipient._id, title: "Interview reminder", message, type: "interview", link: "/career-hub" });
        if (recipient.email && recipient.notificationPreferences?.email !== false && process.env.BREVO_API_KEY) {
          try { await sendNotificationEmail(recipient.email, "Interview reminder - Job Hunt", message); }
          catch (error) { console.error("Interview reminder email failed:", error.message); }
        }
      }
    }
  } catch (error) {
    console.error("Scheduled task error:", error.message);
  } finally { running = false; }
};
export const startScheduledTasks = () => {
  runScheduledTasks();
  const timer = setInterval(runScheduledTasks, 5 * 60 * 1000);
  timer.unref?.();
};
