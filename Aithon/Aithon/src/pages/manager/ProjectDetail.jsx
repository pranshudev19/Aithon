/**
 * Project Detail — Kanban board + activity feed + risk alerts for a single project.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pmAPI, createProjectWS } from '../../services/api';

const PRIORITY_COLORS = {
    HIGH: { bg: '#fee2e2', text: '#dc2626' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706' },
    LOW: { bg: '#dcfce7', text: '#16a34a' },
};

const KANBAN_COLS = [
    { key: 'PENDING', label: 'Pending', icon: '○' },
    { key: 'IN_PROGRESS', label: 'In Progress', icon: '⟳' },
    { key: 'COMPLETED', label: 'Completed', icon: '✓' },
];

function TaskCard({ task }) {
    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM;
    return (
        <div className={`pm-kanban-card ${task.risk_flag ? 'pm-kanban-card-risk' : ''}`}>
            <div className="pm-kanban-card-head">
                <span className="pm-task-ref">{task.task_ref}</span>
                <span className="pm-priority-badge" style={{ background: pc.bg, color: pc.text }}>
                    {task.priority}
                </span>
            </div>
            <div className="pm-kanban-card-title">{task.title}</div>
            <div className="pm-kanban-card-meta">
                <span className="pm-kanban-dev">👤 {task.developer_name}</span>
                {task.deadline && <span className="pm-kanban-due">📅 {task.deadline}</span>}
            </div>
            {task.subtask_progress !== '0/0' && (
                <div className="pm-kanban-subtask-bar">
                    <div className="pm-sub-progress">
                        <div
                            className="pm-sub-progress-fill"
                            style={{ width: `${task.subtask_percent}%` }}
                        />
                    </div>
                    <span className="pm-sub-label">{task.subtask_progress}</span>
                </div>
            )}
            {task.risk_flag && (
                <div className="pm-risk-tag">⚠ At Risk</div>
            )}
        </div>
    );
}

export default function ProjectDetail() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const wsRef = useRef(null);

    const loadProject = async () => {
        try {
            const res = await pmAPI.getProject(projectId);
            setProject(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProject();
        // Load activity feed
        pmAPI.getActivityFeed(50).then(r => {
            const projectFeed = (r.data.feed || []).filter(f => f.task_ref);
            setFeed(projectFeed.slice(0, 20));
        }).catch(() => { });

        wsRef.current = createProjectWS(projectId, (msg) => {
            if (['task_status_updated', 'commit_pushed'].includes(msg.event)) {
                setFeed(prev => [{ ...msg, id: Date.now() }, ...prev].slice(0, 30));
                loadProject();
            }
        });

        return () => wsRef.current?.close();
    }, [projectId]);

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return <div className="pm-loading"><div className="pm-spinner" /><p>Loading project...</p></div>;
    }

    if (!project) {
        return <div className="pm-page"><p>Project not found.</p></div>;
    }

    const kanban = project.kanban || { PENDING: [], IN_PROGRESS: [], COMPLETED: [], BLOCKED: [] };
    const riskTasks = [...(kanban.PENDING || []), ...(kanban.IN_PROGRESS || [])].filter(t => t.risk_flag);

    return (
        <div className="pm-page">
            {/* Header */}
            <div className="pm-header">
                <div>
                    <button className="pm-back-btn" onClick={() => navigate('/pm/manager')}>← Back</button>
                    <h1 className="pm-title">{project.name}</h1>
                    <p className="pm-subtitle">{project.description?.substring(0, 120)}</p>
                </div>
                <div className="pm-project-header-right">
                    <div className="pm-progress-wrap pm-progress-large">
                        <div className="pm-progress-bar">
                            <div className="pm-progress-fill" style={{ width: `${project.completion_percentage}%` }} />
                        </div>
                        <span className="pm-progress-pct">{project.completion_percentage}%</span>
                    </div>
                    <span className={`pm-status-badge pm-status-badge-lg pm-status-${project.status}`}>
                        {project.status}
                    </span>
                </div>
            </div>

            {/* Risk alerts */}
            {riskTasks.length > 0 && (
                <div className="pm-risk-banner">
                    <strong>⚠ Risk Alerts:</strong>{' '}
                    {riskTasks.map(t => (
                        <span key={t.id} className="pm-risk-chip">
                            {t.task_ref} — {t.title?.substring(0, 40)} {t.assigned_to ? '' : '(Unassigned)'}
                        </span>
                    ))}
                </div>
            )}

            <div className="pm-detail-grid">
                {/* Kanban Board */}
                <div className="pm-kanban-wrap">
                    <h2 className="pm-section-title">Task Board</h2>
                    <div className="pm-kanban-board">
                        {KANBAN_COLS.map(col => (
                            <div key={col.key} className="pm-kanban-col">
                                <div className="pm-kanban-col-header">
                                    <span className="pm-kanban-col-icon">{col.icon}</span>
                                    <span className="pm-kanban-col-label">{col.label}</span>
                                    <span className="pm-kanban-col-count">{(kanban[col.key] || []).length}</span>
                                </div>
                                <div className="pm-kanban-cards">
                                    {(kanban[col.key] || []).length === 0 ? (
                                        <div className="pm-kanban-empty">No tasks</div>
                                    ) : (
                                        (kanban[col.key] || []).map(task => (
                                            <TaskCard key={task.id} task={task} />
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="pm-side-panel">
                    <h2 className="pm-section-title">Activity Feed</h2>
                    <div className="pm-feed-list pm-feed-list-tall">
                        {feed.length === 0 ? (
                            <p className="pm-feed-empty">No activity yet. Developers will appear here as they work.</p>
                        ) : (
                            feed.map((item, i) => (
                                <div key={item.id || i} className="pm-feed-item">
                                    <div className="pm-feed-icon">
                                        {item.event === 'commit_pushed' || item.type === 'commit' ? '⬡' : '↻'}
                                    </div>
                                    <div className="pm-feed-body">
                                        <span className="pm-feed-dev">{item.developer}</span>
                                        {' '}
                                        {item.event === 'commit_pushed' || item.type === 'commit'
                                            ? `pushed "${item.message?.substring(0, 50)}"`
                                            : `updated ${item.task_ref} → ${item.new_status}`
                                        }
                                        <div className="pm-feed-time">{formatTime(item.timestamp)}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
