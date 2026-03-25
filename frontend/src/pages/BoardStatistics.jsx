import { useEffect, useState } from 'react';
import { getBoardStats, getBoards, getAnalyticsBoardStats, getAnalyticsDynamicStats } from '../api/client';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#111c38', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color || '#818cf8', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                </p>
            ))}
        </div>
    );
};

export default function BoardStatistics() {
    const [stats, setStats] = useState([]);
    const [boards, setBoards] = useState([]);
    const [boardInsights, setBoardInsights] = useState([]);
    const [insightsLoading, setInsightsLoading] = useState(true);
    const [dynamicGraphData, setDynamicGraphData] = useState(null);
    const [graphsLoading, setGraphsLoading] = useState(false);
    const [filter, setFilter] = useState({ board: '', subject: '' });
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('table');

    useEffect(() => { getBoards().then((r) => setBoards(r.data)); }, []);

    // Fetch board-level insights (NEW)
    useEffect(() => {
        getAnalyticsBoardStats()
            .then((r) => setBoardInsights(r.data))
            .catch(() => { })
            .finally(() => setInsightsLoading(false));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = {};
        if (filter.board) params.board = filter.board;
        if (filter.subject) params.subject = filter.subject;
        getBoardStats(params)
            .then((r) => setStats(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));

        // Refetch dynamic graphs if BOTH board and subject are selected
        if (filter.board && filter.subject) {
            setGraphsLoading(true);
            getAnalyticsDynamicStats(params)
                .then((r) => setDynamicGraphData(r.data))
                .catch(() => { })
                .finally(() => setGraphsLoading(false));
        } else {
            setDynamicGraphData(null);
        }
    }, [filter]);

    // Unique subjects
    const subjects = [...new Set(stats.map(s => s.subject))].sort();

    // Scatter data: mean vs std_dev
    const scatterData = stats.map(s => ({
        mean: s.mean_score,
        stdDev: s.std_dev,
        name: `${s.board_name} · ${s.subject}`,
        samples: s.sample_size,
    }));

    // Bar chart: group by board, avg mean
    const boardChartData = Object.values(stats.reduce((acc, s) => {
        if (!acc[s.board_name]) acc[s.board_name] = { board: s.board_name, mean: 0, count: 0 };
        const b = acc[s.board_name];
        b.mean = (b.mean * b.count + s.mean_score) / (b.count + 1);
        b.count += 1;
        return acc;
    }, {})).sort((a, b) => b.mean - a.mean);

    return (
        <div className="space-y-6">
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Board Statistics
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    Explore computed statistics · {stats.length} groups loaded
                </p>
            </div>

            {/* ── Board Insights Section (NEW) ── */}
            <div className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f4ff' }}>📊 Board Insights</span>
                    <span className="badge badge-indigo" style={{ fontSize: '0.625rem' }}>Live</span>
                </div>
                {insightsLoading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton" />)}
                    </div>
                ) : boardInsights.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                        {boardInsights.map((b, i) => (
                            <div key={b.board_name} className="card animate-fade-in" style={{
                                padding: '16px 18px',
                                animationDelay: `${i * 50}ms`,
                                borderLeft: `3px solid ${COLORS[i % COLORS.length]}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#f0f4ff' }}>{b.board_name}</span>
                                    <span style={{
                                        fontSize: '0.625rem', fontWeight: 600,
                                        padding: '2px 8px', borderRadius: 6,
                                        background: `${COLORS[i % COLORS.length]}15`,
                                        color: COLORS[i % COLORS.length],
                                    }}>
                                        {b.avg_percentage.toFixed(1)}%
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                                    <div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#22d3ee' }}>{b.student_count}</div>
                                        <div style={{ fontSize: '0.625rem', color: '#5a6a96', marginTop: 1 }}>Students</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#818cf8' }}>{b.subject_count}</div>
                                        <div style={{ fontSize: '0.625rem', color: '#5a6a96', marginTop: 1 }}>Subjects</div>
                                    </div>
                                </div>
                                {/* Avg % progress bar */}
                                <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${b.avg_percentage}%`, height: '100%', borderRadius: 2,
                                        background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 2) % COLORS.length]})`,
                                        transition: 'width 0.8s ease',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card" style={{ padding: '30px 20px', textAlign: 'center' }}>
                        <p style={{ color: '#5a6a96', fontSize: '0.8125rem' }}>No board data available</p>
                    </div>
                )}
            </div>

            {/* Filters + View Toggle */}
            <div className="flex flex-wrap items-center gap-3 animate-fade-in">
                <select
                    id="stats-filter-board"
                    value={filter.board}
                    onChange={(e) => setFilter({ ...filter, board: e.target.value })}
                    className="input-field"
                    style={{ width: 'auto', minWidth: 160 }}
                >
                    <option value="">All Boards</option>
                    {boards.map((b) => <option key={b.board_id} value={b.board_name}>{b.board_name}</option>)}
                </select>

                <select
                    id="stats-filter-subject"
                    value={filter.subject}
                    onChange={(e) => setFilter({ ...filter, subject: e.target.value })}
                    className="input-field"
                    style={{ width: 'auto', minWidth: 160 }}
                >
                    <option value="">All Subjects</option>
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>

            </div>

            {/* ── Dynamic Graphs ── */}
            {filter.board && filter.subject && dynamicGraphData ? (
                <div className="space-y-6 animate-fade-in mt-6 mb-6">
                    <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#f0f4ff' }}>
                        Dynamic Analysis: {filter.board} - {filter.subject}
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        {/* Trend Line Chart */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 16 }}>Performance Trend</h3>
                            {graphsLoading ? (
                                <div className="skeleton" style={{ height: 280 }} />
                            ) : dynamicGraphData.trend.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={dynamicGraphData.trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="year" stroke="#5a6a96" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#5a6a96" fontSize={10} domain={[0, 100]} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line type="monotone" dataKey="mean" name="Mean %" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#111c38', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <p style={{ color: '#5a6a96', fontSize: '0.8125rem' }}>No trend data available.</p>
                            )}
                        </div>

                        {/* Distribution Bar Chart */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 16 }}>Score Distribution</h3>
                            {graphsLoading ? (
                                <div className="skeleton" style={{ height: 280 }} />
                            ) : dynamicGraphData.distribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={dynamicGraphData.distribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="bucket" stroke="#5a6a96" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#5a6a96" fontSize={10} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Students" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                            {dynamicGraphData.distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p style={{ color: '#5a6a96', fontSize: '0.8125rem' }}>No distribution data available.</p>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}


        </div>
    );
}
