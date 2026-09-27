import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

// Attach Authorization header if a token is saved in localStorage (dual-layer auth: works over HTTP, HTTPS, or when cookies are blocked)
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('pkg_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Capture token on successful login, signup, or profile load
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.token) {
      try {
        localStorage.setItem('pkg_token', response.data.token);
      } catch {}
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      if (error.config?.url?.includes('/auth/me')) {
        try {
          localStorage.removeItem('pkg_token');
        } catch {}
      }
    }
    return Promise.reject(error);
  }
);

// Auth & User Management
export const getMe = () => api.get('/auth/me');
export const login = (email, password) => api.post('/auth/login', { email, password });
export const signup = (name, email, password, confirmPassword) => api.post('/auth/signup', { name, email, password, confirmPassword });
export const logout = async () => {
  try {
    return await api.post('/auth/logout');
  } finally {
    try {
      localStorage.removeItem('pkg_token');
    } catch {}
  }
};
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const changePassword = (password, confirmPassword) => api.post('/auth/change-password', { password, confirmPassword });
export const updateMyProfile = (data) => api.put('/auth/profile', data);
export const getUsers = () => api.get('/auth/users');
export const createTeamMember = (data) => api.post('/auth/users', data);
export const updateTeamMember = (email, data) => api.put(`/auth/users/${encodeURIComponent(email)}`, data);
export const deleteTeamMember = (email) => api.delete(`/auth/users/${encodeURIComponent(email)}`);

// Projects
export const getProjects = () => api.get('/projects');
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const updateFGCode = (id, fgCode) => api.put(`/projects/${id}/fgcode`, { fgCode });
export const updateSupplier = (id, supplier) => api.put(`/projects/${id}/supplier`, { supplier });
export const updateFactory = (id, factory) => api.put(`/projects/${id}/factory`, { factory });
export const updateDescription = (id, description) => api.put(`/projects/${id}/description`, { description });
export const advanceProject = (id, data = {}) => api.post(`/projects/${id}/advance`, data);
export const revokeProject = (id) => api.post(`/projects/${id}/revoke`);
export const launchProject = (id, date) => api.post(`/projects/${id}/launch`, { date });
export const changeBriefDate = (id, briefDate) => api.post(`/projects/${id}/brief-date`, { briefDate });
export const advanceMaterial = (id, mIdx, data = {}) => api.post(`/projects/${id}/materials/${mIdx}/advance`, data);
export const revokeMaterial = (id, mIdx) => api.post(`/projects/${id}/materials/${mIdx}/revoke`);
export const saveSpecs = (id, mIdx, specs) => api.put(`/projects/${id}/materials/${mIdx}/specs`, { specs });
export const updateMaterialPMCode = (id, mIdx, pmCode) => api.put(`/projects/${id}/materials/${mIdx}/pmcode`, { pmCode });
export const updateMaterialSupplier = (id, mIdx, supplier) => api.put(`/projects/${id}/materials/${mIdx}/supplier`, { supplier });
export const updateMaterialPrintType = (id, mIdx, printType) => api.put(`/projects/${id}/materials/${mIdx}/printtype`, { printType });
export const updateMaterialBriefDate = (id, mIdx, briefDate) => api.put(`/projects/${id}/materials/${mIdx}/brief-date`, { briefDate });
export const updateMaterialPO = (id, mIdx, poStatus, poNumber, adminApproval = false) => api.put(`/projects/${id}/materials/${mIdx}/po`, { poStatus, poNumber, adminApproval });
export const updateSpecSignoff = (id, mIdx, signed, notes = '') => api.put(`/projects/${id}/materials/${mIdx}/specsignoff`, { signed, notes });
export const saveSpecSheet = (id, mIdx, specSheet, submitForCheck = false) => api.put(`/projects/${id}/materials/${mIdx}/specsheet`, { specSheet, submitForCheck });
export const updateMaterialArtwork = (id, mIdx, artworkFiles) => api.put(`/projects/${id}/materials/${mIdx}/artwork`, { artworkFiles });
export const checkSpecSheet = (id, mIdx, comments = '') => api.post(`/projects/${id}/materials/${mIdx}/specsheet/check`, { comments });
export const approveSpecSheet = (id, mIdx, comments = '') => api.post(`/projects/${id}/materials/${mIdx}/specsheet/approve`, { comments });
export const rejectSpecSheet = (id, mIdx, reason = '') => api.post(`/projects/${id}/materials/${mIdx}/specsheet/reject`, { reason });
export const getProjectAuditTrail = (id) => api.get(`/projects/${id}/audit-trail`);

// Crunched Timeline & 2-Stage Approvals
export const proposeCrunchTimeline = (id, targetLaunchDate) => api.post(`/projects/${id}/crunch/propose`, { targetLaunchDate });
export const approveCrunchStage1 = (id, comments) => api.post(`/projects/${id}/crunch/approve-stage1`, { comments });
export const approveCrunchStage2 = (id, comments) => api.post(`/projects/${id}/crunch/approve-stage2`, { comments });
export const rejectCrunch = (id, reason) => api.post(`/projects/${id}/crunch/reject`, { reason });

// Logs
export const getLogs = () => api.get('/logs');
export const getSeenAt = () => api.get('/logs/seen-at');
export const markSeen = () => api.post('/logs/mark-seen');

// Spec Converter & Spec Library
export const convertSpecPdf = (payload) => api.post('/specs/convert-pdf', payload);
export const getSpecLibrary = () => api.get('/specs/library');
export const saveSpecToLibrary = (payload) => api.post('/specs/library', payload);
export const updateSpecInLibrary = (id, payload) => api.put(`/specs/library/${id}`, payload);
export const deleteSpecFromLibrary = (id) => api.delete(`/specs/library/${id}`);
export const applySpecToProject = (id, payload) => api.post(`/specs/library/${id}/apply`, payload);

// ── Pass 7: Approvals, Tasks, Comments, Notifications, Risks & Search ──
// Approvals
export const getApprovals = (params) => api.get('/approvals', { params });
export const getApprovalById = (id) => api.get(`/approvals/${id}`);
export const requestApproval = (data) => api.post('/approvals', data);
export const decideApproval = (id, data) => api.post(`/approvals/${id}/decide`, data);
export const cancelApproval = (id) => api.post(`/approvals/${id}/cancel`);

// Tasks
export const getTasks = (params) => api.get('/tasks', { params });
export const getTaskById = (id) => api.get(`/tasks/${id}`);
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);
export const completeTask = (id) => api.post(`/tasks/${id}/complete`);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

// Comments & Mentions
export const getComments = (params) => api.get('/comments', { params });
export const addComment = (data) => api.post('/comments', data);
export const deleteComment = (id) => api.delete(`/comments/${id}`);

// Notifications & Preferences
export const getNotifications = (params) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/read-all');
export const getNotificationPreferences = () => api.get('/notifications/preferences');
export const updateNotificationPreferences = (data) => api.put('/notifications/preferences', data);

// Project Risks & Functional Ownership
export const getProjectRisks = (projectId) => api.get(`/projects/${projectId}/risks`);
export const addProjectRisk = (projectId, data) => api.post(`/projects/${projectId}/risks`, data);
export const updateProjectRisk = (projectId, riskId, data) => api.put(`/projects/${projectId}/risks/${riskId}`, data);
export const deleteProjectRisk = (projectId, riskId) => api.delete(`/projects/${projectId}/risks/${riskId}`);
export const updateProjectOwnership = (projectId, data) => api.put(`/projects/${projectId}/ownership`, data);

// Global Universal Search
export const globalSearch = (q) => api.get('/search', { params: { q } });

// ── Pass 8: Enterprise Reporting, Data Quality, Import & Webhooks ──
// Reporting Engine
export const getProjectReviewReport = (projectId) => api.get(`/reports/project-review/${projectId}`);
export const getManagementReport = () => api.get('/reports/management');
export const getSupplierPerformanceReport = () => api.get('/reports/suppliers');
export const getStageAnalyticsReport = () => api.get('/reports/stages');

// Data Quality & Anomaly Detection
export const getDataQualityAudit = () => api.get('/data-quality/audit');

// Controlled Import
export const validateImport = (records) => api.post('/import/validate', { records });
export const commitImport = (records) => api.post('/import/commit', { records });
export const downloadImportTemplate = () => api.get('/import/template', { responseType: 'blob' });
export const uploadImportExcel = (file, dryRun = false) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/import/upload?dryRun=${dryRun}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const uploadImportExcelCommit = (file) => uploadImportExcel(file, false);

// Webhook & Integration Platform
export const getWebhooks = () => api.get('/webhooks');
export const createWebhook = (data) => api.post('/webhooks', data);
export const getWebhookById = (id) => api.get(`/webhooks/${id}`);
export const updateWebhook = (id, data) => api.put(`/webhooks/${id}`, data);
export const deleteWebhook = (id) => api.delete(`/webhooks/${id}`);
export const getWebhookDeliveries = (id, params) => api.get(`/webhooks/${id}/deliveries`, { params });
export const testWebhook = (id) => api.post(`/webhooks/${id}/test`);
export const retryWebhookDelivery = (deliveryId) => api.post(`/webhooks/deliveries/${deliveryId}/retry`);

// Packaging Formats (Master Data)
export const getPackagingFormats = (params) => api.get('/packaging-formats', { params });
export const getPackagingFormatById = (id) => api.get(`/packaging-formats/${id}`);
export const createPackagingFormat = (data) => api.post('/packaging-formats', data);
export const updatePackagingFormat = (id, data) => api.put(`/packaging-formats/${id}`, data);
export const deletePackagingFormat = (id) => api.delete(`/packaging-formats/${id}`);

// ── Comprehensive Excel Export ─────────────────────────────────────────────
/**
 * Trigger a comprehensive multi-sheet Excel export.
 * Returns a Blob; the caller is responsible for triggering the browser download.
 *
 * @param {object} filters - { stage?, status?, search? }
 */
export const exportProjectsExcel = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.stage)  params.set('stage',  filters.stage);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return api.get(`/export/projects${qs ? '?' + qs : ''}`, { responseType: 'blob' });
};

export default api;

