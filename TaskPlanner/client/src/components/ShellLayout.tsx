import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export default function ShellLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-slate-400">
              {user?.name} ({user?.role})
            </p>
          </div>
          <button
            className="rounded bg-rose-600 px-3 py-1 text-sm hover:bg-rose-500"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
