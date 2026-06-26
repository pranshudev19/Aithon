/**
 * Dashboard Home Page
 * Shows metrics cards, charts, and recent activity.
 */
import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Activity, Database, CheckCircle, AlertTriangle, Clock, TrendingUp, Copy } from 'lucide-react';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#ef4444', '#f59e0b'];

const STATUS_COLORS = {
    COMPLETED: '#10b981',
    RUNNING: '#06b6d4',
    PENDING: '#f59e0b',
    FAILED: '#ef4444',
    CANCELLED: '#6b7280',
};

export default function DashboardHome() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        dashboardAPI.getMetrics()
            .then((res) => setMetrics(res.data))
            .catch(() => setMetrics({
                total_tasks: 0, tasks_by_status: {}, total_datasets: 0,
                avg_duration_seconds: null, recent_tasks: []
            }))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    const statusData = Object.entries(metrics.tasks_by_status || {}).map(([name, value]) => ({
        name, value
    }));

    const cards = [
        { label: 'Total Tasks', value: metrics.total_tasks, icon: Activity, color: '#8b5cf6' },
        { label: 'Datasets', value: metrics.total_datasets, icon: Database, color: '#06b6d4' },
        { label: 'Completed', value: metrics.tasks_by_status?.COMPLETED || 0, icon: CheckCircle, color: '#10b981' },
        { label: 'Failed', value: metrics.tasks_by_status?.FAILED || 0, icon: AlertTriangle, color: '#ef4444' },
        { label: 'Avg Duration', value: metrics.avg_duration_seconds ? `${metrics.avg_duration_seconds}s` : 'N/A', icon: Clock, color: '#f59e0b' },
        { label: 'Success Rate', value: metrics.total_tasks > 0 ? `${Math.round(((metrics.tasks_by_status?.COMPLETED || 0) / metrics.total_tasks) * 100)}%` : 'N/A', icon: TrendingUp, color: '#10b981' },
    ];

    return (
        <div className="page">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p className="page-subtitle">Multi-Agent System Overview</p>
            </div>

            {/* Metric Cards */}
            <div className="metrics-grid">
                {cards.map((card, i) => (
                    <div key={i} className="metric-card">
                        <div className="metric-card__icon" style={{ background: `${card.color}20`, color: card.color }}>
                            <card.icon size={22} />
                        </div>
                        <div className="metric-card__content">
                            <span className="metric-card__value">{card.value}</span>
                            <span className="metric-card__label">{card.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="charts-row">
                {/* Task Status Pie Chart */}
                <div className="chart-card">
                    <h3>Task Distribution</h3>
                    {statusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, i) => (
                                        <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#1a1a3e', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="chart-empty">No tasks yet</div>
                    )}
                    <div className="chart-legend">
                        {statusData.map((item, i) => (
                            <span key={i} className="legend-item">
                                <span className="legend-dot" style={{ background: STATUS_COLORS[item.name] || COLORS[i] }} />
                                {item.name}: {item.value}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Recent Activity Bar Chart */}
                <div className="chart-card" style={{ flex: 2 }}>
                    <h3>Recent Activity</h3>
                    {metrics.recent_tasks.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={metrics.recent_tasks.slice(0, 8).map((t, i) => ({
                                name: `Task ${i + 1}`,
                                status: t.status === 'COMPLETED' ? 1 : t.status === 'FAILED' ? -1 : 0.5,
                                statusLabel: t.status,
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ background: '#1a1a3e', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff' }}
                                />
                                <Bar dataKey="status" radius={[6, 6, 0, 0]}>
                                    {metrics.recent_tasks.slice(0, 8).map((t, i) => (
                                        <Cell key={i} fill={STATUS_COLORS[t.status] || '#6b7280'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="chart-empty">No activity yet. Submit a task to get started!</div>
                    )}
                </div>
            </div>

            {/* Recent Tasks Table */}
            <div className="card" style={{ marginTop: '24px' }}>
                <h3>Recent Tasks</h3>
                {metrics.recent_tasks.length > 0 ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Task ID</th>
                                <th>Description</th>
                                <th>Intent</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.recent_tasks.map((task) => (
                                <tr key={task.id}>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <code style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                                {task.id?.slice(0, 8)}...
                                            </code>
                                            <button
                                                className="btn-icon"
                                                style={{ width: 24, height: 24, border: 'none' }}
                                                onClick={() => { navigator.clipboard.writeText(task.id); }}
                                                title="Copy Task ID"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </span>
                                    </td>
                                    <td>{task.description}</td>
                                    <td><span className="badge badge--purple">{task.intent || '—'}</span></td>
                                    <td>
                                        <span className={`badge badge--${task.status.toLowerCase()}`}>
                                            {task.status}
                                        </span>
                                    </td>
                                    <td className="text-muted">
                                        {task.created_at ? new Date(task.created_at).toLocaleString() : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-muted" style={{ padding: '24px', textAlign: 'center' }}>
                        No tasks created yet. Go to "Submit Task" to get started.
                    </p>
                )}
            </div>
        </div>
    );
}
