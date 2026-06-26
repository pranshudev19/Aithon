import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Terminal, Lock, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center -mt-16 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div>
          <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
            <Terminal className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            TaskPlanner AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your dashboard
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center font-medium">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="sr-only">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className="input-field pl-10"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="sr-only">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  className="input-field pl-10"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Sign in'}
          </button>
        </form>
        
        <div className="mt-6 border-t border-gray-100 pt-6">
          <p className="text-xs text-center text-gray-500 font-medium">Demo Credentials</p>
          <div className="mt-3 flex flex-col gap-2 text-xs text-gray-600">
            <div className="flex justify-between"><span>Manager:</span> <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">manager@taskplanner.com</span></div>
            <div className="flex justify-between"><span>Dev:</span> <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">alice@taskplanner.com</span></div>
            <div className="text-center mt-2">Password: <span className="font-mono">Manager@123</span> / <span className="font-mono">Dev@123</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
