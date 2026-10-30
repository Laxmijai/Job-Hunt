# Added Workspace API

All routes below are prefixed with `/api/workspace` and require the HTTP-only login cookie unless stated otherwise. Role restrictions are enforced on the backend.

## Student
- `GET /student/records?kind=` — saved career activity.
- `POST /student/records`, `PATCH /student/records/:id`, `DELETE /student/records/:id` — preparation records.
- `POST /student/resume/analyze` — analyze pasted resume text.
- `POST /student/mock-interviews` — generate questions.
- `POST /student/mock-interviews/:id/submit` — evaluate submitted answers.
- `POST /student/roadmaps` — generate a skill roadmap.
- `POST /student/company-prep` — generate a company preparation guide.
- `POST /student/assessment` — save a placement self-assessment.
- `GET/POST /student/resumes`, `PATCH /student/resumes/:id/primary`, `DELETE /student/resumes/:id` — manage resume links.
- `GET /student/jobs/:jobId/screening-questions` — read job screening questions.
- `GET /analytics/student` — application metrics and readiness estimate.

## Recruiter
- `POST /recruiter/jobs/generate` — AI job draft content.
- `GET/POST /recruiter/jobs/drafts`, `POST /recruiter/jobs/drafts/:id/publish` — manage/publish drafts.
- `POST /recruiter/jobs/:id/duplicate`, `POST /recruiter/jobs/bulk` — duplicate/import jobs.
- `GET /recruiter/jobs/:jobId/candidates`, `POST /recruiter/jobs/:jobId/compare` — candidate fit and comparison.
- `POST/GET /recruiter/notes` — private recruiter notes.
- `POST /recruiter/screening-questions`, `GET /recruiter/screening-questions/:jobId` — screening questions.
- `POST /recruiter/applications/bulk` — bulk application status change.
- `POST /recruiter/interviews`, `GET /interviews`, `POST /recruiter/interviews/:id/feedback` — interview workflow.
- `GET /analytics/recruiter` — job, view, application, stage, trend and source metrics.

## Messaging and reports
- `POST/GET /messages/conversations`, `GET /messages/conversations/:id`, `POST /messages/conversations/:id`.
- `POST /reports` — report a job, company, user or message for review.

## Admin
- `GET /admin/overview`, `GET /admin/users`, `PATCH /admin/users/:id/suspension`.
- `GET /admin/companies`, `PATCH /admin/companies/:id/verification`.
- `GET /admin/jobs`, `PATCH /admin/jobs/:id/status`.
- `GET /admin/reports`, `PATCH /admin/reports/:id`, `GET /admin/activity`.

The existing `/api/user`, `/api/job`, `/api/company` and `/api/application` routes remain in place.
