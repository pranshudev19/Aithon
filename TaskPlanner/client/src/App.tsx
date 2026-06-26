import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './state/AuthContext';
import LoginPage from './pages/LoginPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DeveloperDashboard from './pages/DeveloperDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'manager' ? '/manager/dashboard' : '/developer/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/manager/dashboard"
        element={
          <ProtectedRoute allow="manager">
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/developer/dashboard"
        element={
          <ProtectedRoute allow="developer">
            <DeveloperDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
