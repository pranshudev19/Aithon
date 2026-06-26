import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import DeveloperDashboard from './pages/DeveloperDashboard';
import { LogOut, LayoutDashboard } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'manager' ? '/manager' : '/developer'} replace />;
  }
  return children;
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary-600" />
              <span className="font-bold text-xl text-gray-900">TaskPlanner AI</span>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                  <span className="text-xs text-gray-500 capitalize">{user.role}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === 'manager' ? '/manager' : '/developer'} replace /> : <Login />}
      />
      
      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={['manager']}>
            <Layout><ManagerDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/developer"
        element={
          <ProtectedRoute allowedRoles={['developer']}>
            <Layout><DeveloperDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="*"
        element={<Navigate to={user ? (user.role === 'manager' ? '/manager' : '/developer') : '/login'} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
