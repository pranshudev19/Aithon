/**
 * Manager Dashboard — Project list with stats, quick actions.
 * Connects to global WebSocket for live activity feed.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pmAPI, createGlobalWS } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
    ON_TRACK: '#22c55e',
    AT_RISK: '#f59e0b',
    DELAYED: '#ef4444',
    ACTIVE: '#6366f1',
    COMPLETED: '#10b981',
};

const PRIORITY_DOT = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#22c55e',
};

export default function ManagerDashboard() {
    const [projects, setProjects] = useState([]);
    const [activityFeed, setActivityFeed] = useState([]);
    const [riskAlerts, setRiskAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();
    const wsRef = useRef(null);
    const feedRef = useRef(null);

    useEffect(() => {
        loadAll();

        // Global WebSocket for real-time activity
        wsRef.current = createGlobalWS((msg) => {
            if (msg.event === 'task_status_updated' || msg.event === 'commit_pushed') {
                setActivityFeed(prev => [{
                    ...msg,
                    id: Date.now()
                }, ...prev].slice(0, 50));
                // Refresh project list to update completion %
                pmAPI.listProjects().then(r => setProjects(r.data)).catch(() => { });
            }
        });

        return () => wsRef.current?.close();
    }, []);

    const loadAll = async () => {
        try {
            const [projRes, actRes, riskRes] = await Promise.all([
                pmAPI.listProjects(),
                pmAPI.getActivityFeed(30),
                pmAPI.getRiskAlerts(),
            ]);
            setProjects(projRes.data);
            setActivityFeed(actRes.data.feed || []);
            setRiskAlerts(riskRes.data.risk_alerts || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="pm-loading">
                <div className="pm-spinner" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    const totalTasks = projects.reduce((s, p) => s + (p.total_tasks || 0), 0);
    const completedTasks = projects.reduce((s, p) => s + (p.completed_tasks || 0), 0);

    return (
        <div className="pm-page">
            {/* Header */}
            <div className="pm-header">
                <div>
                    <h1 className="pm-title">Manager Dashboard</h1>
                    <p className="pm-subtitle">Welcome back, <strong>{user?.username}</strong></p>
                </div>
                <button
                    className="pm-btn pm-btn-primary"
                    onClick={() => navigate('/pm/manager/create')}
                >
                    + New Project
                </button>
            </div>

            {/* Stats Row */}
            <div className="pm-stats-row">
                <div className="pm-stat-card">
                    <span className="pm-stat-num">{projects.length}</span>
                    <span className="pm-stat-label">Projects</span>
                </div>
                <div className="pm-stat-card">
                    <span className="pm-stat-num">{totalTasks}</span>
                    <span className="pm-stat-label">Total Tasks</span>
                </div>
                <div className="pm-stat-card">
                    <span className="pm-stat-num" style={{ color: '#22c55e' }}>{completedTasks}</span>
                    <span className="pm-stat-label">Completed</span>
                </div>
                <div className="pm-stat-card">
                    <span className="pm-stat-num" style={{ color: '#f59e0b' }}>{riskAlerts.length}</span>
                    <span className="pm-stat-label">At Risk</span>
                </div>
            </div>

            <div className="pm-main-grid">
                {/* Projects Column */}
                <div className="pm-col-wide">
                    <h2 className="pm-section-title">Projects</h2>
                    {projects.length === 0 ? (
                        <div className="pm-empty-card">
                            <div className="pm-empty-icon">📋</div>
                            <p>No projects yet. Create your first project!</p>
                            <button
                                className="pm-btn pm-btn-primary"
                                onClick={() => navigate('/pm/manager/create')}
                            >
                                + New Project
                            </button>
                        </div>
                    ) : (
                        <div className="pm-project-list">
                            {projects.map(project => (
                                <div
                                    key={project.id}
                                    className="pm-project-card"
                                    onClick={() => navigate(`/pm/manager/projects/${project.id}`)}
                                >
                                    <div className="pm-project-card-header">
                                        <div className="pm-project-card-title">
                                            <span className="pm-project-name">{project.name}</span>
                                            <span
                                                className="pm-status-badge"
                                                style={{ background: `${STATUS_COLORS[project.status] || '#6366f1'}22`, color: STATUS_COLORS[project.status] || '#6366f1' }}
                                            >
                                                {project.status}
                                            </span>
                                        </div>
                                        <div className="pm-project-meta">
                                            <span>{project.total_tasks} tasks</span>
                                            {project.deadline && <span>Due {formatDate(project.deadline)}</span>}
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="pm-progress-wrap">
                                        <div className="pm-progress-bar">
                                            <div
                                                className="pm-progress-fill"
                                                style={{ width: `${project.completion_percentage}%` }}
                                            />
                                        </div>
                                        <span className="pm-progress-pct">{project.completion_percentage}%</span>
                                    </div>

                                    {/* Pipeline status */}
                                    {project.pipeline_status !== 'COMPLETED' && (
                                        <div className="pm-pipeline-badge">
                                            {project.pipeline_status === 'RUNNING' ? (
                                                <span className="pm-pipeline-running">⟳ Pipeline running: {project.pipeline_current_agent}</span>
                                            ) : project.pipeline_status === 'FAILED' ? (
                                                <span className="pm-pipeline-failed">✗ Pipeline failed: {project.pipeline_error?.substring(0, 50)}</span>
                                            ) : (
                                                <span className="pm-pipeline-pending">○ Pipeline pending</span>
                                            )}
                                        </div>
                                    )}

                                    {/* At-risk indicator */}
                                    {project.at_risk_tasks > 0 && (
                                        <div className="pm-risk-indicator">
                                            ⚠ {project.at_risk_tasks} task{project.at_risk_tasks > 1 ? 's' : ''} at risk
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar: Activity + Risk */}
                <div className="pm-col-narrow">
                    {/* Risk Alerts */}
                    {riskAlerts.length > 0 && (
                        <div className="pm-panel">
                            <h3 className="pm-panel-title">⚠ Risk Alerts</h3>
                            <div className="pm-alert-list">
                                {riskAlerts.slice(0, 5).map(task => (
                                    <div key={task.id} className="pm-alert-item">
                                        <span className="pm-alert-ref">{task.task_ref}</span>
                                        <span className="pm-alert-title">{task.title}</span>
                                        {task.deadline && (
                                            <span className="pm-alert-due">Due {formatDate(task.deadline)}</span>
                                        )}
                                        {!task.assigned_to && (
                                            <span className="pm-alert-unassigned">Unassigned</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activity Feed */}
                    <div className="pm-panel">
                        <h3 className="pm-panel-title">Activity Feed</h3>
                        <div className="pm-feed-list" ref={feedRef}>
                            {activityFeed.length === 0 ? (
                                <p className="pm-feed-empty">No activity yet.</p>
                            ) : (
                                activityFeed.map((item, i) => (
                                    <div key={item.id || i} className="pm-feed-item">
                                        <div className="pm-feed-icon">
                                            {item.type === 'commit' || item.event === 'commit_pushed' ? '⬡' : '↻'}
                                        </div>
                                        <div className="pm-feed-body">
                                            <span className="pm-feed-dev">{item.developer}</span>
                                            {' '}
                                            {item.event === 'commit_pushed' || item.type === 'commit'
                                                ? `pushed commit "${item.message?.substring(0, 40)}"`
                                                : `updated ${item.task_ref} → ${item.new_status}`
                                            }
                                            {item.task_ref && (
                                                <span className="pm-feed-ref"> → {item.task_ref}</span>
                                            )}
                                            <div className="pm-feed-time">{formatTime(item.timestamp)}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
