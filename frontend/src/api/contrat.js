// frontend/src/api/contrat.js
import api from './axios';

export const contratAPI = {
  // Liste des contrats
  getAll: (params = {}) => 
    api.get('/contrats', { params }),

  // Détails d'un contrat
  getById: (id) => 
    api.get(`/contrats/${id}`),

  // Contrats par SFD
  getBySFD: (sfdId) => 
    api.get(`/contrats/sfd/${sfdId}`),

  // Créer un contrat
  create: (data) => 
    api.post('/contrats', data),

  // Modifier un contrat
  update: (id, data) => 
    api.put(`/contrats/${id}`, data),

  // Supprimer un contrat
  delete: (id) => 
    api.delete(`/contrats/${id}`),
};