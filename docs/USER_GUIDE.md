# Job Hunt — User Guide

## Student account
1. Open **Register**, choose **Student**, complete the form and verify the OTP sent to your email.
2. Complete your profile and add skills. Upload your resume through the existing profile workflow.
3. Browse jobs, save listings and apply. If a recruiter has added screening questions, answer the required questions before submitting.
4. In **Placement Tools**, paste resume text for AI feedback, generate a mock interview, build a skill roadmap, record daily goals and save job-search alerts.
5. Add role-specific resume links in **Role-specific resume profiles**. Choose a primary resume; on a job page you can select another saved resume before applying.
6. Use **Messages** to communicate with a recruiter after opening a conversation from a job listing.

## Recruiter account
1. Register as **Recruiter** and verify the email.
2. Open **Companies** and create your company profile.
3. Open **Workspace** to generate a job draft, start from a role template, edit it and save it. You can schedule its publication or set an expiry date.
4. Use CSV import for multiple listings. Required columns are `title`, `description`, `location`, `jobType`; optional columns include `requirements` (separate skills with semicolons), `salary`, `experienceLevel`, `position`. The selected company is used when a row has no `company` value.
5. Select a job in **Manage applicants** to filter, rank, compare, shortlist or reject applicants. Resume links and screening answers are visible on the applicant record. Notes are private to the recruiter.
6. Schedule interviews from the selected job's applicant list. Interview reminders and email notifications require Brevo configuration.
7. Review job performance, pipeline counts, trends and CSV export in the workspace.

## Platform admin
1. Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters) and `ADMIN_NAME` in `Backend/.env`.
2. Run `npm run create-admin` from the Backend folder.
3. Sign in by choosing **Admin** on the login screen. Public registration does not create admin accounts.
4. Use **Admin Dashboard** to manage accounts, verify companies, moderate jobs, review reports and inspect admin activity.

## Common setup issues
- If the frontend cannot reach the backend, check `VITE_API_BASE_URL`, `CORS_ORIGIN`, backend port and browser console.
- If login cookies do not persist in production, confirm both deployments use HTTPS and the CORS origin is exact.
- If AI actions fail, check `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, provider quota and timeout settings.
- If OTP or notifications are not delivered, configure a verified Brevo sender in `EMAIL_USER` and `BREVO_API_KEY`.
- Never upload `.env` files to GitHub or share real API credentials in a project ZIP.
