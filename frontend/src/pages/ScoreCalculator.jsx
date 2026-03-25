import { useEffect, useState } from 'react';
import { getBoards, normalizeScore, getAdvancedNormalization } from '../api/client';
import ScoreResultCard from '../components/ScoreResultCard';
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'Economics', 'History'];

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

export default function ScoreCalculator() {
    const [boards, setBoards] = useState([]);
    const [form, setForm] = useState({ board: '', subject: '', year: '', marks: '', max_marks: '100' });
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getBoards().then((r) => {
            setBoards(r.data);
            if (r.data.length) setForm((f) => ({ ...f, board: r.data[0].board_name }));
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);
        setLoading(true);
        try {
            const payload = {
                board: form.board,
                subject: form.subject,
                year: parseInt(form.year),
                marks: parseFloat(form.marks),
                max_marks: parseFloat(form.max_marks),
            };
            const res = await normalizeScore(payload);
            let combinedResult = { ...res.data };
            
            // Fetch V2 Advanced Metrics Additively (Does not replace V1 logic)
            try {
                const v2Params = {
                    board: payload.board, subject: payload.subject, year: payload.year, marks: payload.marks, max_marks: payload.max_marks
                };
                const v2Res = await getAdvancedNormalization(v2Params);
                if (v2Res.data && v2Res.data.data) {
                    combinedResult.normalized_score_v2 = v2Res.data.data.normalized_score_v2;
                    combinedResult.advanced_z = v2Res.data.data.z_score;
                    combinedResult.advanced_percentile = v2Res.data.data.percentile;
                }
            } catch (v2Err) {
                console.warn("V2 normalizer unavailable for this cohort", v2Err);
            }

            setResult(combinedResult);
            setHistory((h) => [{ ...combinedResult, id: Date.now() }, ...h].slice(0, 10));
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const radarData = result ? [
        { metric: 'Percentage', v: Math.min(result.percentage_score, 100) },
        { metric: 'Old Normalized', v: Math.min(result.normalized_score, 100) },
        { metric: 'V2 Rectified Score', v: Math.min(result.normalized_score_v2 || result.normalized_score, 100) },
        { metric: 'Percentile (V2)', v: Math.min(result.advanced_percentile || result.percentile, 100) },
        { metric: 'Z×10+50', v: Math.min(Math.max(50 + (result.advanced_z || result.z_score) * 10, 0), 100) },
    ] : [];

    const comparisonData = result ? [
        { name: 'Your Score', value: result.percentage_score, fill: '#6366f1' },
        { name: 'Board Mean', value: result.mean_used, fill: '#06b6d4' },
        { name: 'V2 Normalization', value: result.normalized_score_v2 || result.normalized_score, fill: '#10b981' },
    ] : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Score Calculator
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    Normalize a student's score and compare across boards
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="card animate-fade-in" style={{ padding: '24px' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Board</label>
                        <select id="calc-board" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} className="input-field" required>
                            <option value="">Select board</option>
                            {boards.map((b) => <option key={b.board_id} value={b.board_name}>{b.board_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Subject</label>
                        <select id="calc-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" required>
                            <option value="">Select subject</option>
                            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Exam Year</label>
                        <input id="calc-year" type="number" min="2000" max="2027" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2022" className="input-field" required />
                    </div>
                    <div>
                        <label className="label">Marks Obtained</label>
                        <input id="calc-marks" type="number" min="0" step="0.01" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} placeholder="e.g. 78" className="input-field" required />
                    </div>
                    <div>
                        <label className="label">Maximum Marks</label>
                        <input id="calc-max-marks" type="number" min="1" step="0.01" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} placeholder="e.g. 100" className="input-field" required />
                    </div>
                </div>

                {error && (
                    <div style={{ marginTop: 16, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: '0.8125rem', color: '#fb7185' }}>
                        {error}
                    </div>
                )}

                <div style={{ marginTop: 20 }}>
                    <button id="calc-submit" type="submit" disabled={loading} className="btn-primary">
                        {loading ? (
                            <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculating...</>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                Normalize Score
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Results */}
            {result && (
                <div className="space-y-4">
                    <ScoreResultCard result={result} />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Radar */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>Score Profile</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                                    <PolarAngleAxis dataKey="metric" stroke="#5a6a96" fontSize={11} />
                                    <PolarRadiusAxis domain={[0, 100]} stroke="rgba(255,255,255,0.04)" fontSize={10} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Radar name="Score" dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Comparison */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>Score vs Board Mean</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="name" stroke="#5a6a96" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#5a6a96" fontSize={10} domain={[0, 100]} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" name="Score" radius={[8, 8, 0, 0]} maxBarSize={60}>
                                        {comparisonData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div className="card overflow-hidden animate-fade-in">
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Recent Calculations</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Board</th>
                                    <th>Subject</th>
                                    <th>Year</th>
                                    <th style={{ textAlign: 'right' }}>Marks</th>
                                    <th style={{ textAlign: 'right' }}>V1 Normalized</th>
                                    <th style={{ textAlign: 'right', color: '#10b981' }}>V2 Rectified</th>
                                    <th style={{ textAlign: 'right' }}>Percentile</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id}>
                                        <td style={{ fontWeight: 500, color: '#f0f4ff' }}>{h.board}</td>
                                        <td>{h.subject}</td>
                                        <td>{h.year}</td>
                                        <td style={{ textAlign: 'right' }} className="num-highlight">{h.marks}/{h.max_marks}</td>
                                        <td style={{ textAlign: 'right', color: '#818cf8', fontWeight: 600 }} className="num-highlight">{h.normalized_score.toFixed(1)}</td>
                                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 800 }} className="num-highlight">{(h.normalized_score_v2 || h.normalized_score).toFixed(1)}</td>
                                        <td style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 600 }} className="num-highlight">{(h.advanced_percentile || h.percentile).toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
