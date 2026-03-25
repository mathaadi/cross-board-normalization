import { useEffect, useState } from 'react';
import {
    adminGetBoards, adminCreateBoard, adminDeleteBoard,
    adminGetOrgs, adminCreateOrg, adminDeleteOrg, adminGetOrgDetail,
    adminGetStreams, adminCreateStream, adminDeleteStream,
    adminGetSubjects, adminCreateSubject, adminDeleteSubject,
    adminGetBoardSubjectMapping, adminAddBoardSubjectMapping, adminRemoveBoardSubjectMapping,
    adminGetStreamSubjectMapping, adminAddStreamSubjectMapping, adminRemoveStreamSubjectMapping,
    adminGetOrgCourseTypeMapping, adminAddOrgCourseTypeMapping, adminRemoveOrgCourseTypeMapping,
    getAcademicCourseTypes,
} from '../api/client';

const TABS = ['Boards', 'Organizations', 'Streams', 'Subjects', 'Mappings'];

export default function AdminPanel() {
    const [tab, setTab] = useState('Boards');
    const [msg, setMsg] = useState({ text: '', type: '' });

    const showMsg = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    };

    return (
        <div className="space-y-6">
            <div className="animate-fade-in">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    <span style={{ background: 'linear-gradient(135deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Admin Portal
                    </span>
                </h1>
                <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
                    Manage boards, organizations, streams, subjects, and mappings
                </p>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        style={{
                            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                            background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                            color: tab === t ? '#818cf8' : '#5a6a96',
                            transition: 'all 0.2s ease',
                        }}>
                        {t}
                    </button>
                ))}
            </div>

            {msg.text && (
                <div style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: '0.8125rem',
                    background: msg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                    border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                    color: msg.type === 'success' ? '#34d399' : '#fb7185',
                }}>
                    {msg.text}
                </div>
            )}

            {tab === 'Boards' && <BoardsTab showMsg={showMsg} />}
            {tab === 'Organizations' && <OrganizationsTab showMsg={showMsg} />}
            {tab === 'Streams' && <StreamsTab showMsg={showMsg} />}
            {tab === 'Subjects' && <SubjectsTab showMsg={showMsg} />}
            {tab === 'Mappings' && <MappingsTab showMsg={showMsg} />}
        </div>
    );
}

// ── Boards Tab ──────────────────────────────────────────────────
function BoardsTab({ showMsg }) {
    const [boards, setBoards] = useState([]);
    const [form, setForm] = useState({ board_name: '', board_category: '', country: 'India' });
    const [loading, setLoading] = useState(true);

    const load = () => { setLoading(true); adminGetBoards().then(r => setBoards(r.data)).finally(() => setLoading(false)); };
    useEffect(load, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await adminCreateBoard(form);
            showMsg(`✓ Board "${form.board_name}" created`);
            setForm({ board_name: '', board_category: '', country: 'India' });
            load();
        } catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete board "${name}"?`)) return;
        try { await adminDeleteBoard(id); showMsg(`Board "${name}" deleted`); load(); }
        catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <form onSubmit={handleCreate} className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>Add Board</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className="input-field" placeholder="Board name" required value={form.board_name} onChange={e => setForm({ ...form, board_name: e.target.value })} />
                    <select className="input-field" value={form.board_category} onChange={e => setForm({ ...form, board_category: e.target.value })}>
                        <option value="">Category</option>
                        <option value="National">National</option>
                        <option value="State">State</option>
                        <option value="International">International</option>
                    </select>
                    <button type="submit" className="btn-primary" style={{ height: 42 }}>+ Add Board</button>
                </div>
            </form>

            <div className="card overflow-hidden">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Boards</h3>
                    <span className="badge badge-indigo">{boards.length}</span>
                </div>
                {loading ? <div className="p-6"><div className="h-20 skeleton" /></div> : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Country</th><th>Status</th><th></th></tr></thead>
                            <tbody>
                                {boards.map(b => (
                                    <tr key={b.board_id}>
                                        <td className="num-highlight" style={{ color: '#5a6a96' }}>#{b.board_id}</td>
                                        <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{b.board_name}</td>
                                        <td><span className="badge badge-cyan">{b.board_category || '—'}</span></td>
                                        <td>{b.country}</td>
                                        <td><span className={`badge ${b.active ? 'badge-emerald' : 'badge-amber'}`}>{b.active ? 'Active' : 'Inactive'}</span></td>
                                        <td>
                                            <button onClick={() => handleDelete(b.board_id, b.board_name)}
                                                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Organizations Tab ───────────────────────────────────────────
function OrganizationsTab({ showMsg }) {
    const [orgs, setOrgs] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [orgDetail, setOrgDetail] = useState(null);
    const [form, setForm] = useState({ name: '', location: '' });
    const [loading, setLoading] = useState(true);

    const load = () => { setLoading(true); adminGetOrgs().then(r => setOrgs(r.data)).finally(() => setLoading(false)); };
    useEffect(load, []);

    const selectOrg = async (org) => {
        setSelectedOrg(org);
        try {
            const r = await adminGetOrgDetail(org.id);
            setOrgDetail(r.data);
        } catch { setOrgDetail(null); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await adminCreateOrg(form);
            showMsg(`✓ Organization "${form.name}" created`);
            setForm({ name: '', location: '' });
            load();
        } catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete organization "${name}"?`)) return;
        try { await adminDeleteOrg(id); showMsg(`Organization "${name}" deleted`); load(); setSelectedOrg(null); setOrgDetail(null); }
        catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <form onSubmit={handleCreate} className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>Add Organization</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className="input-field" placeholder="Organization name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <input className="input-field" placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    <button type="submit" className="btn-primary" style={{ height: 42 }}>+ Add Organization</button>
                </div>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Org List */}
                <div className="card overflow-hidden" style={{ maxHeight: 500 }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between">
                            <h3 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#f0f4ff' }}>Organizations</h3>
                            <span className="badge badge-indigo">{orgs.length}</span>
                        </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 440 }}>
                        {loading ? <div className="p-4"><div className="h-20 skeleton" /></div> : orgs.map(o => (
                            <button key={o.id} onClick={() => selectOrg(o)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '12px 18px',
                                    border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    background: selectedOrg?.id === o.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                                    transition: 'background 0.15s ease',
                                }}>
                                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#f0f4ff' }}>{o.name}</p>
                                <p style={{ fontSize: '0.6875rem', color: '#5a6a96' }}>{o.location || '—'}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Org Detail */}
                <div className="lg:col-span-2">
                    {!orgDetail ? (
                        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <p style={{ fontSize: '2rem', marginBottom: 8 }}>🏛️</p>
                            <p style={{ color: '#8b9cc7', fontWeight: 600 }}>Select an organization</p>
                            <p style={{ color: '#5a6a96', fontSize: '0.8125rem' }}>Click on an org to view its course types and programs</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className="card" style={{ padding: 20, borderLeft: '3px solid #6366f1' }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 style={{ fontWeight: 800, fontSize: '1.125rem', color: '#f0f4ff' }}>{orgDetail.name}</h2>
                                        <p style={{ fontSize: '0.75rem', color: '#5a6a96' }}>{orgDetail.location} · {orgDetail.course_types.length} course types</p>
                                    </div>
                                    <button onClick={() => handleDelete(orgDetail.id, orgDetail.name)}
                                        style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>
                                        Delete Org
                                    </button>
                                </div>
                            </div>

                            {orgDetail.course_types.map(ct => (
                                <div key={ct.id} className="card" style={{ padding: 18 }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="badge badge-cyan" style={{ fontSize: '0.6875rem' }}>{ct.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#5a6a96' }}>{ct.description}</span>
                                        <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>{ct.programs.length} programs</span>
                                    </div>
                                    {ct.programs.length === 0 ? (
                                        <p style={{ fontSize: '0.75rem', color: '#5a6a96', fontStyle: 'italic' }}>No programs configured</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {ct.programs.map(p => (
                                                <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#f0f4ff' }}>{p.name}</p>
                                                    <p style={{ fontSize: '0.6875rem', color: '#5a6a96' }}>{p.description || '—'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Streams Tab ─────────────────────────────────────────────────
function StreamsTab({ showMsg }) {
    const [streams, setStreams] = useState([]);
    const [form, setForm] = useState({ name: '', class_level: 'Class 12', description: '' });
    const [loading, setLoading] = useState(true);

    const load = () => { setLoading(true); adminGetStreams().then(r => setStreams(r.data)).finally(() => setLoading(false)); };
    useEffect(load, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await adminCreateStream(form);
            showMsg(`✓ Stream "${form.name}" created`);
            setForm({ name: '', class_level: 'Class 12', description: '' });
            load();
        } catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete stream "${name}"?`)) return;
        try { await adminDeleteStream(id); showMsg(`Stream "${name}" deleted`); load(); }
        catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <form onSubmit={handleCreate} className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>Add Stream</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input className="input-field" placeholder="Stream name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <select className="input-field" value={form.class_level} onChange={e => setForm({ ...form, class_level: e.target.value })}>
                        <option value="Class 10">Class 10</option>
                        <option value="Class 12">Class 12</option>
                        <option value="Both">Both</option>
                    </select>
                    <input className="input-field" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    <button type="submit" className="btn-primary" style={{ height: 42 }}>+ Add Stream</button>
                </div>
            </form>

            <div className="card overflow-hidden">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Streams</h3>
                    <span className="badge badge-indigo">{streams.length}</span>
                </div>
                {loading ? <div className="p-4"><div className="h-20 skeleton" /></div> : (
                    <table className="data-table">
                        <thead><tr><th>ID</th><th>Name</th><th>Class Level</th><th>Description</th><th></th></tr></thead>
                        <tbody>
                            {streams.map(s => (
                                <tr key={s.id}>
                                    <td className="num-highlight" style={{ color: '#5a6a96' }}>#{s.id}</td>
                                    <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{s.name}</td>
                                    <td><span className="badge badge-cyan">{s.class_level}</span></td>
                                    <td style={{ color: '#8b9cc7', fontSize: '0.75rem' }}>{s.description || '—'}</td>
                                    <td>
                                        <button onClick={() => handleDelete(s.id, s.name)}
                                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── Subjects Tab ────────────────────────────────────────────────
function SubjectsTab({ showMsg }) {
    const [subjects, setSubjects] = useState([]);
    const [form, setForm] = useState({ name: '' });
    const [loading, setLoading] = useState(true);

    const load = () => { setLoading(true); adminGetSubjects().then(r => setSubjects(r.data)).finally(() => setLoading(false)); };
    useEffect(load, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await adminCreateSubject(form);
            showMsg(`✓ Subject "${form.name}" created`);
            setForm({ name: '' });
            load();
        } catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete subject "${name}"?`)) return;
        try { await adminDeleteSubject(id); showMsg(`Subject "${name}" deleted`); load(); }
        catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <form onSubmit={handleCreate} className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>Add Subject</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className="input-field" placeholder="Subject name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <button type="submit" className="btn-primary" style={{ height: 42 }}>+ Add Subject</button>
                </div>
            </form>

            <div className="card overflow-hidden">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Subject Catalog</h3>
                    <span className="badge badge-indigo">{subjects.length}</span>
                </div>
                {loading ? <div className="p-4"><div className="h-20 skeleton" /></div> : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2" style={{ padding: 16 }}>
                        {subjects.map(s => (
                            <div key={s.id} className="flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '0.75rem', color: '#f0f4ff', fontWeight: 500 }}>{s.name}</span>
                                <button onClick={() => handleDelete(s.id, s.name)}
                                    style={{ padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.5625rem', fontFamily: 'Inter, sans-serif', background: 'rgba(244,63,94,0.1)', color: '#fb7185', lineHeight: 1 }}>
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Mappings Tab ────────────────────────────────────────────────
function MappingsTab({ showMsg }) {
    const [subTab, setSubTab] = useState('board-subject');
    const [boards, setBoards] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [streams, setStreams] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [courseTypes, setCourseTypes] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [form, setForm] = useState({ source_id: '', target_id: '', class_level: 'Class 12' });

    useEffect(() => {
        adminGetBoards().then(r => setBoards(r.data));
        adminGetSubjects().then(r => setSubjects(r.data));
        adminGetStreams().then(r => setStreams(r.data));
        adminGetOrgs().then(r => setOrgs(r.data));
        getAcademicCourseTypes({}).then(r => setCourseTypes(r.data));
    }, []);

    const loadMappings = () => {
        if (subTab === 'board-subject') {
            adminGetBoardSubjectMapping({}).then(r => setMappings(r.data));
        } else if (subTab === 'stream-subject') {
            adminGetStreamSubjectMapping({}).then(r => setMappings(r.data));
        } else if (subTab === 'org-coursetype') {
            adminGetOrgCourseTypeMapping({}).then(r => setMappings(r.data));
        }
    };
    useEffect(loadMappings, [subTab]);

    const handleAdd = async () => {
        if (!form.source_id || !form.target_id) return;
        try {
            if (subTab === 'board-subject') {
                await adminAddBoardSubjectMapping(form);
            } else if (subTab === 'stream-subject') {
                await adminAddStreamSubjectMapping(form);
            } else if (subTab === 'org-coursetype') {
                await adminAddOrgCourseTypeMapping(form);
            }
            showMsg('✓ Mapping added');
            setForm({ source_id: '', target_id: '', class_level: 'Class 12' });
            loadMappings();
        } catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    const handleRemove = async (item) => {
        try {
            if (subTab === 'board-subject') {
                await adminRemoveBoardSubjectMapping(item.id);
            } else if (subTab === 'stream-subject') {
                await adminRemoveStreamSubjectMapping(item.id);
            } else if (subTab === 'org-coursetype') {
                await adminRemoveOrgCourseTypeMapping(item.organization_id, item.course_type_id);
            }
            showMsg('Mapping removed');
            loadMappings();
        } catch (err) { showMsg(err.response?.data?.detail || 'Failed', 'error'); }
    };

    const SUB_TABS = [
        { key: 'board-subject', label: 'Board ↔ Subject' },
        { key: 'stream-subject', label: 'Stream ↔ Subject' },
        { key: 'org-coursetype', label: 'Org ↔ Course Type' },
    ];

    return (
        <div className="space-y-4 animate-fade-in">
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2, width: 'fit-content' }}>
                {SUB_TABS.map(st => (
                    <button key={st.key} onClick={() => { setSubTab(st.key); setForm({ source_id: '', target_id: '', class_level: 'Class 12' }); }}
                        style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                            background: subTab === st.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: subTab === st.key ? '#818cf8' : '#5a6a96',
                        }}>
                        {st.label}
                    </button>
                ))}
            </div>

            {/* Add Mapping Form */}
            <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff', marginBottom: 12 }}>
                    Add {SUB_TABS.find(s => s.key === subTab)?.label} Mapping
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select className="input-field" value={form.source_id} onChange={e => setForm({ ...form, source_id: e.target.value })}>
                        <option value="">
                            {subTab === 'board-subject' ? 'Select Board' : subTab === 'stream-subject' ? 'Select Stream' : 'Select Organization'}
                        </option>
                        {(subTab === 'board-subject' ? boards.map(b => ({ id: b.board_id, name: b.board_name })) :
                            subTab === 'stream-subject' ? streams.map(s => ({ id: s.id, name: s.name })) :
                                orgs.map(o => ({ id: o.id, name: o.name }))).map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                    </select>
                    <select className="input-field" value={form.target_id} onChange={e => setForm({ ...form, target_id: e.target.value })}>
                        <option value="">
                            {subTab === 'org-coursetype' ? 'Select Course Type' : 'Select Subject'}
                        </option>
                        {(subTab === 'org-coursetype' ? courseTypes.map(ct => ({ id: ct.id, name: ct.name })) :
                            subjects.map(s => ({ id: s.id, name: s.name }))).map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                    </select>
                    {subTab === 'board-subject' && (
                        <select className="input-field" value={form.class_level} onChange={e => setForm({ ...form, class_level: e.target.value })}>
                            <option value="Class 10">Class 10</option>
                            <option value="Class 12">Class 12</option>
                        </select>
                    )}
                    <button onClick={handleAdd} className="btn-secondary" style={{ height: 42 }}>+ Add Mapping</button>
                </div>
            </div>

            {/* Mapping List */}
            <div className="card overflow-hidden">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>
                        {SUB_TABS.find(s => s.key === subTab)?.label} Mappings
                    </h3>
                    <span className="badge badge-indigo">{mappings.length}</span>
                </div>
                <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {subTab === 'board-subject' && <><th>Board</th><th>Subject</th><th>Class Level</th><th></th></>}
                                {subTab === 'stream-subject' && <><th>Stream</th><th>Subject</th><th></th></>}
                                {subTab === 'org-coursetype' && <><th>Organization</th><th>Course Type</th><th></th></>}
                            </tr>
                        </thead>
                        <tbody>
                            {mappings.map((m, i) => (
                                <tr key={i}>
                                    {subTab === 'board-subject' && <>
                                        <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{m.board_name}</td>
                                        <td><span className="badge badge-indigo">{m.subject_name}</span></td>
                                        <td><span className="badge badge-cyan">{m.class_level}</span></td>
                                    </>}
                                    {subTab === 'stream-subject' && <>
                                        <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{m.stream_name}</td>
                                        <td><span className="badge badge-indigo">{m.subject_name}</span></td>
                                    </>}
                                    {subTab === 'org-coursetype' && <>
                                        <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{m.organization_name}</td>
                                        <td><span className="badge badge-cyan">{m.course_type_name}</span></td>
                                    </>}
                                    <td>
                                        <button onClick={() => handleRemove(m)}
                                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
