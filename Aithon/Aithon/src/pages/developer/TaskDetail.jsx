/**
 * Task Detail — Developer view: subtask checklist, status updates, commit entry.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pmAPI } from '../../services/api';

const PRIORITY_COLORS = {
    HIGH: { bg: '#fee2e2', text: '#dc2626' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706' },
    LOW: { bg: '#dcfce7', text: '#16a34a' },
};

export default function TaskDetail() {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commitMsg, setCommitMsg] = useState('');
    const [commitRef, setCommitRef] = useState('');
    const [submittingCommit, setSubmittingCommit] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [completingSubtask, setCompletingSubtask] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    const loadTask = async () => {
        try {
            const res = await pmAPI.getTaskDetail(taskId);
            setTask(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTask(); }, [taskId]);

    const handleStatusUpdate = async () => {
        const next = task.status === 'PENDING' ? 'IN_PROGRESS'
            : task.status === 'IN_PROGRESS' ? 'COMPLETED' : null;
        if (!next) return;
        setUpdatingStatus(true);
        try {
            await pmAPI.updateTaskStatus(taskId, next);
            await loadTask();
            setSuccessMsg(`Status updated to ${next}`);
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleCompleteSubtask = async (subtaskId) => {
        setCompletingSubtask(subtaskId);
        try {
            await pmAPI.completeSubtask(taskId, subtaskId);
            await loadTask();
        } catch (e) {
            console.error(e);
        } finally {
            setCompletingSubtask(null);
        }
    };

    const handleCommit = async (e) => {
        e.preventDefault();
        if (!commitMsg.trim()) return;
        setSubmittingCommit(true);
        try {
            await pmAPI.addCommit(taskId, { message: commitMsg.trim(), file_ref: commitRef.trim() || null });
            setCommitMsg('');
            setCommitRef('');
            await loadTask();
            setSuccessMsg('Commit recorded!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmittingCommit(false);
        }
    };

    if (loading) {
        return <div className="pm-loading"><div className="pm-spinner" /><p>Loading task...</p></div>;
    }
    if (!task) {
        return <div className="pm-page"><p>Task not found.</p></div>;
    }

    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM;
    const subtasks = task.subtasks || [];
    const doneCount = subtasks.filter(s => s.status === 'COMPLETED').length;
    const subtaskPct = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;

    const nextStatusLabel = task.status === 'PENDING' ? 'Start Task'
        : task.status === 'IN_PROGRESS' ? 'Mark as Completed' : null;

    return (
        <div className="pm-page">
            <div className="pm-header">
                <div>
                    <button className="pm-back-btn" onClick={() => navigate('/pm/developer')}>← My Tasks</button>
                    <h1 className="pm-title">
                        <span className="pm-task-ref-lg">{task.task_ref}</span> {task.title}
                    </h1>
                </div>
                <div className="pm-task-detail-badges">
                    <span className="pm-priority-badge pm-priority-badge-lg" style={{ background: pc.bg, color: pc.text }}>
                        {task.priority}
                    </span>
                    {task.risk_flag && <span className="pm-risk-chip">⚠ At Risk</span>}
                    <span className={`pm-status-badge pm-status-${task.status}`}>
                        {task.status}
                    </span>
                </div>
            </div>

            {successMsg && <div className="pm-success-toast">{successMsg}</div>}

            <div className="pm-taskdetail-grid">
                {/* Main Column */}
                <div className="pm-taskdetail-main">
                    {/* Task info */}
                    <div className="pm-panel">
                        <h3 className="pm-panel-title">Task Info</h3>
                        <div className="pm-info-grid">
                            {task.deadline && <div className="pm-info-item"><span className="pm-info-label">Deadline</span><span>{task.deadline}</span></div>}
                            {task.start_date && <div className="pm-info-item"><span className="pm-info-label">Start Date</span><span>{task.start_date}</span></div>}
                            <div className="pm-info-item"><span className="pm-info-label">Effort</span><span>{task.estimated_effort}</span></div>
                            <div className="pm-info-item"><span className="pm-info-label">Priority Score</span><span>{task.priority_score?.toFixed(0)}/100</span></div>
                        </div>
                        {task.description && <p className="pm-task-desc">{task.description}</p>}

                        {nextStatusLabel && (
                            <button
                                className={`pm-btn pm-btn-full ${task.status === 'PENDING' ? 'pm-btn-secondary' : 'pm-btn-success'}`}
                                onClick={handleStatusUpdate}
                                disabled={updatingStatus}
                            >
                                {updatingStatus ? 'Updating...' : nextStatusLabel}
                            </button>
                        )}
                    </div>

                    {/* Subtasks */}
                    <div className="pm-panel">
                        <div className="pm-panel-head">
                            <h3 className="pm-panel-title">Subtasks</h3>
                            <span className="pm-subtask-count">{doneCount}/{subtasks.length}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="pm-progress-wrap pm-progress-md">
                            <div className="pm-progress-bar">
                                <div className="pm-progress-fill" style={{ width: `${subtaskPct}%` }} />
                            </div>
                            <span className="pm-progress-pct">{subtaskPct}%</span>
                        </div>
                        <div className="pm-subtask-list">
                            {subtasks.map(sub => (
                                <div key={sub.id} className={`pm-subtask-item ${sub.status === 'COMPLETED' ? 'pm-subtask-done' : ''}`}>
                                    <button
                                        className={`pm-subtask-check ${sub.status === 'COMPLETED' ? 'pm-subtask-check-done' : ''}`}
                                        onClick={() => sub.status !== 'COMPLETED' && handleCompleteSubtask(sub.id)}
                                        disabled={sub.status === 'COMPLETED' || completingSubtask === sub.id}
                                    >
                                        {sub.status === 'COMPLETED' ? '✓' : (completingSubtask === sub.id ? '…' : '')}
                                    </button>
                                    <span className="pm-subtask-title">{sub.title}</span>
                                    {sub.completed_at && (
                                        <span className="pm-subtask-time">
                                            {new Date(sub.completed_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Commit Entry */}
                    <div className="pm-panel">
                        <h3 className="pm-panel-title">Log Code Commit</h3>
                        <form onSubmit={handleCommit} className="pm-commit-form">
                            <input
                                className="pm-input"
                                placeholder="feat: implement JWT login endpoint"
                                value={commitMsg}
                                onChange={e => setCommitMsg(e.target.value)}
                            />
                            <input
                                className="pm-input"
                                placeholder="Branch / file (optional)"
                                value={commitRef}
                                onChange={e => setCommitRef(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="pm-btn pm-btn-primary"
                                disabled={submittingCommit || !commitMsg.trim()}
                            >
                                {submittingCommit ? 'Recording...' : '⬡ Record Commit'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Commits Sidebar */}
                <div className="pm-taskdetail-side">
                    <div className="pm-panel">
                        <h3 className="pm-panel-title">Commit History</h3>
                        <div className="pm-commit-list">
                            {(task.commits || []).length === 0 ? (
                                <p className="pm-feed-empty">No commits yet.</p>
                            ) : (
                                (task.commits || []).map(c => (
                                    <div key={c.id} className="pm-commit-item">
                                        <div className="pm-commit-icon">⬡</div>
                                        <div className="pm-commit-body">
                                            <span className="pm-commit-msg">{c.message}</span>
                                            {c.file_ref && <span className="pm-commit-ref">{c.file_ref}</span>}
                                            <span className="pm-commit-time">
                                                {c.timestamp ? new Date(c.timestamp).toLocaleString([], {
                                                    month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                }) : ''}
                                            </span>
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
