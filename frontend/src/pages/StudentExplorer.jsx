import { useEffect, useState } from 'react';
import { getBoards } from '../api/client';
import API from '../api/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#111c38', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <p style={{ color: '#8b9cc7', fontSize: '0.75rem', marginBottom: 4 }}>{label || payload[0]?.payload?.subject}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontSize: '0.8125rem', fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                </p>
            ))}
        </div>
    );
};

export default function StudentExplorer() {
    const [boards, setBoards] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBoard, setFilterBoard] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [chartView, setChartView] = useState('bar');

    useEffect(() => { getBoards().then((r) => setBoards(r.data)); }, []);

    // Search students
    const handleSearch = async () => {
        setSearchLoading(true);
        try {
            const params = {};
            if (searchQuery) params.q = searchQuery;
            if (filterBoard) params.board = filterBoard;
            if (filterYear) params.year = filterYear;
            const res = await API.get('/students/search', { params });
            setStudents(res.data);
        } catch { setStudents([]); }
        finally { setSearchLoading(false); }
    };

    useEffect(() => {
        const timer = setTimeout(() => { handleSearch(); }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, filterBoard, filterYear]);

    // Load student data
    const selectStudent = async (student) => {
        setSelectedStudent(student);
        setLoading(true);
        try {
            const params = { student_name: student.student_name };
            if (student.board_name) params.board = student.board_name;
            if (student.exam_year) params.year = student.exam_year;
            const res = await API.get('/student-normalized-scores', { params });
            setStudentData(res.data);
        } catch { setStudentData(null); }
        finally { setLoading(false); }
    };

    // Chart data
    const comparisonData = studentData?.subjects?.map(s => ({
        subject: s.subject,
        raw: s.percentage,
        normalized: s.normalized_score,
    })) || [];

    const radarData = studentData?.subjects?.map(s => ({
        subject: s.subject.length > 8 ? s.subject.substring(0, 8) + '…' : s.subject,
        percentile: s.percentile || 0,
    })) || [];

    // Overall stats
    const avgRaw = studentData?.subjects?.length
        ? (studentData.subjects.reduce((s, v) => s + (v.percentage || 0), 0) / studentData.subjects.length).toFixed(1)
        : 0;
    const avgNorm = studentData?.subjects?.length
        ? (studentData.subjects.reduce((s, v) => s + (v.normalized_score || 0), 0) / studentData.subjects.length).toFixed(1)
        : 0;
    const avgPercentile = studentData?.subjects?.length
        ? (studentData.subjects.reduce((s, v) => s + (v.percentile || 0), 0) / studentData.subjects.length).toFixed(1)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Student Score Explorer
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    Search students · View raw & normalized scores · Compare across subjects
                </p>
            </div>

            {/* Search Panel */}
            <div className="card animate-fade-in" style={{ padding: '20px' }}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                        <label className="label">Search Student</label>
                        <div style={{ position: 'relative' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a6a96" strokeWidth="2" strokeLinecap="round"
                                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                id="student-search"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type a student name..."
                                className="input-field"
                                style={{ paddingLeft: 38 }}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label">Board</label>
                        <select id="student-board-filter" value={filterBoard} onChange={(e) => setFilterBoard(e.target.value)} className="input-field">
                            <option value="">All Boards</option>
                            {boards.map(b => <option key={b.board_id} value={b.board_name}>{b.board_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Year</label>
                        <select id="student-year-filter" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="input-field">
                            <option value="">All Years</option>
                            {[2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Student List */}
                <div className="card overflow-hidden" style={{ maxHeight: 520 }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between">
                            <h3 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#f0f4ff' }}>Students</h3>
                            <span className="badge badge-amber">{students.length} found</span>
                        </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 460 }}>
                        {searchLoading ? (
                            <div className="p-6 space-y-3">
                                {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton" />)}
                            </div>
                        ) : students.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', marginBottom: 4 }}>🔍</p>
                                <p style={{ color: '#5a6a96', fontSize: '0.8125rem' }}>No students found</p>
                            </div>
                        ) : (
                            students.map((s, i) => (
                                <button
                                    key={`${s.student_name}-${s.board_name}-${s.exam_year}-${i}`}
                                    onClick={() => selectStudent(s)}
                                    style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        padding: '12px 18px', border: 'none', cursor: 'pointer',
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        background: selectedStudent?.student_name === s.student_name && selectedStudent?.exam_year === s.exam_year
                                            ? 'rgba(99,102,241,0.1)' : 'transparent',
                                        transition: 'background 0.15s ease',
                                        fontFamily: 'Inter, sans-serif',
                                    }}
                                    onMouseOver={(e) => { if (selectedStudent?.student_name !== s.student_name) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                    onMouseOut={(e) => { if (selectedStudent?.student_name !== s.student_name) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10,
                                            background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}40, ${COLORS[(i + 1) % COLORS.length]}20)`,
                                            border: `1px solid ${COLORS[i % COLORS.length]}30`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.75rem', fontWeight: 700, color: COLORS[i % COLORS.length],
                                            flexShrink: 0,
                                        }}>
                                            {s.student_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#f0f4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.student_name}
                                            </p>
                                            <p style={{ fontSize: '0.6875rem', color: '#5a6a96' }}>
                                                {s.class_level} · {s.board_name} · {s.exam_year} · {s.stream ? `${s.stream} · ` : ''}{s.subject_count} subj
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Score Detail */}
                <div className="lg:col-span-2 space-y-4">
                    {loading ? (
                        <div className="space-y-4">
                            <div className="h-32 skeleton" />
                            <div className="h-64 skeleton" />
                        </div>
                    ) : !studentData ? (
                        <div className="card" style={{ padding: '80px 20px', textAlign: 'center' }}>
                            <p style={{ fontSize: '3rem', marginBottom: 8 }}>👤</p>
                            <p style={{ color: '#8b9cc7', fontWeight: 600, fontSize: '0.9375rem' }}>Select a student</p>
                            <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 4 }}>
                                Search and click on a student to view their scores
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Student Profile Card */}
                            <div className="card animate-fade-in" style={{ padding: '20px', borderLeft: '3px solid #f59e0b' }}>
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div style={{
                                            width: 56, height: 56, borderRadius: 14,
                                            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(244,63,94,0.1))',
                                            border: '1px solid rgba(245,158,11,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24',
                                        }}>
                                            {studentData.student_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </div>
                                        <div>
                                            <h2 style={{ fontWeight: 800, fontSize: '1.125rem', color: '#f0f4ff' }}>{studentData.student_name}</h2>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <span className="badge badge-indigo">{studentData.board}</span>
                                                <span className="badge badge-cyan">{studentData.year}</span>
                                                {studentData.class_level && <span className="badge" style={{ background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>{studentData.class_level}</span>}
                                                {studentData.stream && <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>{studentData.stream}</span>}
                                                {studentData.recent_education && <span className="badge badge-amber">{studentData.recent_education}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96', letterSpacing: '0.06em' }}>Avg Raw</p>
                                            <p className="num-highlight" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#22d3ee' }}>{avgRaw}%</p>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96', letterSpacing: '0.06em' }}>Avg Norm</p>
                                            <p className="num-highlight" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>{avgNorm}</p>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96', letterSpacing: '0.06em' }}>Avg Pctl</p>
                                            <p className="num-highlight" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>{avgPercentile}%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Score Table */}
                            <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '60ms' }}>
                                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Subject Scores</h3>
                                    <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 2 }}>
                                        Normalized using the existing Z-score model · scores are computed dynamically
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th style={{ textAlign: 'right' }}>Raw Score</th>
                                                <th style={{ textAlign: 'right' }}>Percentage</th>
                                                <th style={{ textAlign: 'right' }}>Normalized</th>
                                                <th style={{ textAlign: 'right' }}>Z-Score</th>
                                                <th style={{ textAlign: 'right' }}>Percentile</th>
                                                <th style={{ width: 120 }}>Standing</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {studentData.subjects.map((s, i) => {
                                                const pctl = s.percentile || 0;
                                                const standing = pctl >= 90 ? { text: 'Excellent', color: '#34d399' }
                                                    : pctl >= 75 ? { text: 'Good', color: '#22d3ee' }
                                                        : pctl >= 50 ? { text: 'Average', color: '#fbbf24' }
                                                            : pctl >= 25 ? { text: 'Below Avg', color: '#fb923c' }
                                                                : { text: 'Weak', color: '#fb7185' };
                                                return (
                                                    <tr key={s.subject} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                                                        <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{s.subject}</td>
                                                        <td style={{ textAlign: 'right' }} className="num-highlight">
                                                            {s.raw_score}/{s.max_marks}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#8b9cc7' }} className="num-highlight">
                                                            {s.percentage?.toFixed(1)}%
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700 }} className="num-highlight">
                                                            {s.normalized_score?.toFixed(1)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#818cf8' }} className="num-highlight">
                                                            {s.z_score?.toFixed(3)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 600 }} className="num-highlight">
                                                            {s.percentile}%
                                                        </td>
                                                        <td>
                                                            <span className="badge" style={{ background: `${standing.color}18`, color: standing.color, fontSize: '0.625rem' }}>
                                                                {standing.text}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Chart Toggle + Charts */}
                            <div className="animate-fade-in" style={{ animationDelay: '120ms' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Score Comparison</h3>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 }}>
                                        {['bar', 'radar'].map(v => (
                                            <button key={v} onClick={() => setChartView(v)}
                                                style={{
                                                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                    fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                                                    background: chartView === v ? 'rgba(99,102,241,0.2)' : 'transparent',
                                                    color: chartView === v ? '#818cf8' : '#5a6a96', transition: 'all 0.2s ease',
                                                }}>
                                                {v === 'bar' ? 'Bar Chart' : 'Radar'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '20px' }}>
                                    {chartView === 'bar' ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                                <XAxis dataKey="subject" stroke="#5a6a96" fontSize={10} angle={-25} textAnchor="end" tickLine={false} />
                                                <YAxis stroke="#5a6a96" fontSize={10} domain={[0, 100]} tickLine={false} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="raw" name="Raw %" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.7} />
                                                <Bar dataKey="normalized" name="Normalized" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <RadarChart data={radarData}>
                                                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                                                <PolarAngleAxis dataKey="subject" stroke="#5a6a96" fontSize={10} />
                                                <PolarRadiusAxis domain={[0, 100]} stroke="rgba(255,255,255,0.04)" fontSize={9} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Radar name="Percentile" dataKey="percentile" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    )}
                                    {/* Legend */}
                                    <div className="flex justify-center gap-6 mt-3">
                                        {chartView === 'bar' ? (
                                            <>
                                                <span className="flex items-center gap-1.5" style={{ fontSize: '0.6875rem', color: '#5a6a96' }}>
                                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', display: 'inline-block', opacity: 0.7 }} /> Raw Score %
                                                </span>
                                                <span className="flex items-center gap-1.5" style={{ fontSize: '0.6875rem', color: '#5a6a96' }}>
                                                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Normalized Score
                                                </span>
                                            </>
                                        ) : (
                                            <span className="flex items-center gap-1.5" style={{ fontSize: '0.6875rem', color: '#5a6a96' }}>
                                                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Percentile Rank
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
