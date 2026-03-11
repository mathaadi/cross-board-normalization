import { useEffect, useState, useMemo } from 'react';
import { getBoards, ingestScore } from '../api/client';

// Stream-based subject mappings
const STREAM_SUBJECTS = {
    'Class 10': {
        'General': ['Mathematics', 'Science', 'Social Studies', 'English', 'Hindi', 'Computer Applications'],
    },
    'Class 12': {
        'Science (PCM)': ['Mathematics', 'Physics', 'Chemistry', 'English', 'Computer Science', 'Physical Education'],
        'Science (PCB)': ['Physics', 'Chemistry', 'Biology', 'English', 'Physical Education'],
        'Commerce': ['Accountancy', 'Business Studies', 'Economics', 'English', 'Mathematics', 'Informatics Practices'],
        'Arts': ['History', 'Political Science', 'Geography', 'English', 'Economics', 'Sociology'],
    },
};

const ALL_STREAMS_10 = Object.keys(STREAM_SUBJECTS['Class 10']);
const ALL_STREAMS_12 = Object.keys(STREAM_SUBJECTS['Class 12']);

export default function AdminPanel() {
    const [boards, setBoards] = useState([]);
    const [form, setForm] = useState({
        student_name: '', board: '', class_level: 'Class 12', stream: '', subject: '',
        year: '', marks: '', max_marks: '100', recent_education: '',
    });
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkResults, setBulkResults] = useState({ success: 0, failed: 0, errors: [] });

    useEffect(() => {
        getBoards().then((r) => {
            setBoards(r.data);
            if (r.data.length) setForm((f) => ({ ...f, board: r.data[0].board_name }));
        });
    }, []);

    // Stream options based on class level
    const streamOptions = form.class_level === 'Class 10' ? ALL_STREAMS_10 : ALL_STREAMS_12;

    // Subjects based on class level + stream
    const availableSubjects = useMemo(() => {
        const levelMap = STREAM_SUBJECTS[form.class_level];
        if (!levelMap) return [];
        if (form.stream && levelMap[form.stream]) return levelMap[form.stream];
        return [...new Set(Object.values(levelMap).flat())];
    }, [form.class_level, form.stream]);

    // Reset stream + subject when class level changes
    const handleClassLevelChange = (newLevel) => {
        const defaultStream = newLevel === 'Class 10' ? 'General' : '';
        setForm(f => ({ ...f, class_level: newLevel, stream: defaultStream, subject: '' }));
    };

    const handleStreamChange = (newStream) => {
        setForm(f => ({ ...f, stream: newStream, subject: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        setLoading(true);
        try {
            const payload = {
                student_name: form.student_name || undefined,
                board: form.board,
                class_level: form.class_level,
                stream: form.stream || undefined,
                subject: form.subject,
                year: parseInt(form.year),
                marks: parseFloat(form.marks),
                max_marks: parseFloat(form.max_marks),
                recent_education: form.recent_education || undefined,
            };
            const res = await ingestScore(payload);
            setSuccess(`✓ Score ingested — ${res.data.student_name || 'Anonymous'} #${res.data.student_id}, ${res.data.percentage_score}%`);
            setHistory((h) => [res.data, ...h].slice(0, 30));
            setForm((f) => ({ ...f, marks: '', year: '', subject: '' }));
        } catch (err) {
            setError(err.response?.data?.detail || 'Ingestion failed');
        } finally { setLoading(false); }
    };

    const handleBulkIngest = async () => {
        setError(''); setSuccess('');
        const lines = bulkText.trim().split('\n').filter(l => l.trim());
        if (!lines.length) return;

        const results = { success: 0, failed: 0, errors: [] };
        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            // Format: Name, Board, ClassLevel, Stream, Subject, Year, Marks, MaxMarks
            if (parts.length < 8) {
                results.failed++;
                results.errors.push(`Need 8 columns: "${line}"`);
                continue;
            }
            try {
                const res = await ingestScore({
                    student_name: parts[0] || undefined,
                    board: parts[1],
                    class_level: parts[2],
                    stream: parts[3] || undefined,
                    subject: parts[4],
                    year: parseInt(parts[5]),
                    marks: parseFloat(parts[6]),
                    max_marks: parseFloat(parts[7]),
                });
                results.success++;
                setHistory((h) => [res.data, ...h].slice(0, 30));
            } catch (err) {
                results.failed++;
                results.errors.push(`${parts[0]}/${parts[1]}: ${err.response?.data?.detail || 'Failed'}`);
            }
        }
        setBulkResults(results);
        setSuccess(`Bulk complete: ${results.success} succeeded, ${results.failed} failed`);
    };

    return (
        <div className="space-y-6">
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Admin Panel
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    Ingest marksheet data with student names · {history.length} records in session
                </p>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2, width: 'fit-content' }}>
                {[false, true].map(mode => (
                    <button key={String(mode)} onClick={() => setBulkMode(mode)}
                        style={{
                            padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                            background: bulkMode === mode ? 'rgba(99,102,241,0.2)' : 'transparent',
                            color: bulkMode === mode ? '#818cf8' : '#5a6a96',
                            transition: 'all 0.2s ease',
                        }}>
                        {mode ? 'Bulk CSV' : 'Single Record'}
                    </button>
                ))}
            </div>

            {!bulkMode ? (
                /* ── Single record form ── */
                <form onSubmit={handleSubmit} className="card animate-fade-in" style={{ padding: '24px' }}>
                    {/* Row 1: Student name + Class level + Stream */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="label">Student Name</label>
                            <input id="admin-name" type="text" value={form.student_name}
                                onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                                placeholder="e.g. Amit Sharma" className="input-field" required />
                        </div>
                        <div>
                            <label className="label">Class Level</label>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                {['Class 10', 'Class 12'].map(level => (
                                    <button key={level} type="button" onClick={() => handleClassLevelChange(level)}
                                        style={{
                                            flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                                            background: form.class_level === level ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                            color: form.class_level === level ? '#818cf8' : '#5a6a96',
                                            transition: 'all 0.2s ease',
                                            border: form.class_level === level ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        }}>
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="label">Stream</label>
                            <select id="admin-stream" value={form.stream}
                                onChange={(e) => handleStreamChange(e.target.value)}
                                className="input-field">
                                <option value="">Select stream</option>
                                {streamOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Row 2: Board, Subject, Year */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="label">Board</label>
                            <select id="admin-board" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} className="input-field" required>
                                {boards.map((b) => <option key={b.board_id} value={b.board_name}>{b.board_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Subject</label>
                            <select id="admin-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" required>
                                <option value="">Select subject</option>
                                {availableSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Exam Year</label>
                            <input id="admin-year" type="number" min="2000" max="2027" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2022" className="input-field" required />
                        </div>
                    </div>
                    {/* Row 3: Marks, Max Marks */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Marks</label>
                            <input id="admin-marks" type="number" min="0" step="0.01" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} placeholder="e.g. 78" className="input-field" required />
                        </div>
                        <div>
                            <label className="label">Max Marks</label>
                            <input id="admin-max-marks" type="number" min="1" step="0.01" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} placeholder="e.g. 100" className="input-field" required />
                        </div>
                    </div>

                    {/* Stream info */}
                    {form.stream && (
                        <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', fontSize: '0.6875rem', color: '#818cf8' }}>
                            📚 {form.class_level} — {form.stream} → {availableSubjects.length} subjects available
                        </div>
                    )}

                    {error && <div style={{ marginTop: 16, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: '0.8125rem', color: '#fb7185' }}>{error}</div>}
                    {success && <div style={{ marginTop: 16, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: '0.8125rem', color: '#34d399' }}>{success}</div>}

                    <div style={{ marginTop: 20 }}>
                        <button id="admin-submit" type="submit" disabled={loading} className="btn-secondary">
                            {loading ? (
                                <><span className="inline-block w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Ingesting...</>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    Ingest Record
                                </>
                            )}
                        </button>
                    </div>
                </form>
            ) : (
                /* ── Bulk CSV mode ── */
                <div className="card animate-fade-in" style={{ padding: '24px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 4 }}>Bulk CSV Import</h3>
                    <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginBottom: 16 }}>
                        One record per line:{' '}
                        <code style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                            Name, Board, ClassLevel, Stream, Subject, Year, Marks, MaxMarks
                        </code>
                    </p>
                    <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={`Amit Sharma, CBSE, Class 12, Science (PCM), Mathematics, 2022, 78, 100\nPriya Patel, ICSE, Class 12, Commerce, Accountancy, 2021, 85, 100\nRahul Kumar, CBSE, Class 10, General, Science, 2023, 72, 100`}
                        className="input-field"
                        style={{ minHeight: 140, fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.8125rem', resize: 'vertical' }}
                    />
                    {success && <div style={{ marginTop: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: '0.8125rem', color: '#34d399' }}>{success}</div>}
                    {bulkResults.errors.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#fb7185' }}>
                            {bulkResults.errors.slice(0, 5).map((e, i) => <p key={i}>• {e}</p>)}
                        </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                        <button onClick={handleBulkIngest} className="btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" /></svg>
                            Import All
                        </button>
                    </div>
                </div>
            )}

            {/* History Table */}
            {history.length > 0 && (
                <div className="card overflow-hidden animate-fade-in">
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Ingestion Log</h3>
                        <span className="badge badge-emerald">{history.length} records</span>
                    </div>
                    <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Board</th>
                                    <th>Level</th>
                                    <th>Subject</th>
                                    <th>Year</th>
                                    <th style={{ textAlign: 'right' }}>Marks</th>
                                    <th style={{ textAlign: 'right' }}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h, i) => (
                                    <tr key={i}>
                                        <td className="num-highlight" style={{ color: '#5a6a96' }}>#{h.student_id}</td>
                                        <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{h.student_name || '—'}</td>
                                        <td>{h.board}</td>
                                        <td><span className="badge badge-cyan" style={{ fontSize: '0.5625rem' }}>{h.class_level}</span></td>
                                        <td><span className="badge badge-indigo">{h.subject}</span></td>
                                        <td>{h.exam_year}</td>
                                        <td style={{ textAlign: 'right' }} className="num-highlight">{h.marks}/{h.max_marks}</td>
                                        <td style={{ textAlign: 'right', color: '#22d3ee', fontWeight: 600 }} className="num-highlight">{h.percentage_score}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Info card */}
            <div className="card" style={{ padding: '18px 22px', borderLeft: '3px solid #6366f1' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#818cf8', marginBottom: 4 }}>How Incremental Learning Works</h4>
                <p style={{ fontSize: '0.75rem', color: '#5a6a96', lineHeight: 1.7 }}>
                    Every record you ingest updates the statistics <strong style={{ color: '#8b9cc7' }}>instantly</strong> using
                    Welford's online algorithm — no batch recomputation needed. The system computes a running mean and variance
                    incrementally: <code style={{ color: '#22d3ee', background: 'rgba(6,182,212,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: '0.6875rem' }}>
                        new_mean = old_mean + (x - old_mean) / n</code>. This means the normalization engine learns from
                    every new data point in real-time.
                </p>
            </div>

            {/* Subject mapping reference */}
            <div className="card" style={{ padding: '18px 22px', borderLeft: '3px solid #f59e0b' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#fbbf24', marginBottom: 8 }}>Subject Mapping Reference</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(STREAM_SUBJECTS).map(([level, streams]) =>
                        Object.entries(streams).map(([stream, subjects]) => (
                            <div key={`${level}-${stream}`} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px' }}>
                                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8b9cc7', marginBottom: 4 }}>{level} — {stream}</p>
                                <div className="flex flex-wrap gap-1">
                                    {subjects.map(s => (
                                        <span key={s} className="badge" style={{ background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: '0.5625rem' }}>{s}</span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
