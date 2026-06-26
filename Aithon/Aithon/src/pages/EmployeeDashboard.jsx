/**
 * Employee Dashboard — landing page after employee login.
 * Provides a warm welcome and quick-access cards to all permitted modules.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare, Upload, Bot, GitBranch, FileBarChart, ClipboardList,
  ArrowRight, Zap,
} from 'lucide-react';

const modules = [
  {
    path: '/task-planner/employee',
    icon: CheckSquare,
    title: 'My Tasks',
    description: 'View and work on tasks assigned by your manager in real-time.',
    color: '#8b5cf6',
  },
  {
    path: '/pm/developer',
    icon: ClipboardList,
    title: 'PM Tasks',
    description: 'View project management tasks assigned to you.',
    color: '#06b6d4',
  },
  {
    path: '/upload',
    icon: Upload,
    title: 'Upload Dataset',
    description: 'Upload CSV or JSON datasets for data quality analysis.',
    color: '#10b981',
  },
  {
    path: '/task',
    icon: Bot,
    title: 'Submit Task',
    description: 'Submit a natural-language task to the AI pipeline.',
    color: '#f59e0b',
  },
  {
    path: '/workflow',
    icon: GitBranch,
    title: 'Workflows',
    description: 'Track the execution DAG for your submitted tasks.',
    color: '#ec4899',
  },
  {
    path: '/reports',
    icon: FileBarChart,
    title: 'Reports',
    description: 'Download data quality, governance, and synthetic data reports.',
    color: '#a78bfa',
  },
];

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = (user?.name || user?.username || 'Employee').split(' ')[0];

  return (
    <div className="page">
      {/* Hero greeting */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(6,182,212,0.08))',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 20, padding: '36px 40px', marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(139,92,246,0.3)', flexShrink: 0,
        }}>
          <Zap size={26} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4 }}>
            Welcome back, {firstName} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
            Here are all the modules available to you. Select one to get started.
          </p>
        </div>
      </div>

      {/* Module cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {modules.map(({ path, icon: Icon, title, description, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              textAlign: 'left', padding: '24px', borderRadius: 16,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = color + '66';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${color}18`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: color + '18',
              border: `1px solid ${color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {title}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                {description}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color, fontWeight: 600 }}>
              Open <ArrowRight size={13} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
