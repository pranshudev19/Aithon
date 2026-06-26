/**
 * Workflow View Page
 * DAG visualization with real-time status polling and node details.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { taskAPI } from '../services/api';
import { GitBranch, RefreshCw, Clock, CheckCircle, XCircle, Loader, ArrowRight } from 'lucide-react';
import { extractApiError } from '../services/errorUtils';

const STATUS_CONFIG = {
    PENDING: { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: Clock, label: 'Pending' },
    RUNNING: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', icon: Loader, label: 'Running' },
    COMPLETED: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle, label: 'Completed' },
    FAILED: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: XCircle, label: 'Failed' },
};

export default function WorkflowView() {
    const [searchParams] = useSearchParams();
    const [taskId, setTaskId] = useState(searchParams.get('task') || '');
    const [taskData, setTaskData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [polling, setPolling] = useState(false);

    const fetchTask = useCallback(async (id) => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await taskAPI.getStatus(id);
            setTaskData(res.data);

            // Auto-poll if running
            if (res.data.status === 'RUNNING') {
                setPolling(true);
            } else {
                setPolling(false);
            }
        } catch (err) {
            setError(extractApiError(err, 'Failed to load task'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const id = searchParams.get('task');
        if (id) {
            setTaskId(id);
            fetchTask(id);
        }
    }, [searchParams, fetchTask]);

    // Polling interval
    useEffect(() => {
        if (!polling || !taskId) return;
        const interval = setInterval(() => fetchTask(taskId), 3000);
        return () => clearInterval(interval);
    }, [polling, taskId, fetchTask]);

    return (
        <div className="page">
            <div className="page-header">
                <h1>Workflow Monitor</h1>
                <p className="page-subtitle">Track DAG execution in real-time</p>
            </div>

            {/* Task ID Input */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <input
                        type="text"
                        value={taskId}
                        onChange={(e) => setTaskId(e.target.value)}
                        placeholder="Enter Task ID..."
                        className="text-input"
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn--primary" onClick={() => fetchTask(taskId)} disabled={loading}>
                        {loading ? <span className="spinner spinner--small" /> : <RefreshCw size={18} />}
                        Load
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert--error">
                    <XCircle size={20} /> <span>{error}</span>
                </div>
            )}

            {taskData && (
                <>
                    {/* Task Info */}
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                                <h3 style={{ marginBottom: 8 }}>{taskData.description}</h3>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <span className={`badge badge--${taskData.status.toLowerCase()}`}>{taskData.status}</span>
                                    {taskData.intent && <span className="badge badge--purple">{taskData.intent}</span>}
                                </div>
                            </div>
                            {polling && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#06b6d4', fontSize: 13 }}>
                                    <span className="spinner spinner--small" /> Live
                                </div>
                            )}
                        </div>
                        {taskData.error_message && (
                            <div className="alert alert--error" style={{ marginTop: 16 }}>
                                <XCircle size={16} /> {taskData.error_message}
                            </div>
                        )}
                    </div>

                    {/* DAG Visualization */}
                    {taskData.dag && (
                        <div className="card">
                            <h3><GitBranch size={20} style={{ marginRight: 8 }} />Execution Pipeline</h3>
                            <div className="dag-visualization">
                                {taskData.dag.nodes.map((node, i) => {
                                    const config = STATUS_CONFIG[node.status] || STATUS_CONFIG.PENDING;
                                    const Icon = config.icon;
                                    return (
                                        <div key={node.id} style={{ display: 'flex', alignItems: 'center' }}>
                                            <div className="workflow-node" style={{
                                                borderColor: config.color,
                                                background: config.bg,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <Icon size={20} color={config.color}
                                                        className={node.status === 'RUNNING' ? 'spin' : ''} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>
                                                            {node.label}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: config.color, marginTop: 2 }}>
                                                            {config.label}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {i < taskData.dag.nodes.length - 1 && (
                                                <div className="dag-edge">
                                                    <ArrowRight size={20} color="rgba(139,92,246,0.4)" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {!taskData && !loading && !error && (
                <div className="empty-state">
                    <GitBranch size={48} color="rgba(139,92,246,0.3)" />
                    <p>Enter a Task ID or submit a task from the Task page to view its workflow.</p>
                </div>
            )}
        </div>
    );
}
