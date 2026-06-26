/**
 * Sidebar navigation — role-aware unified platform nav.
 *
 * Manager sees: Task Planner, PM Dashboard, Data Governance, Analytics,
 *               Employee Management, Profile
 * Employee sees: Employee Dashboard, Data Governance, My PM Tasks, Profile
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Upload, Bot, GitBranch, FileBarChart,
  LogOut, ChevronLeft, ChevronRight, Zap, FolderKanban,
  ClipboardList, CheckSquare, Users, User, BarChart2, Home,
} from 'lucide-react';

// ─── Nav definitions ─────────────────────────────────────────────────────────

const managerNav = [
  {
    section: 'Task Planner',
    items: [
      { path: '/task-planner', icon: CheckSquare, label: 'Task Planner' },
    ],
  },
  {
    section: 'Project Management',
    items: [
      { path: '/pm/manager', icon: FolderKanban, label: 'PM Dashboard' },
      { path: '/pm/manager/create', icon: Bot, label: 'New Project' },
    ],
  },
  {
    section: 'Data Governance',
    items: [
      { path: '/analytics', icon: BarChart2, label: 'Analytics' },
      { path: '/upload', icon: Upload, label: 'Upload Dataset' },
      { path: '/task', icon: Bot, label: 'Submit Task' },
      { path: '/workflow', icon: GitBranch, label: 'Workflows' },
      { path: '/reports', icon: FileBarChart, label: 'Reports' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { path: '/employees', icon: Users, label: 'Employees' },
      { path: '/profile', icon: User, label: 'Profile' },
    ],
  },
];

const employeeNav = [
  {
    section: 'Overview',
    items: [
      { path: '/employee-dashboard', icon: Home, label: 'My Dashboard' },
      { path: '/task-planner/employee', icon: CheckSquare, label: 'My Tasks' },
    ],
  },
  {
    section: 'PM Tasks',
    items: [
      { path: '/pm/developer', icon: ClipboardList, label: 'PM Tasks' },
    ],
  },
  {
    section: 'Data Governance',
    items: [
      { path: '/upload', icon: Upload, label: 'Upload Dataset' },
      { path: '/task', icon: Bot, label: 'Submit Task' },
      { path: '/workflow', icon: GitBranch, label: 'Workflows' },
      { path: '/reports', icon: FileBarChart, label: 'Reports' },
    ],
  },
  {
    section: 'Account',
    items: [
      { path: '/profile', icon: User, label: 'Profile' },
    ],
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const navLinkStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 12px',
  borderRadius: '10px',
  textDecoration: 'none',
  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
  background: isActive
    ? 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.15))'
    : 'transparent',
  transition: 'all 0.2s ease',
  fontSize: '13px',
  fontWeight: isActive ? 600 : 400,
  whiteSpace: 'nowrap',
  border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
});

function SectionLabel({ label, collapsed }) {
  if (collapsed) return <div style={{ height: 12 }} />;
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      color: 'rgba(255,255,255,0.25)', padding: '14px 12px 4px',
      textTransform: 'uppercase',
    }}>
      {label}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navSections = isManager ? managerNav : employeeNav;
  const roleBadgeColor = isManager ? '#8b5cf6' : '#06b6d4';
  const roleLabel = isManager ? 'Manager' : 'Employee';

  return (
    <aside style={{
      width: collapsed ? '72px' : '260px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #0f0f23 50%, #0a0a1a 100%)',
      borderRight: '1px solid rgba(139,92,246,0.12)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100,
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
        }}>
          <Zap size={20} color="white" />
        </div>
        {!collapsed && (
          <div>
            <span style={{
              fontSize: 18, fontWeight: 700,
              background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              display: 'block', whiteSpace: 'nowrap',
            }}>
              Aithon
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: roleBadgeColor, letterSpacing: '0.08em' }}>
              {roleLabel}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1, padding: '8px 8px',
        display: 'flex', flexDirection: 'column', gap: '0px',
        overflowY: 'auto',
      }}>
        {navSections.map(({ section, items }) => (
          <div key={section}>
            <SectionLabel label={section} collapsed={collapsed} />
            {items.map(({ path, icon: Icon, label }) => (
              <NavLink key={path} to={path} style={({ isActive }) => navLinkStyle(isActive)}>
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer: user info + logout + collapse */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(139,92,246,0.1)', flexShrink: 0 }}>
        {!collapsed && user && (
          <div style={{
            padding: '10px 12px', marginBottom: '8px',
            borderRadius: '10px',
            background: 'rgba(139,92,246,0.07)',
            border: '1px solid rgba(139,92,246,0.1)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {user.name || user.username || user.email}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {user.email}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px', borderRadius: '10px', width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: '13px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!collapsed && 'Logout'}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px', borderRadius: '8px', width: '100%',
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.12)',
            cursor: 'pointer', color: 'rgba(255,255,255,0.4)', marginTop: '6px',
            transition: 'all 0.2s',
          }}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
