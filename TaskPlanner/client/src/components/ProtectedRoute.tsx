import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import type { UserRole } from '../types';

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: UserRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-screen">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allow) {
    return <Navigate to={user.role === 'manager' ? '/manager/dashboard' : '/developer/dashboard'} replace />;
  }

  return <>{children}</>;
}
