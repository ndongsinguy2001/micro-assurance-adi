// frontend/src/api/cr.js
import api from './axios';

export const crAPI = {
  // Générer un CR
  generer: (data) => 
    api.post('/cr/generer', data),

  // Liste des CR
  getAll: (params = {}) => 
    api.get('/cr', { params }),

  // Exporter CR
  exporter: (sfdId, annee, typeCloture) => 
    api.get(`/cr/export/${sfdId}/${annee}`, { 
      params: { typeCloture },
      responseType: 'blob',
    }),
};