/**
 * Unified Signup Page
 * Uses the Node.js gateway /auth/register endpoint.
 * Gateway creates the user in both the TaskPlanner DB and the FastAPI DB.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Zap, AlertCircle, CheckCircle } from 'lucide-react';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('developer');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ name, email, password, role });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
          <h1>Create Account</h1>
          <p>Join the Aithon Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert--error">
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert--success">
              <CheckCircle size={16} /> <span>Account created! Redirecting to login…</span>
            </div>
          )}

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="text-input" required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="text-input" required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Choose a strong password"
              className="text-input" required
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="select-input"
            >
              <option value="developer">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={loading} style={{ marginTop: 8 }}>
            {loading
              ? <><span className="spinner spinner--small" /> Creating…</>
              : <><UserPlus size={18} /> Create Account</>}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
