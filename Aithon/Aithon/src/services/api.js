/**
 * Unified API service layer.
 *
 * Three API surfaces:
 *  1. gatewayApi  — Node.js gateway (port 4000), cookie+token auth
 *                   Handles: auth, task-planner, aithon-module proxying
 *  2. aithonApi   — Shorthand for gateway /api/aithon/* calls
 *  3. taskPlannerApi — Shorthand for gateway task-planner endpoints
 *
 * The X-Aithon-Token header is injected by the interceptor in AuthContext
 * via the shared gatewayApi instance. Re-exported here for convenience.
 */
import axios from 'axios';

const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_API || 'http://localhost:4000/api';

// ─── Shared Axios instance (same one as AuthContext) ─────────────────────────
const api = axios.create({
  baseURL: GATEWAY_BASE,
  withCredentials: true,
});

// Inject aithon token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aithon_token');
  if (token) {
    config.headers['X-Aithon-Token'] = token;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('aithon_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth API (Node.js gateway) ──────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ─── Task Planner API (Node.js gateway — real-time subtasks) ─────────────────
export const taskPlannerAPI = {
  // Manager
  createTask: (data) => api.post('/tasks', data),
  getManagerSubtasks: () => api.get('/tasks/manager'),
  // Employee
  getMySubtasks: () => api.get('/subtasks/mine'),
  updateSubtask: (id, data) => api.patch(`/subtasks/${id}`, data),
};

// ─── Aithon Data Module API (proxied → FastAPI port 8000) ────────────────────
// All paths below are prefixed with /api/aithon in the gateway proxy.
const aithon = axios.create({
  baseURL: `${GATEWAY_BASE}/aithon`,
  withCredentials: true,
});
aithon.interceptors.request.use((config) => {
  const token = localStorage.getItem('aithon_token');
  if (token) config.headers['X-Aithon-Token'] = token;
  return config;
});

// Auto-logout on 401 from Aithon/FastAPI module — mirrors main api interceptor
aithon.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aithon_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const taskAPI = {
  create: (data) => aithon.post('/task/create', data),
  getStatus: (taskId) => aithon.get(`/task/${taskId}/status`),
  getLineage: (taskId) => aithon.get(`/task/${taskId}/lineage`),
  getReport: (taskId) => aithon.get(`/task/${taskId}/report`),
};

export const datasetAPI = {
  upload: (file, name) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    return aithon.post('/dataset/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => aithon.get('/datasets'),
};

export const dashboardAPI = {
  getMetrics: () => aithon.get('/dashboard/metrics'),
};

export const reportAPI = {
  download: (reportId) => aithon.get(`/reports/${reportId}/download`, { responseType: 'blob' }),
};

// ─── Project Management API (FastAPI PM module) ──────────────────────────────
export const pmAPI = {
  // Manager
  createProject: (data) => aithon.post('/pm/projects', data),
  listProjects: () => aithon.get('/pm/projects'),
  getProject: (id) => aithon.get(`/pm/projects/${id}`),
  getPipelineStatus: (id) => aithon.get(`/pm/projects/${id}/pipeline-status`),
  getActivityFeed: (limit = 30) => aithon.get(`/pm/activity-feed?limit=${limit}`),
  getRiskAlerts: () => aithon.get('/pm/risk-alerts'),
  getDevelopers: () => aithon.get('/pm/developers'),
  // Employee
  getMyTasks: () => aithon.get('/pm/my-tasks'),
  getTaskDetail: (taskId) => aithon.get(`/pm/my-tasks/${taskId}`),
  updateTaskStatus: (taskId, status) => aithon.patch(`/pm/tasks/${taskId}/status`, { status }),
  completeSubtask: (taskId, subtaskId) => aithon.post(`/pm/tasks/${taskId}/subtasks/${subtaskId}/complete`),
  addCommit: (taskId, data) => aithon.post(`/pm/tasks/${taskId}/commits`, data),
  // Shared
  getProjectTasks: (projectId) => aithon.get(`/pm/projects/${projectId}/tasks`),
};

// ─── WebSocket helpers (FastAPI PM WebSocket — unchanged) ─────────────────────
export const createProjectWS = (projectId, onMessage) => {
  const ws = new WebSocket(`ws://localhost:8000/ws/${projectId}`);
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (_) {} };
  const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping'); }, 25000);
  ws.onclose = () => clearInterval(ping);
  return ws;
};

export const createGlobalWS = (onMessage) => {
  const ws = new WebSocket('ws://localhost:8000/ws/global/activity');
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (_) {} };
  const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping'); }, 25000);
  ws.onclose = () => clearInterval(ping);
  return ws;
};

export default api;
