import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    LayoutDashboard,
    Database,
    AlertOctagon,
    Settings,
    Search,
    Bell,
    Menu,
    CheckCircle2,
    XCircle,
    Activity,
    ArrowUpRight,
    MoreVertical
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${active
                ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)]'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
    >
        <Icon size={20} className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
        <span className="font-medium text-sm">{label}</span>
        {active && (
            <motion.div
                layoutId="active-pill"
                className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"
            />
        )}
    </button>
);

const StatCard = ({ title, value, change, trend, icon: Icon, color }) => (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 hover:border-slate-700/60 transition-colors group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-white`}>
                <Icon size={22} className={color.replace('bg-', 'text-')} />
            </div>
            {change && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                    {trend === 'up' ? '+' : ''}{change}
                    <ArrowUpRight size={12} className={trend === 'down' ? 'rotate-90' : ''} />
                </span>
            )}
        </div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
    </div>
);

const RecentIncidentRow = ({ title, table, severity, time }) => (
    <div className="flex items-center justify-between p-4 hover:bg-slate-800/30 rounded-xl transition-colors border border-transparent hover:border-slate-800">
        <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${severity === 'high' ? 'bg-rose-500/10 text-rose-400' :
                    severity === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                }`}>
                <AlertOctagon size={18} />
            </div>
            <div>
                <h4 className="text-slate-200 font-medium text-sm">{title}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <Database size={12} className="text-slate-500" />
                    <span className="text-slate-500 text-xs">{table}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-6">
            <span className="text-slate-500 text-xs font-mono">{time}</span>
            <button className="text-slate-400 hover:text-white transition-colors">
                <MoreVertical size={16} />
            </button>
        </div>
    </div>
);

export default function GovernanceDashboard() {
    const [activeTab, setActiveTab] = useState('Overview');

    return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-200 selection:bg-emerald-500/30">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 border-r border-slate-800/60 bg-[#0B0F17]/95 flex flex-col p-4 z-20">
                    <div className="flex items-center gap-3 px-2 mb-10 mt-2">
                        <div className="bg-gradient-to-tr from-emerald-500 to-cyan-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
                            <ShieldCheck size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white tracking-tight">DataGuard</h1>
                            <span className="text-xs text-slate-500 font-medium">Governance OS</span>
                        </div>
                    </div>

                    <nav className="space-y-2 flex-1">
                        <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === 'Overview'} onClick={() => setActiveTab('Overview')} />
                        <SidebarItem icon={Database} label="Data Catalog" active={activeTab === 'Catalog'} onClick={() => setActiveTab('Catalog')} />
                        <SidebarItem icon={CheckCircle2} label="Quality Rules" active={activeTab === 'Rules'} onClick={() => setActiveTab('Rules')} />
                        <SidebarItem icon={AlertOctagon} label="Incidents" active={activeTab === 'Incidents'} onClick={() => setActiveTab('Incidents')} />
                    </nav>

                    <div className="mt-auto">
                        <SidebarItem icon={Settings} label="Settings" active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} />
                        <div className="mt-6 pt-6 border-t border-slate-800/60 px-2 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">AI</div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-slate-200 truncate">Admin User</p>
                                <p className="text-xs text-slate-500 truncate">admin@company.com</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-gradient-to-br from-[#0B0F17] via-[#0f1623] to-[#0B0F17]">
                    {/* Ambient Background Glow */}
                    <div className="absolute top-0 left-0 w-full h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

                    {/* Header */}
                    <header className="sticky top-0 z-10 px-8 py-5 flex items-center justify-between backdrop-blur-sm bg-[#0B0F17]/50 border-b border-transparent transition-all">
                        <div className="flex items-center gap-4 w-96">
                            <div className="relative group w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search tables, rules, or incidents..."
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                className="relative p-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                            >
                                <Bell size={20} />
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full box-content border-2 border-[#0B0F17]" />
                            </motion.button>
                        </div>
                    </header>

                    {/* Dashboard Content */}
                    <div className="p-8 max-w-7xl mx-auto space-y-8">
                        <div className="flex items-end justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Morning, Admin</h2>
                                <p className="text-slate-500">Here's what's happening with your data pipeline today.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    System Operational
                                </span>
                                <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]">
                                    Run Full Scan
                                </button>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Data Health Score"
                                value="94%"
                                change="2.4%"
                                trend="up"
                                icon={Activity}
                                color="bg-emerald-500"
                            />
                            <StatCard
                                title="Total Tables Monitored"
                                value="1,248"
                                icon={Database}
                                color="bg-blue-500"
                            />
                            <StatCard
                                title="Active Rules"
                                value="342"
                                icon={CheckCircle2}
                                color="bg-purple-500"
                            />
                            <StatCard
                                title="Critical Issues"
                                value="3"
                                change="1"
                                trend="down"
                                icon={XCircle}
                                color="bg-rose-500"
                            />
                        </div>

                        {/* Main Split */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Chart / Main Area */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 min-h-[300px]">
                                    <h3 className="text-lg font-semibold text-white mb-6">Quality Trend</h3>
                                    {/* Placeholder for a chart - using visual CSS representation for now */}
                                    <div className="h-64 flex items-end justify-between gap-2 px-4">
                                        {[40, 65, 55, 80, 75, 90, 85, 95, 92, 88, 94, 96].map((h, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ height: 0 }}
                                                animate={{ height: `${h}%` }}
                                                transition={{ duration: 1, delay: i * 0.05 }}
                                                className="w-full bg-emerald-500/20 rounded-t-sm relative group overflow-hidden"
                                            >
                                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-emerald-500/40 to-emerald-400/80 h-full opacity-60 group-hover:opacity-100 transition-opacity" />
                                            </motion.div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-4 text-xs text-slate-500 uppercase tracking-wider font-medium">
                                        <span>Jan</span>
                                        <span>Feb</span>
                                        <span>Mar</span>
                                        <span>Apr</span>
                                        <span>May</span>
                                        <span>Jun</span>
                                    </div>
                                </div>

                                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-semibold text-white">Recent Incidents</h3>
                                        <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">View All</button>
                                    </div>
                                    <div className="space-y-1">
                                        <RecentIncidentRow
                                            title="Null values in 'customer_email'"
                                            table="raw_customers_active"
                                            severity="high"
                                            time="2h ago"
                                        />
                                        <RecentIncidentRow
                                            title="Schema mismatch detected"
                                            table="orders_daily_agg"
                                            severity="medium"
                                            time="5h ago"
                                        />
                                        <RecentIncidentRow
                                            title="Unusual row count drop (-40%)"
                                            table="web_events_stream"
                                            severity="medium"
                                            time="8h ago"
                                        />
                                        <RecentIncidentRow
                                            title="Duplicate primary keys"
                                            table="inventory_log_v2"
                                            severity="low"
                                            time="12h ago"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Side Panel */}
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900/50 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

                                    <h3 className="text-lg font-semibold text-white mb-4 relative z-10">Governance Tips</h3>
                                    <p className="text-slate-400 text-sm mb-6 leading-relaxed relative z-10">
                                        Your 'users_sensitive' table is lacking an obfuscation policy for the 'ssn' column. Consider adding a masking rule.
                                    </p>
                                    <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-colors relative z-10">
                                        Review Policies
                                    </button>
                                </div>

                                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Top Failing Rules</h3>
                                    <div className="space-y-4">
                                        {[
                                            { name: 'Email Validity Check', failRate: '12%' },
                                            { name: 'Price Non-Negative', failRate: '4.2%' },
                                            { name: 'Foreign Key Integrity', failRate: '1.8%' }
                                        ].map((rule, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-300">{rule.name}</span>
                                                    <span className="text-rose-400">{rule.failRate}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: rule.failRate }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
