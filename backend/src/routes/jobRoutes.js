// backend/src/routes/jobRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const { getJobStatus, getJobs, QUEUE_NAMES } = require('../services/queueService');

router.use(protect);

/**
 * @route   GET /api/jobs/status/:queueName/:jobId
 * @desc    Récupérer le statut d'un job
 * @access  Private
 */
router.get('/status/:queueName/:jobId', async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    
    if (!Object.values(QUEUE_NAMES).includes(queueName)) {
      return res.status(400).json({
        success: false,
        message: 'Queue invalide',
      });
    }
    
    const status = await getJobStatus(queueName, jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Job non trouvé',
      });
    }
    
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('❌ Erreur getJobStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/jobs/queue/:queueName
 * @desc    Récupérer tous les jobs d'une queue
 * @access  Private (ADMIN)
 */
router.get('/queue/:queueName', restrictTo('ADMIN'), async (req, res) => {
  try {
    const { queueName } = req.params;
    const { status = 'active' } = req.query;
    
    if (!Object.values(QUEUE_NAMES).includes(queueName)) {
      return res.status(400).json({
        success: false,
        message: 'Queue invalide',
      });
    }
    
    const jobs = await getJobs(queueName, status);
    
    res.status(200).json({
      success: true,
      data: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attempts: job.attemptsMade,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
        failedReason: job.failedReason,
      })),
    });
  } catch (error) {
    console.error('❌ Erreur getJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;