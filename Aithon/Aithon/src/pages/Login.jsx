/**
 * Unified Login Page
 * ─────────────────
 * Authenticates against the Node.js gateway (cookie + aithon_token).
 * Redirects managers → /task-planner, employees → /employee-dashboard.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Zap, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      // Role-based redirect
      navigate(user.role === 'manager' ? '/task-planner' : '/employee-dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Zap size={28} color="white" />
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to the Aithon Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert--error">
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              id="login-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="text-input"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="text-input"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            id="login-submit"
            className="btn btn--primary btn--full"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading
              ? <><span className="spinner spinner--small" /> Signing in…</>
              : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div style={{
          marginTop: 16, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Demo credentials</strong><br />
          Manager → manager@taskplanner.com / Manager@123<br />
          Employee → alice@taskplanner.com / Dev@123
        </div>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}