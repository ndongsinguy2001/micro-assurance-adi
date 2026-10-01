// backend/src/routes/reportingRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  importReporting,
  soumettreImportReporting,
  getReportings,
  getReportingById,
  getAdhesionsByReporting,
  reImporterReporting,
  cloturerReporting,
  telechargerDocument,
  getImportJobById,
  getIgnoredLines,      // 🔹 Phase 5.7
  getImportHistory,
  getImportJobs,
} = require('../controllers/reportingController');

const tempDir = './uploads';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `reporting-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new Error('Seuls les fichiers Excel sont autorisés (.xlsx, .xls)'),
        false
      );
  },
});

router.use(protect);

// ============================================================
// IMPORT
// ============================================================
router.post(
  '/import',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  upload.single('file'),
  importReporting
);

router.post(
  '/import-queue',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  upload.single('file'),
  soumettreImportReporting
);

router.post(
  '/:id/re-importer',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  upload.single('file'),
  reImporterReporting
);

// ============================================================
// IMPORTJOBS (⚠️ AVANT /:id pour éviter conflits)
// ============================================================
router.get(
  '/jobs',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  getImportJobs
);

router.get(
  '/jobs/history',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  getImportHistory
);

// 🔹 Phase 5.7 — Lignes ignorées paginées
router.get(
  '/jobs/:id/ignored-lines',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  getIgnoredLines
);

router.get(
  '/jobs/:id',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  getImportJobById
);

// ============================================================
// CONSULTATION
// ============================================================
router.get('/', getReportings);
router.get('/:id', getReportingById);
router.get('/:id/adhesions', getAdhesionsByReporting);

// ============================================================
// WORKFLOW
// ============================================================
router.post(
  '/:id/cloturer',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  cloturerReporting
);

// ============================================================
// TÉLÉCHARGEMENT DOCUMENTS
// ============================================================
router.get('/:id/documents/:type', telechargerDocument);

module.exports = router;