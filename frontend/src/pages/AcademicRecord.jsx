import { useEffect, useState, useMemo } from 'react';
import {
    getBoards, getAcademicOrganizations, getAcademicCourseTypes,
    getAcademicCourses, getAcademicStreams, getAcademicSubjects,
    createAcademicRecord,
} from '../api/client';

const STEPS = [
    { key: 'class', label: 'Class Level', icon: '🎓' },
    { key: 'board', label: 'Board', icon: '📋' },
    { key: 'org', label: 'Organization', icon: '🏛️' },
    { key: 'ctype', label: 'Course Type', icon: '📚' },
    { key: 'program', label: 'Program', icon: '🎯' },
    { key: 'stream', label: 'Stream', icon: '🔀' },
    { key: 'subjects', label: 'Subjects', icon: '📝' },
    { key: 'info', label: 'Student Info', icon: '👤' },
];

export default function AcademicRecord() {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        class_level: '', board_id: '', organization_id: '', course_type_id: '',
        program_id: '', stream_id: '', subjects: [], student_name: '', exam_year: '',
    });
    const [subjectMarks, setSubjectMarks] = useState({});

    // Dropdown data
    const [boards, setBoards] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [courseTypes, setCourseTypes] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [streams, setStreams] = useState([]);
    const [subjects, setSubjects] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    // Load boards & orgs once
    useEffect(() => {
        getBoards().then(r => setBoards(r.data));
        getAcademicOrganizations().then(r => setOrgs(r.data));
    }, []);

    // Load course types when org selected
    useEffect(() => {
        if (form.organization_id) {
            getAcademicCourseTypes({ organization_id: form.organization_id }).then(r => setCourseTypes(r.data));
        } else {
            setCourseTypes([]);
        }
        setForm(f => ({ ...f, course_type_id: '', program_id: '' }));
        setPrograms([]);
    }, [form.organization_id]);

    // Load programs when org + course type selected
    useEffect(() => {
        if (form.organization_id && form.course_type_id) {
            getAcademicCourses({ organization_id: form.organization_id, course_type_id: form.course_type_id }).then(r => setPrograms(r.data));
        } else {
            setPrograms([]);
        }
        setForm(f => ({ ...f, program_id: '' }));
    }, [form.organization_id, form.course_type_id]);

    // Load streams when class level is 12
    useEffect(() => {
        if (form.class_level) {
            getAcademicStreams({ class_level: form.class_level }).then(r => setStreams(r.data));
        } else {
            setStreams([]);
        }
    }, [form.class_level]);

    // Load subjects when board + stream/class_level selected
    useEffect(() => {
        if (form.board_id && form.class_level) {
            const params = { board_id: form.board_id, class_level: form.class_level };
            if (form.stream_id) params.stream_id = form.stream_id;
            getAcademicSubjects(params).then(r => setSubjects(r.data));
        } else {
            setSubjects([]);
        }
    }, [form.board_id, form.class_level, form.stream_id]);

    // Determine effective steps (hide stream for Class 10)
    const effectiveSteps = useMemo(() => {
        if (form.class_level === 'Class 10') {
            return STEPS.filter(s => s.key !== 'stream');
        }
        return STEPS;
    }, [form.class_level]);

    const canProceed = () => {
        const s = effectiveSteps[step];
        if (!s) return false;
        switch (s.key) {
            case 'class': return !!form.class_level;
            case 'board': return !!form.board_id;
            case 'org': return !!form.organization_id;
            case 'ctype': return !!form.course_type_id;
            case 'program': return !!form.program_id;
            case 'stream': return !!form.stream_id;
            case 'subjects': return form.subjects.length >= 3 && form.subjects.every(id => subjectMarks[id]?.marks && subjectMarks[id]?.max_marks);
            case 'info': return !!form.student_name && !!form.exam_year;
            default: return false;
        }
    };

    const toggleSubject = (id) => {
        setForm(f => {
            const subs = f.subjects.includes(id) ? f.subjects.filter(s => s !== id) : [...f.subjects, id];
            return { ...f, subjects: subs };
        });
        if (!subjectMarks[id]) {
            setSubjectMarks(m => ({ ...m, [id]: { marks: '', max_marks: '100' } }));
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const payload = {
                student_name: form.student_name.trim(),
                board_id: parseInt(form.board_id),
                class_level: form.class_level,
                stream_id: form.stream_id ? parseInt(form.stream_id) : null,
                organization_id: parseInt(form.organization_id),
                course_type_id: parseInt(form.course_type_id),
                program_id: parseInt(form.program_id),
                exam_year: parseInt(form.exam_year),
                subjects: form.subjects.map(id => ({
                    subject_id: id,
                    marks: parseFloat(subjectMarks[id]?.marks || 0),
                    max_marks: parseFloat(subjectMarks[id]?.max_marks || 100),
                })),
            };
            const res = await createAcademicRecord(payload);
            setSuccess(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Submission failed');
        } finally { setLoading(false); }
    };

    if (success) {
        return (
            <div className="space-y-6">
                <div className="animate-fade-in">
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        <span style={{ background: 'linear-gradient(135deg, #10b981, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            ✓ Record Created Successfully
                        </span>
                    </h1>
                </div>
                <div className="card animate-fade-in" style={{ padding: 24, borderLeft: '3px solid #10b981' }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.125rem', color: '#f0f4ff', marginBottom: 16 }}>{success.student_name}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="badge badge-indigo">{success.board_name}</span>
                        <span className="badge badge-cyan">{success.class_level}</span>
                        {success.stream_name && <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>{success.stream_name}</span>}
                        <span className="badge badge-amber">{success.organization_name}</span>
                        <span className="badge badge-emerald">{success.program_name}</span>
                        <span className="badge" style={{ background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>{success.exam_year}</span>
                    </div>
                    <table className="data-table">
                        <thead><tr><th>Subject</th><th style={{ textAlign: 'right' }}>Marks</th><th style={{ textAlign: 'right' }}>Max</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
                        <tbody>
                            {success.subjects.map((s, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{s.subject}</td>
                                    <td style={{ textAlign: 'right' }} className="num-highlight">{s.marks}</td>
                                    <td style={{ textAlign: 'right' }} className="num-highlight">{s.max_marks}</td>
                                    <td style={{ textAlign: 'right', color: '#22d3ee', fontWeight: 600 }} className="num-highlight">{s.percentage?.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={() => { setSuccess(null); setStep(0); setForm({ class_level: '', board_id: '', organization_id: '', course_type_id: '', program_id: '', stream_id: '', subjects: [], student_name: '', exam_year: '' }); setSubjectMarks({}); }}
                        className="btn-primary" style={{ marginTop: 16 }}>
                        + Add Another Record
                    </button>
                </div>
            </div>
        );
    }

    const currentStep = effectiveSteps[step];

    return (
        <div className="space-y-6">
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Academic Record
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    Step-by-step academic data entry with validated fields
                </p>
            </div>

            {/* Progress bar */}
            <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {effectiveSteps.map((s, i) => (
                        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                            <button
                                onClick={() => i <= step && setStep(i)}
                                disabled={i > step}
                                style={{
                                    width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: i <= step ? 'pointer' : 'default',
                                    fontSize: '0.75rem', fontFamily: 'Inter, sans-serif',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: i < step ? 'rgba(16,185,129,0.2)' : i === step ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
                                    color: i < step ? '#34d399' : i === step ? '#818cf8' : '#5a6a96',
                                    fontWeight: 700, transition: 'all 0.2s ease',
                                }}>
                                {i < step ? '✓' : s.icon}
                            </button>
                            {i < effectiveSteps.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: i < step ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
                            )}
                        </div>
                    ))}
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#818cf8', fontWeight: 600, marginTop: 10 }}>
                    Step {step + 1}: {currentStep?.label}
                </p>
            </div>

            {/* Step Content */}
            <div className="card animate-fade-in" style={{ padding: 24 }} key={currentStep?.key}>
                {currentStep?.key === 'class' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 16 }}>Select Academic Level</h3>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {['Class 10', 'Class 12'].map(level => (
                                <button key={level} onClick={() => { setForm(f => ({ ...f, class_level: level, stream_id: '', subjects: [] })); setSubjectMarks({}); }}
                                    style={{
                                        flex: 1, padding: '24px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                        background: form.class_level === level ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: form.class_level === level ? '2px solid rgba(99,102,241,0.4)' : '2px solid rgba(255,255,255,0.06)',
                                        transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif',
                                    }}>
                                    <p style={{ fontSize: '2rem', marginBottom: 8 }}>{level === 'Class 10' ? '🔟' : '🔢'}</p>
                                    <p style={{ fontWeight: 700, fontSize: '1rem', color: form.class_level === level ? '#818cf8' : '#f0f4ff' }}>{level}</p>
                                    <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 4 }}>
                                        {level === 'Class 10' ? 'Secondary Education' : 'Senior Secondary Education'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep?.key === 'board' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 16 }}>Select Board</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {boards.map(b => (
                                <button key={b.board_id} onClick={() => setForm(f => ({ ...f, board_id: String(b.board_id), subjects: [] }))}
                                    style={{
                                        padding: '16px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                        background: form.board_id === String(b.board_id) ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: form.board_id === String(b.board_id) ? '2px solid rgba(99,102,241,0.4)' : '2px solid rgba(255,255,255,0.06)',
                                        transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif', textAlign: 'center',
                                    }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: form.board_id === String(b.board_id) ? '#818cf8' : '#f0f4ff' }}>
                                        {b.board_name}
                                    </p>
                                    <p style={{ fontSize: '0.5625rem', color: '#5a6a96', marginTop: 2 }}>{b.board_category}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep?.key === 'org' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 16 }}>Select Organization</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {orgs.map(o => (
                                <button key={o.id} onClick={() => setForm(f => ({ ...f, organization_id: String(o.id), course_type_id: '', program_id: '' }))}
                                    style={{
                                        padding: '16px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                        background: form.organization_id === String(o.id) ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: form.organization_id === String(o.id) ? '2px solid rgba(99,102,241,0.4)' : '2px solid rgba(255,255,255,0.06)',
                                        transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif', textAlign: 'center',
                                    }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: form.organization_id === String(o.id) ? '#818cf8' : '#f0f4ff' }}>
                                        {o.name}
                                    </p>
                                    <p style={{ fontSize: '0.5625rem', color: '#5a6a96', marginTop: 2 }}>{o.location}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep?.key === 'ctype' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 4 }}>Select Course Type</h3>
                        <p style={{ fontSize: '0.75rem', color: '#5a6a96', marginBottom: 16 }}>
                            Showing course types available at {orgs.find(o => o.id === parseInt(form.organization_id))?.name || '—'}
                        </p>
                        {courseTypes.length === 0 ? (
                            <p style={{ color: '#fb7185', fontSize: '0.8125rem' }}>⚠️ No course types configured for this organization</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {courseTypes.map(ct => (
                                    <button key={ct.id} onClick={() => setForm(f => ({ ...f, course_type_id: String(ct.id), program_id: '' }))}
                                        style={{
                                            padding: '16px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                            background: form.course_type_id === String(ct.id) ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
                                            border: form.course_type_id === String(ct.id) ? '2px solid rgba(6,182,212,0.4)' : '2px solid rgba(255,255,255,0.06)',
                                            transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif', textAlign: 'center',
                                        }}>
                                        <p style={{ fontWeight: 700, fontSize: '1rem', color: form.course_type_id === String(ct.id) ? '#22d3ee' : '#f0f4ff' }}>
                                            {ct.name}
                                        </p>
                                        <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 4 }}>{ct.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentStep?.key === 'program' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 4 }}>Select Program</h3>
                        <p style={{ fontSize: '0.75rem', color: '#5a6a96', marginBottom: 16 }}>
                            {courseTypes.find(ct => ct.id === parseInt(form.course_type_id))?.name} programs at {orgs.find(o => o.id === parseInt(form.organization_id))?.name}
                        </p>
                        {programs.length === 0 ? (
                            <p style={{ color: '#fb7185', fontSize: '0.8125rem' }}>⚠️ No programs configured for this combination</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {programs.map(p => (
                                    <button key={p.id} onClick={() => setForm(f => ({ ...f, program_id: String(p.id) }))}
                                        style={{
                                            padding: '16px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                                            background: form.program_id === String(p.id) ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                                            border: form.program_id === String(p.id) ? '2px solid rgba(16,185,129,0.4)' : '2px solid rgba(255,255,255,0.06)',
                                            transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif',
                                        }}>
                                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: form.program_id === String(p.id) ? '#34d399' : '#f0f4ff' }}>
                                            {p.name}
                                        </p>
                                        <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 4 }}>{p.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentStep?.key === 'stream' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 16 }}>Select Stream</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {streams.map(s => (
                                <button key={s.id} onClick={() => { setForm(f => ({ ...f, stream_id: String(s.id), subjects: [] })); setSubjectMarks({}); }}
                                    style={{
                                        padding: '16px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                        background: form.stream_id === String(s.id) ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: form.stream_id === String(s.id) ? '2px solid rgba(139,92,246,0.4)' : '2px solid rgba(255,255,255,0.06)',
                                        transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif', textAlign: 'center',
                                    }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: form.stream_id === String(s.id) ? '#a78bfa' : '#f0f4ff' }}>
                                        {s.name}
                                    </p>
                                    <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 2 }}>{s.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep?.key === 'subjects' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 4 }}>Select Subjects & Enter Marks</h3>
                        <p style={{ fontSize: '0.75rem', color: '#5a6a96', marginBottom: 16 }}>
                            Select at least 3 subjects. {form.subjects.length} selected.
                        </p>
                        {subjects.length === 0 ? (
                            <p style={{ color: '#fb7185', fontSize: '0.8125rem' }}>⚠️ No subjects available for this board/stream combination</p>
                        ) : (
                            <div className="space-y-3">
                                {/* Subject selection */}
                                <div className="flex flex-wrap gap-2">
                                    {subjects.map(s => (
                                        <button key={s.id} onClick={() => toggleSubject(s.id)}
                                            style={{
                                                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                                background: form.subjects.includes(s.id) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                                border: form.subjects.includes(s.id) ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                                color: form.subjects.includes(s.id) ? '#818cf8' : '#8b9cc7',
                                                fontWeight: 600, fontSize: '0.75rem', fontFamily: 'Inter, sans-serif',
                                                transition: 'all 0.15s ease',
                                            }}>
                                            {form.subjects.includes(s.id) ? '✓ ' : ''}{s.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Marks entry for selected subjects */}
                                {form.subjects.length > 0 && (
                                    <div style={{ marginTop: 16 }}>
                                        <h4 style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#8b9cc7', marginBottom: 8 }}>Enter Marks</h4>
                                        <div className="space-y-2">
                                            {form.subjects.map(sid => {
                                                const subj = subjects.find(s => s.id === sid);
                                                const m = subjectMarks[sid] || { marks: '', max_marks: '100' };
                                                return (
                                                    <div key={sid} className="grid grid-cols-3 gap-3 items-center" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#f0f4ff' }}>{subj?.name}</span>
                                                        <input type="number" min="0" step="0.01" placeholder="Marks" className="input-field" style={{ height: 36 }}
                                                            value={m.marks}
                                                            onChange={e => setSubjectMarks(p => ({ ...p, [sid]: { ...p[sid], marks: e.target.value } }))} />
                                                        <input type="number" min="1" step="0.01" placeholder="Max marks" className="input-field" style={{ height: 36 }}
                                                            value={m.max_marks}
                                                            onChange={e => setSubjectMarks(p => ({ ...p, [sid]: { ...p[sid], max_marks: e.target.value } }))} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {currentStep?.key === 'info' && (
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f0f4ff', marginBottom: 16 }}>Student Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Student Name</label>
                                <input className="input-field" placeholder="e.g. Amit Sharma" required
                                    value={form.student_name}
                                    onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="label">Exam Year</label>
                                <input type="number" className="input-field" placeholder="e.g. 2024" min="2000" max="2027"
                                    value={form.exam_year}
                                    onChange={e => setForm(f => ({ ...f, exam_year: e.target.value }))} />
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={{ marginTop: 20, padding: '16px', borderRadius: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                            <h4 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#818cf8', marginBottom: 8 }}>Review Summary</h4>
                            <div className="flex flex-wrap gap-2">
                                <span className="badge badge-cyan">{form.class_level}</span>
                                <span className="badge badge-indigo">{boards.find(b => b.board_id === parseInt(form.board_id))?.board_name}</span>
                                <span className="badge badge-amber">{orgs.find(o => o.id === parseInt(form.organization_id))?.name}</span>
                                <span className="badge badge-emerald">{courseTypes.find(ct => ct.id === parseInt(form.course_type_id))?.name}</span>
                                <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>{programs.find(p => p.id === parseInt(form.program_id))?.name}</span>
                                {form.stream_id && <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>{streams.find(s => s.id === parseInt(form.stream_id))?.name}</span>}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#5a6a96', marginTop: 8 }}>
                                {form.subjects.length} subjects selected
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ marginTop: 16, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: '0.8125rem', color: '#fb7185' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                    <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                        className="btn-secondary" style={{ opacity: step === 0 ? 0.3 : 1 }}>
                        ← Back
                    </button>
                    {step < effectiveSteps.length - 1 ? (
                        <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="btn-primary"
                            style={{ opacity: canProceed() ? 1 : 0.4 }}>
                            Next →
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={!canProceed() || loading} className="btn-primary">
                            {loading ? (
                                <><span className="inline-block w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Submitting...</>
                            ) : '✓ Submit Academic Record'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
