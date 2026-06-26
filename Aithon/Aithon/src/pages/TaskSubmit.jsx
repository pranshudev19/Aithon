/**
 * Task Submission Page
 * Natural language input with dataset selector and DAG preview.
 * After task creation the page polls /task/{id}/status until COMPLETED or FAILED.
 */
import { useState, useEffect, useRef } from 'react';
import { taskAPI, datasetAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Send, Sparkles, ArrowRight, CheckCircle, AlertCircle,
  Copy, Loader2, RefreshCw, Clock,
} from 'lucide-react';
import { extractApiError } from '../services/errorUtils';

const EXAMPLE_TASKS = [
  "Validate sales dataset and generate synthetic data",
  "Check data quality and fix missing values",
  "Generate 1000 rows of synthetic customer data",
  "Run full pipeline: validate, clean, and generate synthetic data",
];

const NODE_COLORS = {
  PENDING: '#6b7280',
  RUNNING: '#06b6d4',
  COMPLETED: '#10b981',
  FAILED: '#ef4444',
};

const STATUS_LABEL = {
  PENDING:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   label: 'Pending',    icon: Clock },
  RUNNING:   { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   label: 'Running…',   icon: Loader2 },
  COMPLETED: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Completed',  icon: CheckCircle },
  FAILED:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Failed',     icon: AlertCircle },
};

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 60; // 2.5s × 60 = 2.5 min max wait

export default function TaskSubmit() {
  const [description, setDescription]   = useState('');
  const [datasets, setDatasets]         = useState([]);
  const [selectedDataset, setSelected]  = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [result, setResult]             = useState(null);      // initial create response
  const [taskStatus, setTaskStatus]     = useState(null);      // polled status object
  const [polling, setPolling]           = useState(false);
  const [error, setError]               = useState(null);
  const pollRef                          = useRef(null);
  const pollCount                        = useRef(0);
  const navigate                         = useNavigate();

  useEffect(() => {
    datasetAPI.list()
      .then(res => setDatasets(res.data))
      .catch(() => {});
    return () => clearInterval(pollRef.current);
  }, []);

  // ── Polling logic ──────────────────────────────────────────────────────────
  const startPolling = (taskId) => {
    pollCount.current = 0;
    setPolling(true);

    pollRef.current = setInterval(async () => {
      pollCount.current++;
      try {
        const { data } = await taskAPI.getStatus(taskId);
        setTaskStatus(data);

        const done = data.status === 'COMPLETED' || data.status === 'FAILED';
        if (done || pollCount.current >= POLL_MAX_ATTEMPTS) {
          clearInterval(pollRef.current);
          setPolling(false);
        }
      } catch {
        // keep trying silently
      }
    }, POLL_INTERVAL_MS);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!description.trim()) return;

    // Guard: aithon_token is required to talk to the FastAPI backend
    const aithonToken = localStorage.getItem('aithon_token');
    if (!aithonToken || aithonToken === 'null') {
      setError('Session expired or Aithon service unavailable. Please log out and log back in.');
      return;
    }

    clearInterval(pollRef.current);
    setSubmitting(true);
    setError(null);
    setResult(null);
    setTaskStatus(null);
    try {
      const { data } = await taskAPI.create({
        description,
        dataset_id: selectedDataset || null,
      });
      setResult(data);
      // If dataset was selected the pipeline runs in background — poll status
      if (selectedDataset) startPolling(data.task_id);
    } catch (err) {
      setError(extractApiError(err, 'Task creation failed. Please check that you are logged in and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!result?.task_id) return;
    try {
      const { data } = await taskAPI.getStatus(result.task_id);
      setTaskStatus(data);
    } catch {
      // ignore
    }
  };

  // Merge DAG nodes: prefer live status from taskStatus, fallback to initial plan
  const liveNodes = taskStatus?.dag?.nodes || result?.dag?.nodes || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Submit Task</h1>
        <p className="page-subtitle">Describe your data processing task in natural language</p>
      </div>

      {/* ── Input Card ── */}
      <div className="card">
        <div className="task-input-area">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Bot size={20} color="#8b5cf6" />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
              AI Task Planner — Describe what you want to do
            </span>
          </div>

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., Validate sales dataset and generate synthetic data..."
            className="task-textarea"
            rows={4}
          />

          {/* Example prompts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {EXAMPLE_TASKS.map((ex, i) => (
              <button key={i} className="example-chip" onClick={() => setDescription(ex)}>
                <Sparkles size={12} /> {ex}
              </button>
            ))}
          </div>

          {/* Dataset selector */}
          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8 }}>
              Select Dataset (optional — enables pipeline execution)
            </label>
            <select
              value={selectedDataset}
              onChange={e => setSelected(e.target.value)}
              className="select-input"
            >
              <option value="">— No dataset (planning only) —</option>
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.row_count} rows, {ds.column_count} cols)
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            style={{ marginTop: 20 }}
          >
            {submitting
              ? <><Loader2 size={16} className="spin" /> Creating task…</>
              : <><Send size={18} /> Submit Task</>}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="alert alert--error" style={{ marginTop: 24 }}>
          <AlertCircle size={20} />
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {/* ── Result Card ── */}
      {result && (
        <div className="card" style={{ marginTop: 24 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <CheckCircle size={22} color="#10b981" />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>Task Created</h3>
              <p className="text-muted" style={{ margin: 0 }}>
                Intent: <span className="badge badge--purple">{result.intent}</span>
              </p>
            </div>

            {/* Live status badge */}
            {(() => {
              const s = STATUS_LABEL[taskStatus?.status || result.status] || STATUS_LABEL.PENDING;
              const Icon = s.icon;
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 20,
                  background: s.bg, border: `1px solid ${s.color}30`,
                  fontSize: 13, fontWeight: 700, color: s.color,
                }}>
                  <Icon size={14} className={taskStatus?.status === 'RUNNING' ? 'spin' : ''} />
                  {s.label}
                </div>
              );
            })()}

            {/* Manual refresh */}
            {!polling && result && (
              <button
                onClick={handleManualRefresh}
                className="btn btn--secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                title="Refresh status"
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>

          {/* Polling notice */}
          {polling && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)',
              fontSize: 13, color: '#67e8f9',
            }}>
              <Loader2 size={14} className="spin" />
              Pipeline is executing in the background. Status updates every 2.5s…
            </div>
          )}

          {/* Error from pipeline */}
          {taskStatus?.status === 'FAILED' && taskStatus.error_message && (
            <div className="alert alert--error" style={{ marginBottom: 20 }}>
              <AlertCircle size={16} />
              <div><strong>Pipeline failed:</strong> {taskStatus.error_message}</div>
            </div>
          )}

          {/* Task ID */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', marginBottom: 20,
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12,
          }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>Task ID:</span>
            <code style={{
              flex: 1, fontSize: 13, color: '#a78bfa',
              background: 'rgba(0,0,0,0.3)', padding: '6px 12px',
              borderRadius: 8, fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {result.task_id}
            </code>
            <button
              className="btn btn--secondary"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => navigator.clipboard.writeText(result.task_id)}
            >
              <Copy size={14} /> Copy
            </button>
          </div>

          {/* DAG Visualization */}
          <h4 style={{ marginBottom: 16, color: 'rgba(255,255,255,0.7)' }}>Execution Pipeline</h4>
          <div className="dag-preview">
            {liveNodes.map((node, i) => (
              <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div className="dag-node" style={{ borderColor: NODE_COLORS[node.status] || '#6b7280' }}>
                  <span className="dag-node__label">{node.label}</span>
                  <span className="dag-node__status" style={{ color: NODE_COLORS[node.status] }}>
                    {node.status}
                    {node.status === 'RUNNING' && <Loader2 size={10} className="spin" style={{ marginLeft: 4 }} />}
                  </span>
                </div>
                {i < liveNodes.length - 1 && (
                  <ArrowRight size={24} color="rgba(139,92,246,0.5)" style={{ flexShrink: 0, margin: '0 8px' }} />
                )}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button className="btn btn--secondary" onClick={() => navigate(`/workflow?task=${result.task_id}`)}>
              View Workflow
            </button>
            {taskStatus?.status === 'COMPLETED' && (
              <button className="btn btn--secondary" onClick={() => navigate('/reports')}>
                View Reports
              </button>
            )}
            <button className="btn btn--secondary" onClick={() => {
              clearInterval(pollRef.current);
              setResult(null);
              setTaskStatus(null);
              setDescription('');
              setSelected('');
            }}>
              Submit Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
