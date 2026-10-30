import Login from "./components/authentication/Login";
import Register from "./components/authentication/Register";
import VerifyOtp from "./components/authentication/VerifyOtp";
import ResetPassword from "./components/authentication/ResetPassword";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./components/components_lite/Home";
import PrivacyPolicy from "./components/components_lite/PrivacyPolicy.jsx";
import TermsofService from "./components/components_lite/TermsofService.jsx";
import Jobs from "./components/components_lite/Jobs.jsx";
import Browse from "./components/components_lite/Browse.jsx";
import Profile from "./components/components_lite/Profile.jsx";
import Description from "./components/components_lite/Description.jsx";
import Companies from "./components/admincomponent/Companies";
import CompanyCreate from "./components/admincomponent/CompanyCreate";
import CompanySetup from "./components/admincomponent/CompanySetup";
import AdminJobs from "./components/admincomponent/AdminJobs.jsx";
import PostJob from "./components/admincomponent/PostJob";
import Applicants from "./components/admincomponent/Applicants";
import ProtectedRoute from "./components/admincomponent/ProtectedRoute";
import SavedJobs from "./components/components_lite/SavedJobs.jsx";
import TermsAndConditions from "./components/components_lite/TermsAndConditions.jsx";
import CareerHub from "./components/dashboard/CareerHub.jsx";
import ResumeBuilder from "./components/dashboard/ResumeBuilder.jsx";
import StudentTools from "./components/dashboard/StudentTools.jsx";
import RecruiterTools from "./components/dashboard/RecruiterTools.jsx";
import AdminDashboard from "./components/dashboard/AdminDashboard.jsx";
import Messages from "./components/dashboard/Messages.jsx";

const appRouter = createBrowserRouter([
  { path: "/", element: <Home /> },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/verify-otp",
    element: <VerifyOtp />,
  },
  {
    path: "/forgot-password",
    element: <ResetPassword />,
  },
  {
    path: "/description/:id",
    element: <Description />,
  },
  {
    path: "/Profile",
    element: <Profile />,
  },
  {
    path: "/PrivacyPolicy",
    element: <PrivacyPolicy />,
  },
  {
    path: "/TermsofService",
    element: <TermsofService />,
  },
  {
    path: "/Jobs",
    element: <Jobs />,
  },
  {
    path: "/Home",
    element: <Home />,
  },
  {
    path: "/Browse",
    element: <Browse />,
  },
  {
    path: "/saved-jobs",
    element: <SavedJobs />,
  },
  {
    path: "/career-hub",
    element: <CareerHub />,
  },
  {
    path: "/resume-builder",
    element: <ResumeBuilder />,
  },
  { path: "/student/tools", element: <StudentTools /> },
  { path: "/recruiter/tools", element: <RecruiterTools /> },
  { path: "/admin/dashboard", element: <AdminDashboard /> },
  { path: "/messages", element: <Messages /> },
  {
    path: "/terms",
    element: <TermsAndConditions />,
  },

  // /admin
  {
    path: "/admin/companies",
    element: (
      <ProtectedRoute>
        <Companies />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/companies/create",
    element: (
      <ProtectedRoute>
        <CompanyCreate />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/companies/:id",
    element: (
      <ProtectedRoute>
        <CompanySetup />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/jobs",
    element: (
      <ProtectedRoute>
        {" "}
        <AdminJobs />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/jobs/create",
    element: (
      <ProtectedRoute>
        {" "}
        <PostJob />{" "}
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/jobs/:id/applicants",
    element: (
      <ProtectedRoute>
        <Applicants />
      </ProtectedRoute>
    ),
  },
]);

function App() {
  return (
    <div>
      <RouterProvider router={appRouter}></RouterProvider>
    </div>
  );
}

export default App;
