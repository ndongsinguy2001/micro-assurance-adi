// frontend/src/api/reporting.js
import api from './axios';

export const reportingAPI = {
  // ============================================================
  // IMPORT
  // ============================================================

  import: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    if (options.forceReplace) {
      formData.append('forceReplace', 'true');
    }
    if (options.replacementReason) {
      formData.append('replacementReason', options.replacementReason);
    }

    return api.post('/reporting/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  importQueue: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    if (options.forceReplace) {
      formData.append('forceReplace', 'true');
    }
    if (options.replacementReason) {
      formData.append('replacementReason', options.replacementReason);
    }

    return api.post('/reporting/import-queue', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // ============================================================
  // CONSULTATION REPORTINGS
  // ============================================================

  getReportings: (params = {}) => {
    const query = { ...params };
    if (params.includeSuperseded) query.includeSuperseded = 'true';
    if (params.includeDetails) query.includeDetails = 'true';
    return api.get('/reporting', { params: query });
  },

  getReportingById: (id) => api.get(`/reporting/${id}`),

  getAdhesions: (id, params = {}) => {
    const query = { ...params };
    if (params.includeDetails) query.includeDetails = 'true';
    return api.get(`/reporting/${id}/adhesions`, { params: query });
  },

  cloturer: (id) => api.post(`/reporting/${id}/cloturer`),

  reImporter: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/reporting/${id}/re-importer`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // ============================================================
  // IMPORTJOBS
  // ============================================================

  /**
   * Récupérer un ImportJob
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.includeIgnored] - Inclure les ignoredLines (lourd)
   *
   * ⚠️ Phase 5.7 : ignoredLines exclus par défaut.
   *    Utiliser getIgnoredLines() pour les charger paginés.
   */
  getImportJobById: (id, options = {}) => {
    const params = {};
    if (options.includeIgnored) params.includeIgnored = 'true';
    return api.get(`/reporting/jobs/${id}`, { params });
  },

  /**
   * 🔹 Phase 5.7 — Récupérer les lignes ignorées (paginé)
   * @param {string} id
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @param {string} [params.reason] - NO_VALUES, EMPTY_ROW, MISSING_NAME
   */
  getIgnoredLines: (id, params = {}) =>
    api.get(`/reporting/jobs/${id}/ignored-lines`, { params }),

  getImportHistory: (params) =>
    api.get('/reporting/jobs/history', { params }),

  getImportJobs: (params = {}) => {
    const query = { ...params };
    if (params.includeDetails) query.includeDetails = 'true';
    return api.get('/reporting/jobs', { params: query });
  },
};