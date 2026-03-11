import { useEffect, useState } from 'react';
import { getBoardStats, getBoards } from '../api/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis,
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
    const [filter, setFilter] = useState({ board: '', subject: '' });
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('table');

    useEffect(() => { getBoards().then((r) => setBoards(r.data)); }, []);

    useEffect(() => {
        setLoading(true);
        const params = {};
        if (filter.board) params.board = filter.board;
        if (filter.subject) params.subject = filter.subject;
        getBoardStats(params)
            .then((r) => setStats(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
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

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 }}>
                    {['table', 'chart'].map(v => (
                        <button key={v} onClick={() => setView(v)}
                            style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                                background: view === v ? 'rgba(99,102,241,0.2)' : 'transparent',
                                color: view === v ? '#818cf8' : '#5a6a96',
                                transition: 'all 0.2s ease',
                            }}>
                            {v === 'table' ? 'Table' : 'Charts'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-12 skeleton" />)}
                </div>
            ) : stats.length === 0 ? (
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', marginBottom: 8 }}>📭</p>
                    <p style={{ color: '#5a6a96', fontSize: '0.875rem' }}>No statistics match your filters</p>
                </div>
            ) : view === 'table' ? (
                /* ── Table View ─── */
                <div className="card overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto" style={{ maxHeight: 520 }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Board</th>
                                    <th>Subject</th>
                                    <th>Period</th>
                                    <th style={{ textAlign: 'right' }}>Mean %</th>
                                    <th style={{ textAlign: 'right' }}>Std Dev</th>
                                    <th style={{ textAlign: 'right' }}>Samples</th>
                                    <th style={{ width: 120 }}>Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.slice(0, 100).map((s, i) => (
                                    <tr key={i} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}>
                                        <td style={{ fontWeight: 600, color: '#f0f4ff', whiteSpace: 'nowrap' }}>{s.board_name}</td>
                                        <td>
                                            <span className="badge badge-indigo">{s.subject}</span>
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{s.year_bucket}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="num-highlight" style={{ color: '#22d3ee', fontWeight: 700 }}>{s.mean_score.toFixed(1)}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="num-highlight" style={{ color: '#818cf8' }}>{s.std_dev.toFixed(1)}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="num-highlight" style={{ fontWeight: 500 }}>{s.sample_size}</span>
                                        </td>
                                        <td>
                                            {/* Mini bar showing mean ± std range */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: `${Math.max(s.mean_score - s.std_dev, 0)}%`,
                                                        width: `${Math.min(s.std_dev * 2, 100 - Math.max(s.mean_score - s.std_dev, 0))}%`,
                                                        height: '100%',
                                                        background: COLORS[i % COLORS.length],
                                                        borderRadius: 3, opacity: 0.5,
                                                    }} />
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: `${s.mean_score}%`,
                                                        width: 2, height: '100%',
                                                        background: '#f0f4ff',
                                                        borderRadius: 1,
                                                    }} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {stats.length > 100 && (
                        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: '#5a6a96', textAlign: 'center' }}>
                            Showing 100 of {stats.length} results. Use filters to narrow down.
                        </div>
                    )}
                </div>
            ) : (
                /* ── Chart View ─── */
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Board comparison */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 16 }}>Average Mean by Board</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={boardChartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="board" stroke="#5a6a96" fontSize={10} angle={-35} textAnchor="end" tickLine={false} />
                                    <YAxis stroke="#5a6a96" fontSize={10} domain={[0, 100]} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="mean" name="Mean %" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                        {boardChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Scatter: Mean vs StdDev */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 16 }}>Mean vs Standard Deviation</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="mean" name="Mean" stroke="#5a6a96" fontSize={10} domain={[0, 100]} tickLine={false} />
                                    <YAxis dataKey="stdDev" name="Std Dev" stroke="#5a6a96" fontSize={10} tickLine={false} />
                                    <ZAxis dataKey="samples" range={[30, 200]} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.5} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
