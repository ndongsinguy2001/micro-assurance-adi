// frontend/src/api/preuvePaiement.js
import api from './axios';

export const preuvePaiementAPI = {
  getAll: (params = {}) => api.get('/preuves-paiement', { params }),

  getById: (id) => api.get(`/preuves-paiement/${id}`),

  create: (data, file) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') formData.append(k, v);
    });
    if (file) formData.append('file', file);
    return api.post('/preuves-paiement', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  verifier: (id, data) => api.put(`/preuves-paiement/${id}/verifier`, data),

  delete: (id) => api.delete(`/preuves-paiement/${id}`),

  getFichierUrl: (id) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${base}/preuves-paiement/${id}/fichier`;
  },
};