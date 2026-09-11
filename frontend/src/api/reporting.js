// frontend/src/api/reporting.js
import api from './axios';

export const reportingAPI = {
  // Importer un fichier (synchrone)
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/reporting/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Importer en asynchrone (queue)
  importQueue: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/reporting/import-queue', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Liste des reportings
  getReportings: (params = {}) => 
    api.get('/reporting', { params }),

  // Détails d'un reporting
  getReportingById: (id) => 
    api.get(`/reporting/${id}`),

  // Adhésions d'un reporting
  getAdhesions: (id, params = {}) => 
    api.get(`/reporting/${id}/adhesions`, { params }),

  // Clôturer un reporting
  cloturer: (id) => 
    api.post(`/reporting/${id}/cloturer`),

  // Ré-importer corrigé
  reImporter: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/reporting/${id}/re-importer`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};