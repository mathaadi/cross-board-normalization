import { useEffect, useState } from 'react';
import { getStatsOverview, getBoardStats, getAnalyticsDashboardDistribution } from '../api/client';
import StatCard from '../components/StatCard';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
    AreaChart, Area, PieChart, Pie,
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#111c38', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <p style={{ color: '#8b9cc7', fontSize: '0.75rem', marginBottom: 4 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontSize: '0.8125rem', fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
                </p>
            ))}
        </div>
    );
};

export default function Dashboard() {
    const [overview, setOverview] = useState(null);
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [distData, setDistData] = useState(null);

    useEffect(() => {
        Promise.all([getStatsOverview(), getBoardStats()])
            .then(([ov, st]) => { setOverview(ov.data); setStats(st.data); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // Fetch dashboard distribution data (NEW)
    useEffect(() => {
        getAnalyticsDashboardDistribution()
            .then((r) => setDistData(r.data))
            .catch(() => { });
    }, []);

    // Aggregate by board
    const boardAgg = Object.values(stats.reduce((acc, s) => {
        if (!acc[s.board_name]) acc[s.board_name] = { board: s.board_name, avgMean: 0, totalStd: 0, count: 0, totalSamples: 0 };
        const b = acc[s.board_name];
        b.avgMean = (b.avgMean * b.count + s.mean_score) / (b.count + 1);
        b.totalStd = (b.totalStd * b.count + s.std_dev) / (b.count + 1);
        b.count += 1;
        b.totalSamples += s.sample_size;
        return acc;
    }, {}));

    // Top subjects by sample size
    const subjectAgg = Object.values(stats.reduce((acc, s) => {
        if (!acc[s.subject]) acc[s.subject] = { subject: s.subject, samples: 0, avgMean: 0, count: 0 };
        const subj = acc[s.subject];
        subj.avgMean = (subj.avgMean * subj.count + s.mean_score) / (subj.count + 1);
        subj.count += 1;
        subj.samples += s.sample_size;
        return acc;
    }, {})).sort((a, b) => b.samples - a.samples);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 skeleton" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton" />)}
                </div>
                <div className="h-80 skeleton" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Dashboard
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    System overview · {stats.length} statistical groups across {boardAgg.length} boards
                </p>
            </div>

            {/* Stat Cards */}
            {overview && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard icon="🏛️" label="Active Boards" value={overview.total_boards} color="indigo" delay={0} />
                    <StatCard icon="📝" label="Total Scores" value={overview.total_scores} color="cyan" delay={60} />
                    <StatCard icon="📚" label="Subjects Tracked" value={overview.total_subjects} color="emerald" delay={120} />
                    <StatCard icon="📊" label="Stat Groups" value={overview.total_statistics} color="amber" delay={180} />
                </div>
            )}

            {/* Old charts row removed as requested */}

            {/* Board leaderboard */}
            <div className="card overflow-hidden">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Board Leaderboard</h2>
                    <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 2 }}>Ranked by average mean score across all subjects</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>#</th>
                                <th>Board</th>
                                <th style={{ textAlign: 'right' }}>Avg Mean</th>
                                <th style={{ textAlign: 'right' }}>Avg Std Dev</th>
                                <th style={{ textAlign: 'right' }}>Samples</th>
                                <th style={{ width: 180 }}>Performance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boardAgg.sort((a, b) => b.avgMean - a.avgMean).map((b, i) => (
                                <tr key={b.board} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            width: 24, height: 24, borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700,
                                            background: i < 3 ? `${COLORS[i]}20` : 'rgba(255,255,255,0.04)',
                                            color: i < 3 ? COLORS[i] : '#5a6a96',
                                        }}>{i + 1}</span>
                                    </td>
                                    <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{b.board}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className="num-highlight" style={{ color: '#22d3ee', fontWeight: 600 }}>{b.avgMean.toFixed(1)}%</span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className="num-highlight" style={{ color: '#818cf8' }}>{b.totalStd.toFixed(1)}</span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className="num-highlight" style={{ fontWeight: 500 }}>{b.totalSamples.toLocaleString()}</span>
                                    </td>
                                    <td>
                                        <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${b.avgMean}%`, height: '100%', borderRadius: 3,
                                                background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                                                transition: 'width 0.8s ease',
                                            }} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Distribution Charts (NEW) ── */}
            {distData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                    {/* Board Distribution — Donut Chart */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Board Distribution</h2>
                                <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 2 }}>Student proportion per board</p>
                            </div>
                            <span className="badge badge-indigo">Analytics</span>
                        </div>
                        {distData.board_distribution?.length > 0 && (
                            <>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={distData.board_distribution}
                                            dataKey="count"
                                            nameKey="board"
                                            cx="50%" cy="50%"
                                            innerRadius={55}
                                            outerRadius={90}
                                            strokeWidth={2}
                                            stroke="#0c1428"
                                            label={({ board, percentage }) => `${board} (${percentage}%)`}
                                            labelLine={{ stroke: '#5a6a96', strokeWidth: 1 }}
                                        >
                                            {distData.board_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                    {distData.board_distribution.map((b, i) => (
                                        <span key={b.board} className="flex items-center gap-1.5" style={{ fontSize: '0.625rem', color: '#5a6a96' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                                            {b.board} ({b.count})
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Stream Distribution Per Board — Stacked Bar Chart */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Stream Distribution by Board</h2>
                                <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 2 }}>PCM · PCB · Commerce · Arts · General</p>
                            </div>
                            <span className="badge badge-indigo">Per Board</span>
                        </div>
                        {distData.stream_distribution?.length > 0 && (() => {
                            // Flatten stream distribution into stacked bar data
                            const allStreams = [...new Set(distData.stream_distribution.flatMap(b => b.streams.map(s => s.stream)))];
                            const STREAM_COLORS = { 'General': '#6366f1', 'Science (PCM)': '#06b6d4', 'Science (PCB)': '#10b981', 'Commerce': '#f59e0b', 'Arts': '#f43f5e' };
                            const barData = distData.stream_distribution.map(b => {
                                const entry = { board: b.board.replace(' Board', '') };
                                b.streams.forEach(s => { entry[s.stream] = s.count; });
                                return entry;
                            });
                            return (
                                <>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                            <XAxis dataKey="board" stroke="#5a6a96" fontSize={10} angle={-35} textAnchor="end" tickLine={false} />
                                            <YAxis stroke="#5a6a96" fontSize={10} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            {allStreams.map((stream, i) => (
                                                <Bar key={stream} dataKey={stream} name={stream} stackId="a" fill={STREAM_COLORS[stream] || COLORS[i % COLORS.length]} radius={i === allStreams.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                        {allStreams.map((stream, i) => (
                                            <span key={stream} className="flex items-center gap-1.5" style={{ fontSize: '0.625rem', color: '#5a6a96' }}>
                                                <span style={{ width: 7, height: 7, borderRadius: 2, background: STREAM_COLORS[stream] || COLORS[i % COLORS.length], display: 'inline-block' }} />
                                                {stream}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
