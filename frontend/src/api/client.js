import axios from 'axios';

const API = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

export const getBoards = () => API.get('/boards');
export const getYearBuckets = () => API.get('/year-buckets');
export const getBoardStats = (params) => API.get('/board-statistics', { params });
export const getStatsOverview = () => API.get('/stats-overview');
export const normalizeScore = (data) => API.post('/normalize-score', data);
export const ingestScore = (data) => API.post('/ingest-score', data);
export const searchStudents = (params) => API.get('/students/search', { params });
export const getStudentNormalizedScores = (params) => API.get('/student-normalized-scores', { params });
export const getStudentFilters = () => API.get('/students/filters');

export default API;
