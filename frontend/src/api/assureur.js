// frontend/src/api/assureur.js
import api from './axios';

export const assureurAPI = {
  // Liste des assureurs
  getAll: (params = {}) => 
    api.get('/assureurs', { params }),

  // Détails d'un assureur
  getById: (id) => 
    api.get(`/assureurs/${id}`),

  // Créer un assureur
  create: (data) => 
    api.post('/assureurs', data),

  // Modifier un assureur
  update: (id, data) => 
    api.put(`/assureurs/${id}`, data),

  // Supprimer un assureur
  delete: (id) => 
    api.delete(`/assureurs/${id}`),
};