/**
 * Unified App Root — single-platform routing with RBAC
 *
 * Route access matrix:
 *  /login, /signup                → Public (redirects away if authenticated)
 *  /task-planner                  → Manager only
 *  /employees, /analytics         → Manager only
 *  /employee-dashboard            → Employee only
 *  /task-planner/employee         → Employee only
 *  /pm/manager/*                  → Manager only
 *  /pm/developer/*                → Employee only
 *  /upload, /task, /workflow,     → Both roles
 *  /reports, /profile             → Both roles
 */
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';

// Existing pages (Aithon data-governance modules — DO NOT TOUCH)
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardHome from './pages/DashboardHome';
import DatasetUpload from './pages/DatasetUpload';
import TaskSubmit from './pages/TaskSubmit';
import WorkflowView from './pages/WorkflowView';
import Reports from './pages/Reports';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ProjectCreate from './pages/manager/ProjectCreate';
import ProjectDetail from './pages/manager/ProjectDetail';
import DeveloperDashboard from './pages/developer/DeveloperDashboard';
import TaskDetail from './pages/developer/TaskDetail';

// New unified pages
import ManagerTaskPlanner from './pages/task-planner/ManagerTaskPlanner';
import EmployeeTaskView from './pages/task-planner/EmployeeTaskView';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeManagement from './pages/EmployeeManagement';
import Profile from './pages/Profile';

// ─── Route Guards ─────────────────────────────────────────────────────────────

/** Redirect logged-in users away from public pages. */
function PublicRoute() {
  const { isAuthenticated, isManager, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) {
    return <Navigate to={isManager ? '/task-planner' : '/employee-dashboard'} replace />;
  }
  return <Outlet />;
}

/** Requires authentication; shows the shared app shell. */
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

/** Manager-only guard. */
function ManagerRoute() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/employee-dashboard" replace />;
  return <Outlet />;
}

/** Employee-only guard. */
function EmployeeRoute() {
  const { isEmployee } = useAuth();
  if (!isEmployee) return <Navigate to="/task-planner" replace />;
  return <Outlet />;
}

/** After login redirect based on role — the "smart root". */
function RoleRedirect() {
  const { isAuthenticated, isManager } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={isManager ? '/task-planner' : '/employee-dashboard'} replace />;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* Protected shell */}
          <Route element={<ProtectedLayout />}>

            {/* ── Shared routes (both roles) ── */}
            <Route path="/upload"   element={<DatasetUpload />} />
            <Route path="/task"     element={<TaskSubmit />} />
            <Route path="/workflow" element={<WorkflowView />} />
            <Route path="/reports"  element={<Reports />} />
            <Route path="/profile"  element={<Profile />} />

            {/* ── Analytics (reuses DashboardHome — agreed) ── */}
            <Route path="/analytics" element={<ManagerRoute />}>
              <Route index element={<DashboardHome />} />
            </Route>

            {/* ── Manager-only routes ── */}
            <Route element={<ManagerRoute />}>
              {/* Task Planner (real-time Socket.IO) */}
              <Route path="/task-planner" element={<ManagerTaskPlanner />} />
              {/* Employee Management */}
              <Route path="/employees" element={<EmployeeManagement />} />
              {/* PM Manager */}
              <Route path="/pm/manager"                         element={<ManagerDashboard />} />
              <Route path="/pm/manager/create"                  element={<ProjectCreate />} />
              <Route path="/pm/manager/projects/:projectId"     element={<ProjectDetail />} />
            </Route>

            {/* ── Employee-only routes ── */}
            <Route element={<EmployeeRoute />}>
              <Route path="/employee-dashboard"       element={<EmployeeDashboard />} />
              <Route path="/task-planner/employee"    element={<EmployeeTaskView />} />
              {/* PM Developer */}
              <Route path="/pm/developer"                       element={<DeveloperDashboard />} />
              <Route path="/pm/developer/tasks/:taskId"         element={<TaskDetail />} />
            </Route>

            {/* /pm — smart redirect based on role */}
            <Route path="/pm" element={<RoleRedirect />} />

            {/* /dashboard — kept for backward compat (old Aithon links) */}
            <Route path="/dashboard" element={<DashboardHome />} />

          </Route>

          {/* Root and catch-all */}
          <Route path="/"  element={<RoleRedirect />} />
          <Route path="*"  element={<RoleRedirect />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1a1a3e',
              color: '#fff',
              border: '1px solid rgba(139,92,246,0.25)',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
