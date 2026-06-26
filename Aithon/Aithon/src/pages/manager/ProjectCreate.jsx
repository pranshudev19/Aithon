/**
 * Project Create — Manager types NL description, watches pipeline run live.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pmAPI, createProjectWS } from '../../services/api';
import { extractApiError } from '../../services/errorUtils';

const AGENT_LABELS = {
    INTENT_PARSER: 'Intent Parser',
    TASK_GENERATOR: 'Task Generator',
    PRIORITY_ENGINE: 'Priority Engine',
    SCHEDULER: 'Scheduler',
};

const AGENT_ICONS = {
    INTENT_PARSER: '🧠',
    TASK_GENERATOR: '📝',
    PRIORITY_ENGINE: '⚖️',
    SCHEDULER: '📅',
};

const AGENT_ORDER = ['INTENT_PARSER', 'TASK_GENERATOR', 'PRIORITY_ENGINE', 'SCHEDULER'];

function AgentStep({ name, status }) {
    const icon = AGENT_ICONS[name] || '●';
    const label = AGENT_LABELS[name] || name;
    const cls = `pm-agent-step pm-agent-${status}`;
    return (
        <div className={cls}>
            <div className="pm-agent-icon">{icon}</div>
            <div className="pm-agent-info">
                <span className="pm-agent-name">{label}</span>
                <span className="pm-agent-status-text">
                    {status === 'completed' ? '✓ Completed' :
                        status === 'running' ? '⟳ Running...' :
                            status === 'failed' ? '✗ Failed' : '○ Pending'}
                </span>
            </div>
        </div>
    );
}

export default function ProjectCreate() {
    const [projectName, setProjectName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [projectId, setProjectId] = useState(null);
    const [pipelineSteps, setPipelineSteps] = useState(
        AGENT_ORDER.map(name => ({ name, status: 'pending' }))
    );
    const [pipelineDone, setPipelineDone] = useState(false);
    const [pipelineFailed, setPipelineFailed] = useState(false);
    const [error, setError] = useState('');
    const wsRef = useRef(null);
    const pollRef = useRef(null);
    const navigate = useNavigate();

    const updateStep = (agentName, status) => {
        setPipelineSteps(prev => prev.map(s =>
            s.name === agentName ? { ...s, status } : s
        ));
    };

    const startPolling = (pid) => {
        pollRef.current = setInterval(async () => {
            try {
                const res = await pmAPI.getPipelineStatus(pid);
                const data = res.data;
                data.agents.forEach(a => updateStep(a.name, a.status));
                if (data.pipeline_status === 'COMPLETED') {
                    setPipelineDone(true);
                    clearInterval(pollRef.current);
                } else if (data.pipeline_status === 'FAILED') {
                    setPipelineFailed(true);
                    setError(data.pipeline_error || 'Pipeline failed');
                    clearInterval(pollRef.current);
                }
            } catch (_) { }
        }, 1500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        setSubmitting(true);
        setError('');
        try {
            const res = await pmAPI.createProject({
                name: projectName.trim() || 'New Project',
                description: description.trim(),
            });
            const pid = res.data.id;
            setProjectId(pid);

            // Connect WebSocket for live updates
            wsRef.current = createProjectWS(pid, (msg) => {
                if (msg.event === 'agent_update') {
                    const step = msg.agent;
                    const stat = msg.status === 'COMPLETED' ? 'completed'
                        : msg.status === 'RUNNING' ? 'running'
                            : msg.status === 'FAILED' ? 'failed' : 'pending';
                    updateStep(step, stat);
                }
                if (msg.event === 'pipeline_completed') {
                    setPipelineDone(true);
                    wsRef.current?.close();
                }
                if (msg.event === 'pipeline_failed') {
                    setPipelineFailed(true);
                    setError(msg.error || 'Pipeline failed');
                    wsRef.current?.close();
                }
            });

            // Also poll as fallback
            startPolling(pid);

        } catch (err) {
            setError(extractApiError(err, 'Failed to create project'));
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        return () => {
            wsRef.current?.close();
            clearInterval(pollRef.current);
        };
    }, []);

    const isRunning = projectId && !pipelineDone && !pipelineFailed;

    return (
        <div className="pm-page">
            <div className="pm-header">
                <div>
                    <h1 className="pm-title">New Project</h1>
                    <p className="pm-subtitle">Describe your project in plain English. The AI agent pipeline will do the rest.</p>
                </div>
            </div>

            <div className="pm-create-grid">
                {/* Input Form */}
                <div className="pm-create-form-panel">
                    <form onSubmit={handleSubmit}>
                        <div className="pm-form-group">
                            <label className="pm-label">Project Name (optional)</label>
                            <input
                                className="pm-input"
                                placeholder="e.g. Web App v2"
                                value={projectName}
                                onChange={e => setProjectName(e.target.value)}
                                disabled={!!projectId}
                            />
                        </div>

                        <div className="pm-form-group">
                            <label className="pm-label">Project Description *</label>
                            <textarea
                                className="pm-textarea"
                                rows={7}
                                placeholder={`Describe your project in natural language. For example:\n\n"The authentication module and dashboard UI should be completed by end of this week. Auth is high priority, dashboard is medium. Auth must be done before the dashboard."`}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                disabled={!!projectId}
                            />
                            <span className="pm-hint">Be specific about priorities, deadlines, and dependencies.</span>
                        </div>

                        {error && <div className="pm-error-msg">{error}</div>}

                        {!projectId && (
                            <button
                                type="submit"
                                className="pm-btn pm-btn-primary pm-btn-full"
                                disabled={submitting || !description.trim()}
                            >
                                {submitting ? 'Launching pipeline...' : '🚀 Launch Agent Pipeline'}
                            </button>
                        )}
                    </form>
                </div>

                {/* Pipeline Progress Panel */}
                <div className="pm-pipeline-panel">
                    <h3 className="pm-panel-title">
                        {projectId ? 'Agent Pipeline' : 'Pipeline Preview'}
                    </h3>
                    <div className="pm-agent-steps">
                        {pipelineSteps.map(step => (
                            <AgentStep key={step.name} name={step.name} status={step.status} />
                        ))}
                    </div>

                    {isRunning && (
                        <div className="pm-pipeline-running-msg">
                            <div className="pm-spinner-sm" />
                            Pipeline is running...
                        </div>
                    )}

                    {pipelineDone && (
                        <div className="pm-pipeline-done-msg">
                            <div className="pm-done-icon">✓</div>
                            <p>Pipeline completed! All tasks have been assigned.</p>
                            <button
                                className="pm-btn pm-btn-primary pm-btn-full"
                                onClick={() => navigate(`/pm/manager/projects/${projectId}`)}
                            >
                                View Project Dashboard →
                            </button>
                        </div>
                    )}

                    {pipelineFailed && (
                        <div className="pm-pipeline-failed-msg">
                            <div className="pm-fail-icon">✗</div>
                            <p>{error || 'Pipeline failed. Please try again.'}</p>
                            <button
                                className="pm-btn pm-btn-secondary pm-btn-full"
                                onClick={() => navigate('/pm/manager')}
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
