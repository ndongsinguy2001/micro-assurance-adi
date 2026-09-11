// frontend/src/api/dashboard.js
import api from './axios';

export const dashboardAPI = {
  // Indicateurs globaux
  getIndicateurs: () => 
    api.get('/dashboard/indicateurs'),

  // Indicateurs par SFD
  getIndicateursSFD: (sfdId) => 
    api.get(`/dashboard/sfd/${sfdId}`),

  // Suivi intermédiation
  getSuivi: (params = {}) => 
    api.get('/dashboard/suivi', { params }),
};