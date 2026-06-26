/**
 * Employee Task View (Task Planner module)
 * ─────────────────────────────────────────
 * Adapted from TaskPlanner/client/src/pages/DeveloperDashboard.jsx.
 * Uses Socket.IO for real-time task assignments from the manager.
 * Monaco editor replaced with a textarea to avoid heavy bundle; can be
 * swapped back to @monaco-editor/react by changing the import below.
 */
import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { socket } from '../../socket';
import { taskPlannerAPI } from '../../services/api';
import {
  Loader2, Code2, Clock, CheckCircle2, AlertCircle, Save,
} from 'lucide-react';

const STATUS_COLORS = {
  completed: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  in_progress: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
};

function statusStyle(status) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return { color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' };
}

export default function EmployeeTaskView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTasks();

    // Real-time: manager assigned a new subtask
    socket.on('task_assigned', ({ subtask }) => {
      toast.success(`New task assigned: "${subtask.title}"`);
      setTasks(prev => [subtask, ...prev]);
    });

    // Real-time: own update echoed back
    socket.on('task_self_updated', ({ subtask }) => {
      setTasks(prev => prev.map(t => t.id === subtask.id ? { ...t, ...subtask } : t));
      setActiveTask(prev => prev?.id === subtask.id ? { ...prev, ...subtask } : prev);
    });

    return () => {
      socket.off('task_assigned');
      socket.off('task_self_updated');
    };
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await taskPlannerAPI.getMySubtasks();
      const subtasks = data.subtasks || [];
      setTasks(subtasks);
      if (subtasks.length > 0) handleSelect(subtasks[0]);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (task) => {
    setActiveTask(task);
    setCode(task.code_submission || '// Write your implementation here…\n');
  };

  const updateStatus = async (status) => {
    if (!activeTask) return;
    try {
      const { data } = await taskPlannerAPI.updateSubtask(activeTask.id, { status });
      const updated = data.subtask;
      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, status: updated.status } : t));
      setActiveTask(prev => ({ ...prev, status: updated.status }));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const submitCode = async () => {
    if (!activeTask) return;
    setIsSaving(true);
    try {
      const { data } = await taskPlannerAPI.updateSubtask(activeTask.id, { code_submission: code });
      const updated = data.subtask;
      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, code_submission: updated.code_submission } : t));
      toast.success('Code saved and synced to manager');
    } catch {
      toast.error('Failed to save code');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent-purple)' }} />
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: '24px 32px' }}>
      <Toaster position="top-right" />

      <div className="page-header">
        <h1>My Assigned Tasks</h1>
        <p className="page-subtitle">Tasks assigned by your manager — update status and submit your implementation.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, height: 'calc(100vh - 180px)' }}>

        {/* Task list panel */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              <Code2 size={14} style={{ color: 'var(--accent-purple)' }} /> My Tasks
            </div>
            <span style={{
              background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            }}>
              {tasks.filter(t => t.status !== 'completed').length} active
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={36} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13 }}>All caught up!</p>
              </div>
            ) : tasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleSelect(task)}
                style={{
                  padding: 12, borderRadius: 10, cursor: 'pointer',
                  marginBottom: 6,
                  background: activeTask?.id === task.id ? 'rgba(139,92,246,0.12)' : 'transparent',
                  border: `1px solid ${activeTask?.id === task.id ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={statusStyle(task.status)}>{task.status?.replace('_', ' ')}</span>
                  <span>{task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{task.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} /> {task.estimated_hours}h est.
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task detail + code editor */}
        {activeTask ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: '16px 16px 0 0', padding: '20px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  {activeTask.parent_task_title}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 6 }}>
                  {activeTask.title}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {activeTask.description}
                </p>
              </div>
              <div style={{ marginLeft: 20, flexShrink: 0 }}>
                <select
                  value={activeTask.status}
                  onChange={e => updateStatus(e.target.value)}
                  style={{
                    ...statusStyle(activeTask.status),
                    outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    appearance: 'none', paddingRight: 24,
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Code editor */}
            <div style={{
              flex: 1, background: '#0d1117',
              border: '1px solid var(--border-subtle)', borderTop: 'none',
              borderRadius: '0 0 16px 16px',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Code2 size={13} /> implementation
                </span>
                <button
                  onClick={submitCode}
                  disabled={isSaving}
                  style={{
                    background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: 'white',
                    border: 'none', padding: '5px 14px', borderRadius: 6, fontSize: 12,
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? <Loader2 size={12} className="spin" /> : <Save size={12} />} Save &amp; Sync
                </button>
              </div>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  padding: '16px 20px', color: '#e6edf3', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 13, lineHeight: 1.7, resize: 'none', width: '100%',
                  minHeight: 300,
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16,
            color: 'var(--text-muted)',
          }}>
            <AlertCircle size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontSize: 14 }}>Select a task from the list to view details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
