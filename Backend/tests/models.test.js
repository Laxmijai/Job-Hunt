import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../models/user.model.js";
import { Application } from "../models/application.model.js";
import { CareerRecord } from "../models/workspace.model.js";
import { Job } from "../models/job.model.js";

test("platform roles include Admin without making it a registration default", () => {
  const admin = new User({ fullname: "Admin", email: "admin@example.com", phoneNumber: "admin-test", password: "hashed", role: "Admin" });
  assert.equal(admin.validateSync(), undefined);
  const invalid = new User({ fullname: "Test", email: "test@example.com", phoneNumber: "test-phone", password: "hashed", role: "PublicAdmin" });
  assert.ok(invalid.validateSync()?.errors?.role);
});

test("application schema preserves the submitted resume and screening answers", () => {
  const application = new Application({ job: "507f1f77bcf86cd799439011", applicant: "507f1f77bcf86cd799439012", resumeSnapshot: "https://cdn.example.com/resume.pdf", resumeLabel: "Frontend resume", screeningAnswers: { q1: "React" }, interviewMode: "phone" });
  assert.equal(application.resumeSnapshot, "https://cdn.example.com/resume.pdf");
  assert.equal(application.screeningAnswers.get("q1"), "React");
  assert.equal(application.validateSync(), undefined);
});

test("career records accept the new preparation workspace types", () => {
  for (const kind of ["resume-analysis", "mock-interview", "roadmap", "prep-log", "job-alert", "company-prep", "assessment"]) {
    const record = new CareerRecord({ owner: "507f1f77bcf86cd799439011", kind, title: kind, payload: {} });
    assert.equal(record.validateSync(), undefined, `kind ${kind} should validate`);
  }
});

test("job schema supports draft publishing and expiry states", () => {
  const job = new Job({ title: "Developer", description: "Build software", salary: "5 LPA", experienceLevel: 0, location: "Lucknow", jobType: "Full-time", position: 1, company: "507f1f77bcf86cd799439011", created_by: "507f1f77bcf86cd799439012", status: "draft", publishAt: new Date(Date.now()+10000), expiresAt: new Date(Date.now()+86400000) });
  assert.equal(job.validateSync(), undefined);
});
