/**
 * Developer Dashboard — "My Tasks" view with priority ordering.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pmAPI, createGlobalWS } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PRIORITY_COLORS = {
    HIGH: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
    LOW: { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },
};

const STATUS_LABEL = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    BLOCKED: 'Blocked',
};

export default function DeveloperDashboard() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();
    const wsRef = useRef(null);

    const loadTasks = async () => {
        try {
            const res = await pmAPI.getMyTasks();
            setTasks(res.data.tasks || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
        // Listen for any updates (e.g., re-assignments)
        wsRef.current = createGlobalWS((msg) => {
            if (msg.event === 'task_status_updated') {
                loadTasks();
            }
        });
        return () => wsRef.current?.close();
    }, []);

    const handleStatusUpdate = async (taskId, currentStatus) => {
        const next = currentStatus === 'PENDING' ? 'IN_PROGRESS'
            : currentStatus === 'IN_PROGRESS' ? 'COMPLETED'
                : null;
        if (!next) return;

        setUpdatingId(taskId);
        try {
            await pmAPI.updateTaskStatus(taskId, next);
            await loadTasks();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) {
        return <div className="pm-loading"><div className="pm-spinner" /><p>Loading tasks...</p></div>;
    }

    const pending = tasks.filter(t => t.status === 'PENDING');
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS');
    const completed = tasks.filter(t => t.status === 'COMPLETED');

    return (
        <div className="pm-page">
            <div className="pm-header">
                <div>
                    <h1 className="pm-title">My Tasks</h1>
                    <p className="pm-subtitle">Welcome, <strong>{user?.username}</strong> — {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="pm-stats-row">
                <div className="pm-stat-card">
                    <span className="pm-stat-num">{tasks.length}</span>
                    <span className="pm-stat-label">Total</span>
                </div>
                <div className="pm-stat-card">
                    <span className="pm-stat-num" style={{ color: '#f59e0b' }}>{inProgress.length}</span>
                    <span className="pm-stat-label">In Progress</span>
                </div>
                <div className="pm-stat-card">
                    <span className="pm-stat-num" style={{ color: '#ef4444' }}>
                        {tasks.filter(t => t.risk_flag).length}
                    </span>
                    <span className="pm-stat-label">At Risk</span>
                </div>
                <div className="pm-stat-card">
                    <span className="pm-stat-num" style={{ color: '#22c55e' }}>{completed.length}</span>
                    <span className="pm-stat-label">Done</span>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="pm-empty-card">
                    <div className="pm-empty-icon">🎉</div>
                    <p>No tasks assigned to you yet. Check back later!</p>
                </div>
            ) : (
                <div className="pm-dev-task-list">
                    {tasks.map(task => {
                        const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM;
                        const isUpdating = updatingId === task.id;
                        const nextLabel = task.status === 'PENDING' ? 'Start Task'
                            : task.status === 'IN_PROGRESS' ? 'Mark Complete' : null;

                        return (
                            <div
                                key={task.id}
                                className={`pm-dev-task-card ${task.risk_flag ? 'pm-dev-task-risk' : ''}`}
                                style={{ borderLeft: `4px solid ${pc.border}` }}
                            >
                                <div className="pm-dev-task-head">
                                    <div className="pm-dev-task-title-row">
                                        <span className="pm-task-ref">{task.task_ref}</span>
                                        <span className="pm-priority-badge" style={{ background: pc.bg, color: pc.text }}>
                                            {task.priority}
                                        </span>
                                        {task.risk_flag && <span className="pm-risk-chip-sm">⚠ At Risk</span>}
                                    </div>
                                    <h3
                                        className="pm-dev-task-title"
                                        onClick={() => navigate(`/pm/developer/tasks/${task.id}`)}
                                    >
                                        {task.title}
                                    </h3>
                                </div>

                                <div className="pm-dev-task-meta">
                                    {task.deadline && (
                                        <span className="pm-meta-item">📅 Due: {task.deadline}</span>
                                    )}
                                    <span className="pm-meta-item">⚡ {task.estimated_effort}</span>
                                    <span className={`pm-status-badge pm-status-${task.status}`}>
                                        {STATUS_LABEL[task.status]}
                                    </span>
                                </div>

                                {/* Subtask progress bar */}
                                {task.subtask_progress !== '0/0' && (
                                    <div className="pm-dev-progress">
                                        <div className="pm-progress-bar">
                                            <div
                                                className="pm-progress-fill"
                                                style={{ width: `${task.subtask_percent}%` }}
                                            />
                                        </div>
                                        <span className="pm-sub-label">{task.subtask_progress} subtasks</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="pm-dev-task-actions">
                                    <button
                                        className="pm-btn pm-btn-outline"
                                        onClick={() => navigate(`/pm/developer/tasks/${task.id}`)}
                                    >
                                        View Details
                                    </button>
                                    {nextLabel && task.status !== 'COMPLETED' && (
                                        <button
                                            className={`pm-btn ${task.status === 'PENDING' ? 'pm-btn-secondary' : 'pm-btn-success'}`}
                                            onClick={() => handleStatusUpdate(task.id, task.status)}
                                            disabled={isUpdating}
                                        >
                                            {isUpdating ? '...' : nextLabel}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
