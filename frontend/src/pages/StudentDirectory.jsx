import { useEffect, useState, useCallback, useRef } from 'react';
import { getStudentsExtended, getStudentFilters, exportStudentsCSV, getStudentDetails } from '../api/client';

/* ── Performance label styling ──────────────────────────────────── */
const PERF_STYLES = {
  Excellent: { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.25)' },
  Good:      { bg: 'rgba(6,182,212,0.15)',  color: '#22d3ee', border: 'rgba(6,182,212,0.25)' },
  Average:   { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  Poor:      { bg: 'rgba(244,63,94,0.15)',  color: '#fb7185', border: 'rgba(244,63,94,0.25)' },
};

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function StudentDirectory() {
  const [students, setStudents]       = useState([]);
  const [filters, setFilters]         = useState({ boards: [], class_levels: [] });
  const [searchName, setSearchName]   = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [boardFilter, setBoardFilter] = useState('');
  const [perfFilter, setPerfFilter]   = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);
  const [loading, setLoading]         = useState(false);
  const debounceRef = useRef(null);

  // ── NEW: sorting state ────────────────────────────────────────
  const [sortBy, setSortBy]           = useState('');
  const [sortOrder, setSortOrder]     = useState('asc');

  // ── NEW: student detail modal state ───────────────────────────
  const [detailOpen, setDetailOpen]     = useState(false);
  const [detailData, setDetailData]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── NEW: CSV export state ─────────────────────────────────────
  const [exporting, setExporting]     = useState(false);

  /* Load filter options on mount */
  useEffect(() => {
    getStudentFilters().then(r => setFilters(r.data)).catch(() => {});
  }, []);

  /* Fetch student data — now uses extended endpoint with sorting */
  const fetchStudents = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const params = { page: currentPage, page_size: 20 };
      if (searchName.trim()) params.q = searchName.trim();
      if (classFilter) params.class_level = classFilter;
      if (boardFilter) params.board = boardFilter;
      if (perfFilter) params.performance_label = perfFilter;
      if (sortBy) params.sort_by = sortBy;
      if (sortBy) params.order = sortOrder;

      const res = await getStudentsExtended(params);
      setStudents(res.data.students || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalCount(res.data.total_count || 0);
      setPage(res.data.page || 1);
    } catch (e) {
      console.error('Failed to fetch students:', e);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [searchName, classFilter, boardFilter, perfFilter, sortBy, sortOrder]);

  /* Initial load + refetch on filter/sort changes (debounced for search) */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchStudents(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchName, classFilter, boardFilter, perfFilter, sortBy, sortOrder]);

  /* Page change */
  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    fetchStudents(p);
  };

  /* Reset all filters */
  const handleReset = () => {
    setSearchName('');
    setClassFilter('');
    setBoardFilter('');
    setPerfFilter('');
    setSortBy('');
    setSortOrder('asc');
  };

  /* ── NEW: CSV Download handler ─────────────────────────────────── */
  const handleCSVDownload = async () => {
    setExporting(true);
    try {
      const params = {};
      if (searchName.trim()) params.q = searchName.trim();
      if (classFilter) params.class_level = classFilter;
      if (boardFilter) params.board = boardFilter;
      if (perfFilter) params.performance_label = perfFilter;
      if (sortBy) params.sort_by = sortBy;
      if (sortBy) params.order = sortOrder;

      const res = await exportStudentsCSV(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'students_export.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  /* ── NEW: Student detail handler ───────────────────────────────── */
  const handleStudentClick = async (student) => {
    if (!student.student_id) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await getStudentDetails(student.student_id);
      setDetailData(res.data);
    } catch (e) {
      console.error('Failed to load student details:', e);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /* Performance distribution counts */
  const perfCounts = students.reduce((acc, s) => {
    const lbl = s.performance_label || 'Unknown';
    acc[lbl] = (acc[lbl] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="animate-fade-in">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            📚 Student Directory
          </span>
        </h1>
        <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
          Search · Filter by class & board · Sort by program/org · Performance classification · {totalCount > 0 ? `${totalCount} total students` : 'Loading...'}
        </p>
      </div>

      {/* ─── Search & Filter Bar ─────────────────────────────── */}
      <div className="card animate-fade-in" style={{ padding: '20px' }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3" style={{ alignItems: 'flex-end' }}>
          {/* Name Search */}
          <div className="md:col-span-2">
            <label className="label">Search by Name</label>
            <div style={{ position: 'relative' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a6a96" strokeWidth="2" strokeLinecap="round"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="student-name-search"
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Type a student name..."
                className="input-field"
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>

          {/* Class Filter */}
          <div>
            <label className="label">Class</label>
            <select id="student-class-filter" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input-field">
              <option value="">All Classes</option>
              {(filters.class_levels || []).map(cl => <option key={cl} value={cl}>{cl}</option>)}
            </select>
          </div>

          {/* Board Filter */}
          <div>
            <label className="label">Board</label>
            <select id="student-board-filter" value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} className="input-field">
              <option value="">All Boards</option>
              {(filters.boards || []).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Performance Filter */}
          <div>
            <label className="label">Performance</label>
            <select id="student-perf-filter" value={perfFilter} onChange={(e) => setPerfFilter(e.target.value)} className="input-field">
              <option value="">All</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Average">Average</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
        </div>

        {/* ── NEW: Sorting Controls ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="label">Sort By</label>
            <select id="student-sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field">
              <option value="">Default (Name)</option>
              <option value="program">Program</option>
              <option value="organisation">Organisation</option>
            </select>
          </div>
          <div>
            <label className="label">Order</label>
            <select id="student-sort-order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="input-field">
              <option value="asc">Ascending ↑</option>
              <option value="desc">Descending ↓</option>
            </select>
          </div>
          <div className="md:col-span-3" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {/* ── NEW: CSV Download Button ─────────────────────────── */}
            <button
              id="csv-download-btn"
              onClick={handleCSVDownload}
              disabled={exporting || totalCount === 0}
              style={{
                padding: '9px 18px', borderRadius: 10,
                border: '1px solid rgba(16,185,129,0.3)',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))',
                color: '#34d399', fontSize: '0.8125rem', fontWeight: 700,
                cursor: (exporting || totalCount === 0) ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: (exporting || totalCount === 0) ? 0.5 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Exporting…' : 'Download CSV'}
            </button>
          </div>
        </div>

        {/* Active filters + reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {(searchName || classFilter || boardFilter || perfFilter || sortBy) && (
            <button onClick={handleReset}
              style={{
                padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(244,63,94,0.3)',
                background: 'rgba(244,63,94,0.08)', color: '#fb7185', fontSize: '0.75rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
              ✕ Reset Filters
            </button>
          )}
          {searchName && <span className="badge badge-indigo">Name: "{searchName}"</span>}
          {classFilter && <span className="badge badge-cyan">{classFilter}</span>}
          {boardFilter && <span className="badge badge-amber">{boardFilter}</span>}
          {perfFilter && <span className="badge" style={{ background: PERF_STYLES[perfFilter]?.bg, color: PERF_STYLES[perfFilter]?.color }}>{perfFilter}</span>}
          {sortBy && <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>Sort: {sortBy} ({sortOrder})</span>}
        </div>
      </div>

      {/* ─── Summary Stats ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card animate-fade-in" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>👥</div>
          <div>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f0f4ff', lineHeight: 1.2 }}>{totalCount}</p>
            <p style={{ fontSize: '0.6875rem', color: '#5a6a96', fontWeight: 500 }}>Total Students</p>
          </div>
        </div>
        {['Excellent', 'Good', 'Average', 'Poor'].map((label) => {
          const st = PERF_STYLES[label];
          return (
            <div key={label} className="card animate-fade-in" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => setPerfFilter(perfFilter === label ? '' : label)}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.color, flexShrink: 0, boxShadow: `0 0 8px ${st.color}40` }} />
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: st.color, lineHeight: 1.2 }}>{perfCounts[label] || 0}</p>
                <p style={{ fontSize: '0.6875rem', color: '#5a6a96', fontWeight: 500 }}>{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Student Table ───────────────────────────────────── */}
      <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '60ms' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f0f4ff' }}>Student Records</h3>
            <p style={{ fontSize: '0.6875rem', color: '#5a6a96', marginTop: 2 }}>
              Page {page} of {totalPages} · Showing {students.length} of {totalCount} students · Click row for details
            </p>
          </div>
          <span className="badge badge-indigo">{totalCount} total</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 skeleton" />)}
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</p>
            <p style={{ color: '#8b9cc7', fontWeight: 600, fontSize: '0.9375rem' }}>No students found</p>
            <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 4 }}>
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Student Name</th>
                  <th>Board</th>
                  <th>Class</th>
                  <th>Stream</th>
                  <th>Program</th>
                  <th>Organisation</th>
                  <th style={{ textAlign: 'right' }}>Avg %</th>
                  <th style={{ textAlign: 'center' }}>Subjects</th>
                  <th>Performance</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const idx = (page - 1) * 20 + i + 1;
                  const perf = PERF_STYLES[s.performance_label] || { bg: 'rgba(255,255,255,0.06)', color: '#8b9cc7', border: 'rgba(255,255,255,0.1)' };
                  const initials = s.student_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
                  return (
                    <tr key={`${s.student_name}-${s.exam_year}-${i}`}
                      className="animate-fade-in"
                      style={{ animationDelay: `${i * 25}ms`, cursor: 'pointer' }}
                      onClick={() => handleStudentClick(s)}
                    >
                      <td style={{ color: '#5a6a96', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{idx}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}40, ${COLORS[(i + 1) % COLORS.length]}20)`,
                            border: `1px solid ${COLORS[i % COLORS.length]}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700, color: COLORS[i % COLORS.length],
                            flexShrink: 0,
                          }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 600, color: '#f0f4ff' }}>{s.student_name}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-indigo">{s.board_name}</span></td>
                      <td><span className="badge" style={{ background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>{s.class_level}</span></td>
                      <td style={{ color: '#8b9cc7' }}>{s.stream || '—'}</td>
                      <td style={{ color: '#a78bfa', fontSize: '0.75rem' }}>{s.program_name || '—'}</td>
                      <td style={{ color: '#8b9cc7', fontSize: '0.75rem' }}>{s.organization_name || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#22d3ee', fontVariantNumeric: 'tabular-nums' }}>
                        {s.avg_percentage != null ? `${s.avg_percentage}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-cyan">{s.subject_count}</span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 600,
                          background: perf.bg, color: perf.color, border: `1px solid ${perf.border}`,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: perf.color, display: 'inline-block' }} />
                          {s.performance_label || '—'}
                        </span>
                      </td>
                      <td style={{ color: '#8b9cc7' }}>{s.exam_year}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Pagination ─────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            <button onClick={() => goToPage(1)} disabled={page <= 1}
              style={paginationBtnStyle(page <= 1)}>⟨⟨</button>
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
              style={paginationBtnStyle(page <= 1)}>← Prev</button>

            {/* Page number buttons */}
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} style={{ color: '#5a6a96', fontSize: '0.75rem', padding: '0 4px' }}>…</span>
              ) : (
                <button key={p} onClick={() => goToPage(p)}
                  style={{
                    ...paginationBtnStyle(false),
                    background: p === page ? 'rgba(99,102,241,0.2)' : 'transparent',
                    color: p === page ? '#818cf8' : '#5a6a96',
                    fontWeight: p === page ? 700 : 500,
                    minWidth: 32,
                  }}>
                  {p}
                </button>
              )
            )}

            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
              style={paginationBtnStyle(page >= totalPages)}>Next →</button>
            <button onClick={() => goToPage(totalPages)} disabled={page >= totalPages}
              style={paginationBtnStyle(page >= totalPages)}>⟩⟩</button>
          </div>
        )}
      </div>

      {/* ─── NEW: Student Detail Modal ──────────────────────────── */}
      {detailOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setDetailOpen(false)}>
          <div style={{
            background: '#0f1729', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, width: '100%', maxWidth: 700,
            maxHeight: '85vh', overflow: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.125rem', color: '#f0f4ff' }}>
                📋 Student Details
              </h2>
              <button onClick={() => setDetailOpen(false)} style={{
                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 8, padding: '6px 12px', color: '#fb7185',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
              }}>✕ Close</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              {detailLoading ? (
                <div className="space-y-3">
                  <div className="h-20 skeleton" />
                  <div className="h-40 skeleton" />
                </div>
              ) : !detailData ? (
                <p style={{ color: '#5a6a96', textAlign: 'center', padding: 40 }}>
                  Failed to load student details.
                </p>
              ) : (
                <div className="space-y-5">
                  {/* Student Profile */}
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 12,
                    padding: 16, borderRadius: 12,
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.12)',
                  }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#f0f4ff', marginBottom: 8 }}>
                        {detailData.student_name}
                      </h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span className="badge badge-indigo">{detailData.board_name}</span>
                        <span className="badge" style={{ background: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>
                          {detailData.class_level}
                        </span>
                        {detailData.stream && (
                          <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                            {detailData.stream}
                          </span>
                        )}
                        <span className="badge badge-cyan">{detailData.exam_year}</span>
                      </div>
                      {detailData.organization_name && (
                        <p style={{ color: '#5a6a96', fontSize: '0.75rem', marginTop: 8 }}>
                          Org: <span style={{ color: '#8b9cc7' }}>{detailData.organization_name}</span>
                        </p>
                      )}
                      {detailData.program_name && (
                        <p style={{ color: '#5a6a96', fontSize: '0.75rem', marginTop: 2 }}>
                          Program: <span style={{ color: '#a78bfa' }}>{detailData.program_name}</span>
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96' }}>Avg %</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#22d3ee' }}>
                          {detailData.avg_percentage ?? '—'}%
                        </p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96' }}>Avg Norm</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                          {detailData.avg_normalized_score ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Normalization Info */}
                  <div style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.12)',
                    fontSize: '0.6875rem', color: '#5a6a96',
                  }}>
                    <strong style={{ color: '#34d399' }}>Normalization:</strong> {detailData.normalization_method}
                  </div>

                  {/* Subject-wise Score Table */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#f0f4ff' }}>Subject-wise Marks & Normalized Scores</h4>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th style={{ textAlign: 'right' }}>Marks</th>
                          <th style={{ textAlign: 'right' }}>Max</th>
                          <th style={{ textAlign: 'right' }}>Percentage</th>
                          <th style={{ textAlign: 'right' }}>Normalized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.subjects?.map((sub, idx) => (
                          <tr key={sub.subject} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                            <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{sub.subject}</td>
                            <td style={{ textAlign: 'right', color: '#8b9cc7' }}>{sub.marks}</td>
                            <td style={{ textAlign: 'right', color: '#5a6a96' }}>{sub.max_marks}</td>
                            <td style={{ textAlign: 'right', color: '#22d3ee', fontWeight: 600 }}>
                              {sub.percentage != null ? `${sub.percentage.toFixed(1)}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700, fontSize: '0.875rem' }}>
                              {sub.normalized_score != null ? sub.normalized_score.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pagination helpers ─────────────────────────────────────────── */
function paginationBtnStyle(disabled) {
  return {
    padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)', color: disabled ? '#3a4a6c' : '#8b9cc7',
    fontSize: '0.75rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif', transition: 'all 0.15s ease', opacity: disabled ? 0.5 : 1,
  };
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
