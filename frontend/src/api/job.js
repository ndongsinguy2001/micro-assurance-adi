// frontend/src/api/job.js
import api from './axios';

export const jobAPI = {
  // Récupérer le statut d'un job
  getStatus: (queueName, jobId) => 
    api.get(`/jobs/status/${queueName}/${jobId}`),

  // Récupérer les jobs d'une queue
  getQueueJobs: (queueName, status = 'active') => 
    api.get(`/jobs/queue/${queueName}`, { params: { status } }),
};