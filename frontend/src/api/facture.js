// frontend/src/api/facture.js
import api from './axios';

export const factureAPI = {
  // Générer une facture
  generer: (data) => 
    api.post('/factures/generer', data),

  // Liste des factures
  getAll: (params = {}) => 
    api.get('/factures', { params }),

  // Détails d'une facture
  getByReference: (reference) => 
    api.get(`/factures/${reference}`),

  // Télécharger PDF
  getPDF: (reference) => 
    api.get(`/factures/${reference}/pdf`, {
      responseType: 'blob',
    }),

  // Marquer comme payée
  payer: (reference, data) => 
    api.put(`/factures/${reference}/payer`, data),

  // Annuler une facture
  annuler: (reference, data) => 
    api.put(`/factures/${reference}/annuler`, data),

  // Statistiques
  getStatistiques: (params = {}) => 
    api.get('/factures/statistiques', { params }),
};