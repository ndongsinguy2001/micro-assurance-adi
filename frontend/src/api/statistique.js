// frontend/src/api/statistique.js
import api from './axios';

export const statistiqueAPI = {
  getAll: (params = {}) => api.get('/statistiques', { params }),
  getAgregat: (params = {}) => api.get('/statistiques/agregat', { params }),
  upsert: (data) => api.post('/statistiques', data),
  delete: (id) => api.delete(`/statistiques/${id}`),
};