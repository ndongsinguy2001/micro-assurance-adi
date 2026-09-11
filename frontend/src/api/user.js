// frontend/src/api/user.js
import api from './axios';

export const userAPI = {
  getAll: (params = {}) => api.get('/users', { params }),

  getById: (id) => api.get(`/users/${id}`),

  create: (data) => api.post('/users', data),

  update: (id, data) => api.put(`/users/${id}`, data),

  changerMotDePasse: (id, nouveauMotDePasse) =>
    api.put(`/users/${id}/password`, { nouveauMotDePasse }),

  toggleActif: (id) => api.put(`/users/${id}/toggle`),

  delete: (id) => api.delete(`/users/${id}`),
};