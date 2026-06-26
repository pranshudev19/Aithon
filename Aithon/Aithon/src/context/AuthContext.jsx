/**
 * Unified Authentication Context
 * ───────────────────────────────
 * Primary auth:  Node.js gateway (cookie-based JWT, port 4000)
 * Secondary auth: FastAPI Bearer token stored in localStorage as 'aithon_token'
 *                 — used by the Aithon data-module API calls.
 *
 * On login the gateway returns { user, aithon_token }.
 * The aithon_token is stored in localStorage and added to every
 * proxied request via the X-Aithon-Token header (see api.js).
 */
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket';

const AuthContext = createContext(null);

// Base URL for the Node.js unified gateway
const GATEWAY_API = import.meta.env.VITE_GATEWAY_API || 'http://localhost:4000/api';

// Shared axios instance pointed at the gateway
export const gatewayApi = axios.create({
  baseURL: GATEWAY_API,
  withCredentials: true, // send httpOnly cookie
});

// Inject the aithon_token (for proxied FastAPI calls) on every request
gatewayApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('aithon_token');
  if (token && token !== 'null') {
    config.headers['X-Aithon-Token'] = token;
  }
  return config;
});

// Auto-logout on 401
gatewayApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('aithon_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/** Safely store aithon token — ignore null/undefined values */
function storeAithonToken(token) {
  if (token && typeof token === 'string' && token !== 'null') {
    localStorage.setItem('aithon_token', token);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from cookie (gateway validates it)
  useEffect(() => {
    // Clean up any stale "null" string that may have been stored previously
    const storedToken = localStorage.getItem('aithon_token');
    if (storedToken === 'null' || storedToken === 'undefined') {
      localStorage.removeItem('aithon_token');
    }

    gatewayApi.get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        socket.connect();
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('aithon_token');
      })
      .finally(() => setLoading(false));

    return () => { socket.disconnect(); };
  }, []);

  /**
   * Login with email + password.
   * Returns the user object so callers can redirect based on role.
   */
  const login = async (email, password) => {
    const { data } = await gatewayApi.post('/auth/login', { email, password });
    setUser(data.user);
    if (data.aithon_token) {
      storeAithonToken(data.aithon_token);
    } else {
      // Gateway couldn't get FastAPI token — clear any stale value
      localStorage.removeItem('aithon_token');
      console.warn('[AuthContext] Login succeeded but no aithon_token returned. ' +
        'Aithon data modules (upload/task) will require re-login or may auto-redirect.');
    }
    socket.connect();
    return data.user;
  };

  /**
   * Register a new account.
   * The gateway creates the user in both Node.js DB and FastAPI DB.
   */
  const register = async ({ name, email, password, role = 'developer', skills = [] }) => {
    const { data } = await gatewayApi.post('/auth/register', { name, email, password, role, skills });
    return data.user;
  };

  const logout = async () => {
    try {
      await gatewayApi.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('aithon_token');
    setUser(null);
    socket.disconnect();
  };

  // Role helpers — use lowercase (TaskPlanner DB) as canonical source
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'developer'; // DB stores 'developer', UI shows 'Employee'

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      isManager,
      isEmployee,
      // Deprecated alias kept for backward compat with existing Aithon pages
      isDeveloper: isEmployee,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
