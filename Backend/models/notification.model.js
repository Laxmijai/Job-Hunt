import mongoose from "mongoose";
const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["application", "interview", "job", "system"], default: "system" },
  link: { type: String, default: "/career-hub" },
  read: { type: Boolean, default: false },
}, { timestamps: true });
notificationSchema.index({ recipient: 1, createdAt: -1 });
export const Notification = mongoose.model("Notification", notificationSchema);
