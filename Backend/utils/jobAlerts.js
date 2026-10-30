import { CareerRecord } from "../models/workspace.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { sendNotificationEmail } from "./mailer.js";

export const notifyMatchingStudents = async (job) => {
  if (!job?._id || job.alertsSentAt) return;
  const alerts = await CareerRecord.find({ kind: "job-alert", "payload.active": { $ne: false } }).select("owner payload");
  const content = [job.title, job.description, job.location, job.jobType, ...(job.requirements || [])].join(" ").toLowerCase();
  const recipients = new Set();
  for (const alert of alerts) {
    const query = String(alert.payload?.query || "").toLowerCase().trim();
    const tokens = query.split(/\s+/).filter(token => token.length > 2);
    if (tokens.length && tokens.some(token => content.includes(token))) recipients.add(String(alert.owner));
  }
  const users = await User.find({ _id: { $in: [...recipients] }, role: "Student", isSuspended: { $ne: true } }).select("email notificationPreferences");
  for (const user of users) {
    const title = "A job matches your saved search";
    const message = `${job.title} · ${job.location || "Location not specified"}`;
    await Notification.create({ recipient: user._id, title, message, type: "job", link: `/description/${job._id}` });
    if (user.email && user.notificationPreferences?.email !== false && process.env.BREVO_API_KEY) {
      try { await sendNotificationEmail(user.email, title, message); }
      catch (error) { console.error("Saved job alert email failed:", error.message); }
    }
  }
  job.alertsSentAt = new Date();
  await job.save();
};
