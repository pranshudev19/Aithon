import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../state/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('manager@taskplanner.com');
  const [password, setPassword] = useState('Manager@123');
  const [loading, setLoading] = useState(false);

  return (
    <div className="center-screen bg-slate-950 p-4">
      <form
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          try {
            await login(email, password);
            toast.success('Login successful');
            navigate('/');
          } catch {
            toast.error('Invalid login');
          } finally {
            setLoading(false);
          }
        }}
      >
        <h1 className="mb-5 text-xl font-semibold text-white">AI Task Planner Login</h1>
        <label className="mb-2 block text-sm text-slate-300">Email</label>
        <input
          className="mb-4 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="mb-2 block text-sm text-slate-300">Password</label>
        <input
          type="password"
          className="mb-4 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          Use seeded accounts from the README for manager/developer login.
        </p>
      </form>
    </div>
  );
}
