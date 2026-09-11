// frontend/src/api/sfd.js
import api from './axios';

export const sfdAPI = {
  // Liste des SFD
  getAll: (params = {}) => 
    api.get('/sfd', { params }),

  // Détails d'un SFD
  getById: (id) => 
    api.get(`/sfd/${id}`),

  // Créer un SFD
  create: (data) => 
    api.post('/sfd', data),

  // Modifier un SFD
  update: (id, data) => 
    api.put(`/sfd/${id}`, data),

  // Supprimer un SFD
  delete: (id) => 
    api.delete(`/sfd/${id}`),
};