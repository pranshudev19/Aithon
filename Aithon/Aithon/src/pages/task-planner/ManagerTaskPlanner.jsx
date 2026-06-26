/**
 * Manager Task Planner Page
 * ─────────────────────────
 * Adapted from TaskPlanner/client/src/pages/ManagerDashboard.jsx.
 * Uses the Node.js gateway for API calls and Socket.IO for real-time updates.
 * Embedded inside the Aithon unified layout (no extra shell needed).
 */
import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { socket } from '../../socket';
import { taskPlannerAPI } from '../../services/api';
import {
  Loader2, Zap, Send, FileCode2, Clock, CheckCircle2,
  AlertCircle, RefreshCw,
} from 'lucide-react';

const STATUS_STYLES = {
  completed: 'color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25)',
  in_progress: 'color:#06b6d4;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25)',
  pending: 'color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25)',
};

function StatusBadge({ status }) {
  return (
    <span style={{
      ...Object.fromEntries(
        STATUS_STYLES[status]?.split(';').filter(Boolean).map(s => s.split(':').map(p => p.trim())) || []
      ),
      fontSize: 10, fontWeight: 700,
      padding: '3px 8px', borderRadius: 20,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      display: 'inline-block',
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
}

export default function ManagerTaskPlanner() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  useEffect(() => {
    fetchTasks();

    // Real-time: employee updated a subtask → refresh card in place
    socket.on('task_updated', ({ subtask }) => {
      toast.success(`"${subtask.title}" updated by employee`);
      setTasks(prev =>
        prev.map(t => {
          if (t.id === subtask.task_id) {
            return {
              ...t,
              subtasks: t.subtasks.map(st => st.id === subtask.id ? { ...st, ...subtask } : st),
            };
          }
          return t;
        })
      );
    });

    // Real-time: new task was just created (echo)
    socket.on('manager_task_created', ({ task, subtasks }) => {
      setTasks(prev => {
        const exists = prev.find(t => t.id === task.id);
        if (exists) return prev;
        return [{ id: task.id, title: task.title, description: task.description, subtasks }, ...prev];
      });
    });

    return () => {
      socket.off('task_updated');
      socket.off('manager_task_created');
    };
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await taskPlannerAPI.getManagerSubtasks();
      const subtasks = data.subtasks || [];
      const taskMap = {};
      subtasks.forEach(st => {
        if (!taskMap[st.task_id]) {
          taskMap[st.task_id] = {
            id: st.task_id,
            title: st.parent_task_title,
            description: st.parent_task_description,
            subtasks: [],
          };
        }
        taskMap[st.task_id].subtasks.push(st);
      });
      setTasks(Object.values(taskMap));
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setIsSubmitting(true);
    const tid = toast.loading('AI is decomposing task and finding best employees…');
    try {
      const { data } = await taskPlannerAPI.createTask({ title, description });
      toast.success('Task decomposed and assigned!', { id: tid });
      setTasks(prev => [{
        id: data.task.id,
        title: data.task.title,
        description: data.task.description,
        subtasks: data.subtasks || [],
      }, ...prev]);
      setTitle('');
      setDescription('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task', { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Toaster position="top-right" />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>AI Task Planner</h1>
          <p className="page-subtitle">Describe a high-level objective — AI decomposes and assigns to employees.</p>
        </div>
        <button className="btn btn--secondary" onClick={fetchTasks} style={{ gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Create Task Form */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="white" />
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Create New Task</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>High-Level Objective</label>
            <input
              className="text-input"
              placeholder="e.g. Build an e-commerce checkout flow…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Detailed Description &amp; Requirements</label>
            <textarea
              className="task-textarea"
              placeholder="Describe the features, business logic, endpoints, or UI pieces required…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isSubmitting || !title || !description}
              className="btn btn--primary"
            >
              {isSubmitting
                ? <><Loader2 size={16} className="spin" /> Processing…</>
                : <><Send size={16} /> Auto-Decompose &amp; Assign</>}
            </button>
          </div>
        </form>
      </div>

      {/* Task List */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
        Project Backlog
      </h2>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--accent-purple)' }} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <AlertCircle size={48} style={{ opacity: 0.3 }} />
          <p>No tasks yet. Create one above to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tasks.map(task => (
            <div key={task.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              >
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {task.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                    {task.description}
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  fontSize: 12, fontWeight: 600, color: '#a78bfa',
                  whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 16,
                }}>
                  <FileCode2 size={13} />
                  {task.subtasks?.length || 0} Subtasks
                </div>
              </div>

              {expandedTask === task.id && (
                <div style={{
                  borderTop: '1px solid var(--border-subtle)',
                  padding: '20px 24px',
                  background: 'rgba(0,0,0,0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <Clock size={14} /> AI-Generated Subtasks
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {task.subtasks?.map(st => (
                      <div key={st.id} style={{
                        background: 'rgba(15,15,35,0.6)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 12, padding: 16,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <StatusBadge status={st.status} />
                          <span style={{ fontSize: 14 }}>
                            {st.priority === 'high' ? '🔴' : st.priority === 'medium' ? '🟡' : '🟢'}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>
                          {st.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Assigned to: <span style={{ color: '#a78bfa', fontWeight: 600 }}>{st.developer_name || 'Unassigned'}</span>
                        </div>
                        {st.code_submission && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                              <CheckCircle2 size={12} /> Submitted Code
                            </div>
                            <pre style={{
                              background: '#0d1117', borderRadius: 8, padding: 12,
                              fontSize: 11, color: '#7ee787', fontFamily: 'monospace',
                              overflowX: 'auto', maxHeight: 120, lineHeight: 1.5,
                            }}>
                              <code>{st.code_submission}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
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
