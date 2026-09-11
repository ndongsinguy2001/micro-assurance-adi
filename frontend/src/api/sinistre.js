// frontend/src/api/sinistre.js
import api from './axios';

export const sinistreAPI = {
  getAll: (params = {}) => api.get('/sinistres', { params }),

  getById: (id) => api.get(`/sinistres/${id}`),

  create: (data) => api.post('/sinistres', data),

  /**
   * ✅ FIX : accepte désormais type + nom
   * @param {string} id
   * @param {File} file
   * @param {string} [type] - ACTE_DECES, CERTIFICAT_MEDICAL, etc.
   * @param {string} [nom]
   */
  addJustificatif: (id, file, type = 'AUTRE', nom = '') => {
    const formData = new FormData();
    formData.append('file', file);
    if (type) formData.append('type', type);
    if (nom) formData.append('nom', nom);
    return api.post(`/sinistres/${id}/justificatifs`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  valider: (id, data) => api.put(`/sinistres/${id}/valider`, data),

  refuser: (id, data) => api.put(`/sinistres/${id}/refuser`, data),

  payer: (id, data) => api.put(`/sinistres/${id}/payer`, data),

  getStatistiques: (params = {}) => api.get('/sinistres/statistiques', { params }),
};