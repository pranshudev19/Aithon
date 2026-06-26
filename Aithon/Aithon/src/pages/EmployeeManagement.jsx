/**
 * Employee Management — Manager-only page.
 * Shows all employees (developers) with their active task workload.
 * Data from /api/aithon/pm/developers (FastAPI endpoint).
 */
import { useState, useEffect } from 'react';
import { pmAPI } from '../services/api';
import { Users, Loader2, CheckCircle, AlertCircle, Tag } from 'lucide-react';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    pmAPI.getDevelopers()
      .then(({ data }) => setEmployees(data.developers || []))
      .catch(() => setError('Failed to load employee list'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Employee Management</h1>
          <p className="page-subtitle">Overview of all employees and their current workload.</p>
        </div>
        <div style={{
          padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
          background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
          border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Users size={14} /> {employees.length} Employees
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--accent-purple)' }} />
        </div>
      )}

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 24 }}>
          <AlertCircle size={16} />
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && employees.length === 0 && (
        <div className="empty-state">
          <Users size={48} style={{ opacity: 0.2 }} />
          <p>No employees found. Employees appear here once registered.</p>
        </div>
      )}

      {!loading && employees.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {employees.map(emp => (
            <div key={emp.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0,
                }}>
                  {(emp.username || emp.email || '?')[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {emp.username || emp.email}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.email}
                  </div>
                </div>
              </div>

              {/* Workload */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                background: emp.active_tasks > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                border: `1px solid ${emp.active_tasks > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
              }}>
                {emp.active_tasks > 0
                  ? <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  : <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: emp.active_tasks > 0 ? '#f59e0b' : '#10b981' }}>
                  {emp.active_tasks > 0 ? `${emp.active_tasks} active task(s)` : 'Available'}
                </span>
              </div>

              {/* Skills */}
              {Array.isArray(emp.skills) && emp.skills.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <Tag size={10} /> Skills
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {emp.skills.slice(0, 5).map(s => (
                      <span key={s} style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                        border: '1px solid rgba(139,92,246,0.2)',
                      }}>
                        {s}
                      </span>
                    ))}
                    {emp.skills.length > 5 && (
                      <span style={{ padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
                        +{emp.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
