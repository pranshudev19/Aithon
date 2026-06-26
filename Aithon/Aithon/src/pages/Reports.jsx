/**
 * Reports Page
 * View data quality reports, synthetic data stats, and download files.
 */
import { useState } from 'react';
import { taskAPI, reportAPI } from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { FileBarChart, Download, Search, AlertCircle, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { extractApiError } from '../services/errorUtils';

export default function Reports() {
    const [taskId, setTaskId] = useState('');
    const [reports, setReports] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    const fetchReports = async () => {
        if (!taskId.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await taskAPI.getReport(taskId);
            setReports(res.data.reports);
        } catch (err) {
            setError(extractApiError(err, 'Failed to load reports'));
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (reportId, filename) => {
        try {
            const res = await reportAPI.download(reportId);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || 'download.csv';
            link.click();
            window.URL.revokeObjectURL(url);
        } catch {
            alert('Download failed — no file attached to this report');
        }
    };

    const renderValidationReport = (report) => {
        const data = report.data;
        if (!data?.report) return null;
        const r = data.report;
        return (
            <div className="report-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    {r.is_valid ? (
                        <CheckCircle size={20} color="#10b981" />
                    ) : (
                        <AlertTriangle size={20} color="#ef4444" />
                    )}
                    <span style={{ fontWeight: 600, color: r.is_valid ? '#10b981' : '#ef4444' }}>
                        {r.is_valid ? 'Validation Passed' : 'Validation Failed'}
                    </span>
                </div>
                <div className="stats-row">
                    <div className="stat">
                        <span className="stat__value">{r.total_checks}</span>
                        <span className="stat__label">Total Checks</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#10b981' }}>{r.passed_checks}</span>
                        <span className="stat__label">Passed</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#ef4444' }}>{r.failed_checks}</span>
                        <span className="stat__label">Failed</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#f59e0b' }}>{r.warnings}</span>
                        <span className="stat__label">Warnings</span>
                    </div>
                </div>
                {r.errors && r.errors.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                        <h4>Issues</h4>
                        {r.errors.map((e, i) => (
                            <div key={i} className={`alert alert--${e.severity === 'WARNING' ? 'warning' : 'error'}`} style={{ marginTop: 8 }}>
                                {e.severity === 'WARNING' ? <AlertTriangle size={14} /> : <AlertCircle size={14} />}
                                <span><strong>{e.column || 'General'}:</strong> {e.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderQualityReport = (report) => {
        const data = report.data;
        if (!data?.quality_report) return null;
        const qr = data.quality_report;
        const summary = qr.summary || {};

        return (
            <div className="report-section">
                <div className="stats-row">
                    <div className="stat">
                        <span className="stat__value">{qr.original_shape?.rows || '—'}</span>
                        <span className="stat__label">Original Rows</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value">{qr.cleaned_shape?.rows || '—'}</span>
                        <span className="stat__label">Cleaned Rows</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#06b6d4' }}>{summary.total_missing_imputed || 0}</span>
                        <span className="stat__label">Values Imputed</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#f59e0b' }}>{summary.total_outliers_detected || 0}</span>
                        <span className="stat__label">Outliers Found</span>
                    </div>
                </div>

                {/* Missing Values Chart */}
                {qr.missing_values && (
                    <div style={{ marginTop: 24 }}>
                        <h4>Missing Values by Column</h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={Object.entries(qr.missing_values).map(([col, info]) => ({
                                column: col.length > 10 ? col.slice(0, 10) + '…' : col,
                                missing: info.missing_percentage,
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="column" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} unit="%" />
                                <Tooltip contentStyle={{
                                    background: '#1a1a3e', border: '1px solid rgba(139,92,246,0.3)',
                                    borderRadius: 8, color: '#fff'
                                }} />
                                <Bar dataKey="missing" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    };

    const renderSyntheticReport = (report) => {
        const data = report.data;
        if (!data?.summary) return null;
        const s = data.summary;

        return (
            <div className="report-section">
                <div className="stats-row">
                    <div className="stat">
                        <span className="stat__value">{s.source_rows}</span>
                        <span className="stat__label">Source Rows</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#10b981' }}>{s.synthetic_rows}</span>
                        <span className="stat__label">Generated Rows</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value">{s.method}</span>
                        <span className="stat__label">Method</span>
                    </div>
                    <div className="stat">
                        <span className="stat__value" style={{ color: '#ef4444' }}>{s.pii_columns_masked}</span>
                        <span className="stat__label">PII Masked</span>
                    </div>
                </div>

                {/* Comparison Chart */}
                {data.comparison_report && (
                    <div style={{ marginTop: 24 }}>
                        <h4>Statistical Comparison (Mean Difference %)</h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={Object.entries(data.comparison_report)
                                .filter(([k]) => !k.startsWith('_'))
                                .map(([col, info]) => ({
                                    column: col.length > 10 ? col.slice(0, 10) + '…' : col,
                                    diff: info.mean_difference_pct || 0,
                                }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="column" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} unit="%" />
                                <Tooltip contentStyle={{
                                    background: '#1a1a3e', border: '1px solid rgba(139,92,246,0.3)',
                                    borderRadius: 8, color: '#fff'
                                }} />
                                <Bar dataKey="diff" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    };

    const REPORT_RENDERERS = {
        validation: renderValidationReport,
        quality: renderQualityReport,
        synthetic: renderSyntheticReport,
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>Reports</h1>
                <p className="page-subtitle">View data quality, validation, and synthetic data reports</p>
            </div>

            {/* Task ID Input */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <input
                        type="text"
                        value={taskId}
                        onChange={(e) => setTaskId(e.target.value)}
                        placeholder="Enter Task ID to view reports..."
                        className="text-input"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => e.key === 'Enter' && fetchReports()}
                    />
                    <button className="btn btn--primary" onClick={fetchReports} disabled={loading}>
                        {loading ? <span className="spinner spinner--small" /> : <Search size={18} />}
                        Load
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert--error">
                    <AlertCircle size={20} /> <span>{error}</span>
                </div>
            )}

            {/* Reports */}
            {reports && reports.length > 0 && reports.map((report, i) => (
                <div className="card" key={i} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileBarChart size={20} color="#8b5cf6" />
                            <h3 style={{ margin: 0 }}>{report.title}</h3>
                            <span className="badge badge--purple">{report.report_type}</span>
                        </div>
                        {/* Download button for EVERY report that has a file_path */}
                        {report.file_path && (
                            <button
                                className="btn btn--primary"
                                style={{ padding: '8px 16px', fontSize: 13 }}
                                onClick={() => handleDownload(report.id, `${report.report_type}_output.csv`)}
                            >
                                <Download size={16} /> Download File
                            </button>
                        )}
                    </div>

                    {/* Report content */}
                    {REPORT_RENDERERS[report.report_type]
                        ? REPORT_RENDERERS[report.report_type](report)
                        : <pre style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                            {JSON.stringify(report.data, null, 2)}
                        </pre>
                    }

                    {/* Always show Report ID for reference */}
                    <div style={{
                        marginTop: 16, paddingTop: 12,
                        borderTop: '1px solid rgba(139,92,246,0.1)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12, color: 'rgba(255,255,255,0.3)',
                    }}>
                        Report ID: <code style={{ color: '#a78bfa' }}>{report.id}</code>
                        {report.file_path && (
                            <span style={{ marginLeft: 12 }}>
                                📁 File: <code style={{ color: '#06b6d4' }}>{report.file_path}</code>
                            </span>
                        )}
                    </div>
                </div>
            ))}

            {reports && reports.length === 0 && (
                <div className="empty-state">
                    <FileBarChart size={48} color="rgba(139,92,246,0.3)" />
                    <p>No reports found for this task.</p>
                </div>
            )}

            {!reports && !loading && !error && (
                <div className="empty-state">
                    <FileBarChart size={48} color="rgba(139,92,246,0.3)" />
                    <p>Enter a Task ID to view its reports.</p>
                </div>
            )}
        </div>
    );
}
