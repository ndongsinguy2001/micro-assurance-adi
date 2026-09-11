// backend/src/workers/importWorker.js
const { Worker } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const { QUEUE_NAMES } = require('../services/queueService');
const fs = require('fs');

// Importer les contrôleurs
const { importReporting } = require('../controllers/reportingController');

// ============================================================
// 1. CRÉATION DU WORKER D'IMPORT
// ============================================================

const createImportWorker = () => {
  const connection = getRedisClient();
  
  const worker = new Worker(
    QUEUE_NAMES.IMPORT_REPORTING,
    async (job) => {
      console.log(`📥 Traitement du job ${job.id} - ${job.name}`);
      console.log(`📊 Données:`, job.data);
      
      try {
        // Simuler la progression
        await job.updateProgress(10);
        
        // Job data
        const { sfdId, mois, annee, filePath, userId } = job.data;
        
        // Créer un objet req simulé
        const req = {
          file: {
            path: filePath,
            originalname: job.data.fichier,
            size: job.data.taille || 0,
          },
          user: {
            _id: userId,
          },
          body: {
            sfdId,
            mois,
            annee,
          },
        };
        
        // Créer un objet res simulé
        let responseData = null;
        let responseStatus = 200;
        
        const res = {
          status: (code) => {
            responseStatus = code;
            return {
              json: (data) => {
                responseData = data;
              },
            };
          },
        };
        
        // Appeler le contrôleur
        await importReporting(req, res);
        
        // Vérifier le résultat
        if (responseData && responseData.success) {
          await job.updateProgress(100);
          return {
            success: true,
            data: responseData.data,
            message: responseData.message,
          };
        } else {
          throw new Error(responseData?.message || 'Erreur lors de l\'import');
        }
        
      } catch (error) {
        console.error(`❌ Erreur job ${job.id}:`, error.message);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Traiter un job à la fois
      limiter: {
        max: 5, // Max 5 jobs par période
        duration: 1000, // Par seconde
      },
    }
  );
  
  // ============================================================
  // ÉVÉNEMENTS DU WORKER
  // ============================================================
  
  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} terminé avec succès`);
    console.log(`📊 Résultat:`, result);
    
    // Nettoyer le fichier temporaire
    if (job.data.filePath) {
      try {
        fs.unlinkSync(job.data.filePath);
        console.log(`🗑️ Fichier temporaire supprimé: ${job.data.filePath}`);
      } catch (err) {
        console.error(`❌ Erreur suppression fichier:`, err.message);
      }
    }
  });
  
  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} échoué:`, err.message);
    
    // Nettoyer le fichier temporaire
    if (job && job.data && job.data.filePath) {
      try {
        fs.unlinkSync(job.data.filePath);
        console.log(`🗑️ Fichier temporaire supprimé: ${job.data.filePath}`);
      } catch (unlinkErr) {
        console.error(`❌ Erreur suppression fichier:`, unlinkErr.message);
      }
    }
  });
  
  worker.on('progress', (job, progress) => {
    console.log(`📊 Job ${job.id} progression: ${progress}%`);
  });
  
  worker.on('stalled', (jobId) => {
    console.warn(`⚠️ Job ${jobId} bloqué`);
  });
  
  console.log('👷 Worker d\'import démarré');
  
  return worker;
};

// ============================================================
// 2. CRÉATION DU WORKER DE CLÔTURE
// ============================================================

const createClotureWorker = () => {
  const connection = getRedisClient();
  
  const worker = new Worker(
    QUEUE_NAMES.GENERATION_CLOTURE,
    async (job) => {
      console.log(`📦 Traitement de clôture ${job.id}`);
      
      try {
        await job.updateProgress(20);
        
        // Logique de clôture
        const { reportingId, userId } = job.data;
        
        // Appeler le service de clôture
        // const result = await cloturerReporting({ reportingId, userId });
        
        await job.updateProgress(100);
        
        return {
          success: true,
          message: 'Clôture générée avec succès',
          // data: result,
        };
        
      } catch (error) {
        console.error(`❌ Erreur clôture ${job.id}:`, error.message);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
    }
  );
  
  worker.on('completed', (job, result) => {
    console.log(`✅ Clôture ${job.id} terminée`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`❌ Clôture ${job.id} échouée:`, err.message);
  });
  
  return worker;
};

// ============================================================
// 3. CRÉATION DU WORKER DE FACTURE
// ============================================================

const createFactureWorker = () => {
  const connection = getRedisClient();
  
  const worker = new Worker(
    QUEUE_NAMES.GENERATION_FACTURE,
    async (job) => {
      console.log(`📄 Traitement de facture ${job.id}`);
      
      try {
        await job.updateProgress(20);
        
        // Logique de génération de facture
        const { sfdId, trimestre, annee, userId } = job.data;
        
        // Appeler le service de facturation
        // const result = await genererFacture({ sfdId, trimestre, annee, userId });
        
        await job.updateProgress(100);
        
        return {
          success: true,
          message: 'Facture générée avec succès',
          // data: result,
        };
        
      } catch (error) {
        console.error(`❌ Erreur facture ${job.id}:`, error.message);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
    }
  );
  
  return worker;
};

// ============================================================
// 4. EXPORT
// ============================================================

module.exports = {
  createImportWorker,
  createClotureWorker,
  createFactureWorker,
};