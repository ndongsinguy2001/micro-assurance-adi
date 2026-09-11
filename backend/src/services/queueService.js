// backend/src/services/queueService.js
const { Queue } = require('bullmq');
const { getRedisClient, isRedisAvailable } = require('../config/redis');

// ============================================================
// 1. DÉFINITION DES QUEUES
// ============================================================

const QUEUE_NAMES = {
  IMPORT_REPORTING: 'import-reporting',
  GENERATION_CLOTURE: 'generation-cloture',
  GENERATION_CR: 'generation-cr',
  GENERATION_FACTURE: 'generation-facture',
  EXPORT_DONNEES: 'export-donnees',
};

// Cache des queues
const queues = {};

// ✅ Vérifier Redis une seule fois
const REDIS_AVAILABLE = isRedisAvailable();

if (!REDIS_AVAILABLE) {
  console.log('ℹ️ Redis désactivé - Les workers asynchrones sont désactivés');
}

/**
 * Récupère ou crée une queue
 */
const getQueue = (name) => {
  // ✅ Si Redis n'est pas disponible, ne pas créer de queue
  if (!REDIS_AVAILABLE) {
    return null;
  }

  if (!queues[name]) {
    const connection = getRedisClient();
    if (!connection) {
      return null;
    }
    
    try {
      queues[name] = new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 86400,
            count: 1000,
          },
          removeOnFail: {
            age: 604800,
          },
        },
      });
      console.log(`📦 Queue "${name}" initialisée`);
    } catch (error) {
      console.log(`⚠️ Queue "${name}" non disponible`);
      return null;
    }
  }
  return queues[name];
};

// ============================================================
// 2. AJOUTER UN JOB À LA QUEUE
// ============================================================

/**
 * Ajoute un job à la queue d'import
 */
const addImportJob = async (data) => {
  if (!REDIS_AVAILABLE) {
    throw new Error('Redis non disponible - Les jobs asynchrones sont désactivés. Utilisez /api/reporting/import (synchrone)');
  }
  
  const queue = getQueue(QUEUE_NAMES.IMPORT_REPORTING);
  if (!queue) {
    throw new Error('Queue d\'import non disponible');
  }
  
  const job = await queue.add('import-reporting', data, {
    priority: data.priorite || 1,
    attempts: 3,
  });
  return job;
};

/**
 * Ajoute un job de génération de clôture
 */
const addClotureJob = async (data) => {
  if (!REDIS_AVAILABLE) {
    throw new Error('Redis non disponible');
  }
  
  const queue = getQueue(QUEUE_NAMES.GENERATION_CLOTURE);
  if (!queue) {
    throw new Error('Queue de clôture non disponible');
  }
  
  const job = await queue.add('generation-cloture', data, {
    priority: 2,
    attempts: 2,
  });
  return job;
};

/**
 * Ajoute un job de génération de CR
 */
const addCRJob = async (data) => {
  if (!REDIS_AVAILABLE) {
    throw new Error('Redis non disponible');
  }
  
  const queue = getQueue(QUEUE_NAMES.GENERATION_CR);
  if (!queue) {
    throw new Error('Queue de CR non disponible');
  }
  
  const job = await queue.add('generation-cr', data, {
    priority: 3,
    attempts: 2,
  });
  return job;
};

/**
 * Ajoute un job de génération de facture
 */
const addFactureJob = async (data) => {
  if (!REDIS_AVAILABLE) {
    throw new Error('Redis non disponible');
  }
  
  const queue = getQueue(QUEUE_NAMES.GENERATION_FACTURE);
  if (!queue) {
    throw new Error('Queue de facture non disponible');
  }
  
  const job = await queue.add('generation-facture', data, {
    priority: 3,
    attempts: 2,
  });
  return job;
};

// ============================================================
// 3. SUIVI DES JOBS
// ============================================================

/**
 * Récupère le statut d'un job
 */
const getJobStatus = async (queueName, jobId) => {
  if (!REDIS_AVAILABLE) {
    return {
      id: jobId,
      status: 'DISABLED',
      message: 'Redis désactivé - Mode synchrone',
    };
  }
  
  const queue = getQueue(queueName);
  if (!queue) return null;
  
  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: await job.getState(),
      progress: job.progress,
      attempts: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  } catch (error) {
    return null;
  }
};

/**
 * Récupère tous les jobs d'une queue
 */
const getJobs = async (queueName, status = 'active') => {
  if (!REDIS_AVAILABLE) {
    return [];
  }
  
  const queue = getQueue(queueName);
  if (!queue) return [];
  
  try {
    const jobs = await queue.getJobs([status]);
    return jobs;
  } catch (error) {
    return [];
  }
};

// ============================================================
// 4. EXPORT
// ============================================================

module.exports = {
  QUEUE_NAMES,
  getQueue,
  addImportJob,
  addClotureJob,
  addCRJob,
  addFactureJob,
  getJobStatus,
  getJobs,
  REDIS_AVAILABLE,
};