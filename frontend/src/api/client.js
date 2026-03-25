import axios from 'axios';

const API = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

// ── Existing endpoints (backward compat) ────────────────────────
export const getBoards = () => API.get('/boards');
export const getYearBuckets = () => API.get('/year-buckets');
export const getBoardStats = (params) => API.get('/board-statistics', { params });
export const getStatsOverview = () => API.get('/stats-overview');
export const normalizeScore = (data) => API.post('/normalize-score', data);
export const ingestScore = (data) => API.post('/ingest-score', data);
export const searchStudents = (params) => API.get('/students/search', { params });
export const getStudentNormalizedScores = (params) => API.get('/student-normalized-scores', { params });
export const getStudentFilters = () => API.get('/students/filters');

// ── Academic entities ───────────────────────────────────────────
export const getAcademicMeta = (params) => API.get('/academic/meta', { params });
export const getAcademicOrganizations = () => API.get('/academic/organizations');
export const getAcademicCourseTypes = (params) => API.get('/academic/course-types', { params });
export const getAcademicCourses = (params) => API.get('/academic/courses', { params });
export const getAcademicStreams = (params) => API.get('/academic/streams', { params });
export const getAcademicSubjects = (params) => API.get('/academic/subjects', { params });

// ── Academic record ─────────────────────────────────────────────
export const createAcademicRecord = (data) => API.post('/academic/academic-record', data);
export const validateSubjectCombination = (data) => API.post('/academic/validate-subject-combination', data);

// ── Student directory / analytics ───────────────────────────────
export const getStudentDirectory = (params) => API.get('/students/directory', { params });
export const getStudentAnalytics = (params) => API.get('/students/analytics', { params });
export const getStudentsList = (params) => API.get('/students', { params });

// ── Admin CRUD ──────────────────────────────────────────────────
export const adminGetBoards = () => API.get('/admin/boards');
export const adminCreateBoard = (data) => API.post('/admin/boards', data);
export const adminUpdateBoard = (id, data) => API.put(`/admin/boards/${id}`, data);
export const adminDeleteBoard = (id) => API.delete(`/admin/boards/${id}`);

export const adminGetOrgs = () => API.get('/admin/organizations');
export const adminCreateOrg = (data) => API.post('/admin/organizations', data);
export const adminUpdateOrg = (id, data) => API.put(`/admin/organizations/${id}`, data);
export const adminDeleteOrg = (id) => API.delete(`/admin/organizations/${id}`);
export const adminGetOrgDetail = (orgId) => API.get('/admin/org-detail', { params: { organization_id: orgId } });

export const adminGetStreams = () => API.get('/admin/streams');
export const adminCreateStream = (data) => API.post('/admin/streams', data);
export const adminDeleteStream = (id) => API.delete(`/admin/streams/${id}`);

export const adminGetSubjects = () => API.get('/admin/subjects');
export const adminCreateSubject = (data) => API.post('/admin/subjects', data);
export const adminDeleteSubject = (id) => API.delete(`/admin/subjects/${id}`);

export const adminGetBoardSubjectMapping = (params) => API.get('/admin/board-subject-mapping', { params });
export const adminAddBoardSubjectMapping = (data) => API.post('/admin/board-subject-mapping', data);
export const adminRemoveBoardSubjectMapping = (id) => API.delete(`/admin/board-subject-mapping/${id}`);

export const adminGetStreamSubjectMapping = (params) => API.get('/admin/stream-subject-mapping', { params });
export const adminAddStreamSubjectMapping = (data) => API.post('/admin/stream-subject-mapping', data);
export const adminRemoveStreamSubjectMapping = (id) => API.delete(`/admin/stream-subject-mapping/${id}`);

export const adminGetOrgCourseTypeMapping = (params) => API.get('/admin/org-course-type-mapping', { params });
export const adminAddOrgCourseTypeMapping = (data) => API.post('/admin/org-course-type-mapping', data);
export const adminRemoveOrgCourseTypeMapping = (orgId, ctId) => API.delete('/admin/org-course-type-mapping', { params: { organization_id: orgId, course_type_id: ctId } });

export const adminAddOrgProgramMapping = (data) => API.post('/admin/org-program-mapping', data);
export const adminRemoveOrgProgramMapping = (orgId, courseId) => API.delete('/admin/org-program-mapping', { params: { organization_id: orgId, course_id: courseId } });

// ── Student Extension APIs (NEW) ────────────────────────────────
export const getStudentsExtended = (params) => API.get('/students-ext', { params });
export const getStudentDetails = (studentId) => API.get(`/students/${studentId}/details`);
export const exportStudentsCSV = (params) =>
    API.get('/students/export', { params, responseType: 'blob' });
export const uploadMarksheetOCR = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return API.post('/academic/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// ── Analytics endpoints (NEW) ───────────────────────────────────
export const getAnalyticsBoardStats = () => API.get('/analytics/board-stats');
export const getAnalyticsDashboardDistribution = () => API.get('/analytics/dashboard-distribution');
export const getAnalyticsNormalizationMetrics = (params) => API.get('/analytics/normalization-metrics', { params });
export const getAnalyticsDynamicStats = (params) => API.get('/analytics/dynamic-stats', { params });
export const getAdvancedNormalization = (params) => API.get('/normalization/v2/', { params });

export default API;
