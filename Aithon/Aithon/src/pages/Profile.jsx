/**
 * Profile Page — shared by both managers and employees.
 * Displays current user info (name, email, role, skills).
 * Simple read-only view as agreed.
 */
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Tag, Calendar } from 'lucide-react';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      padding: '16px 0', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} style={{ color: '#a78bfa' }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, isManager } = useAuth();

  const roleBadge = isManager
    ? { label: 'Manager', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' }
    : { label: 'Employee', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' };

  const initials = (user?.name || user?.username || '?')
    .split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1>My Profile</h1>
        <p className="page-subtitle">Your account information.</p>
      </div>

      <div className="card">
        {/* Avatar + name hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: 'white',
            boxShadow: '0 8px 24px rgba(139,92,246,0.3)',
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {user?.name || user?.username}
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              color: roleBadge.color, background: roleBadge.bg,
              border: `1px solid ${roleBadge.color}30`,
            }}>
              {roleBadge.label}
            </span>
          </div>
        </div>

        {/* Fields */}
        <InfoRow icon={User} label="Full Name" value={user?.name || user?.username} />
        <InfoRow icon={Mail} label="Email Address" value={user?.email} />
        <InfoRow icon={Shield} label="Role" value={isManager ? 'Manager' : 'Employee'} />
        <InfoRow
          icon={Tag}
          label="Skills"
          value={
            Array.isArray(user?.skills) && user.skills.length > 0
              ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {user.skills.map(s => (
                    <span key={s} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
              )
              : '—'
          }
        />
      </div>
    </div>
  );
}
