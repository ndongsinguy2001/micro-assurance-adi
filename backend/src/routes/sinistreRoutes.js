// backend/src/routes/sinistreRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  createSinistre,
  getSinistres,
  getSinistreById,
  ajouterJustificatif,
  validerSinistre,
  refuserSinistre,
  payerSinistre,
  getStatistiquesSinistres
} = require('../controllers/sinistreController');

// ============================================================
// CONFIGURATION MULTER
// ============================================================

const tempDir = './uploads/justificatifs';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `justificatif-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF et images sont autorisés'), false);
    }
  }
});

// ============================================================
// ROUTES PROTÉGÉES
// ============================================================

router.use(protect);

// ============================================================
// ROUTES PUBLIQUES (pour tous les utilisateurs authentifiés)
// ============================================================

/**
 * @route   GET /api/sinistres
 * @desc    Liste des sinistres avec filtres
 * @access  Private
 */
router.get('/', getSinistres);

/**
 * @route   GET /api/sinistres/statistiques
 * @desc    Statistiques des sinistres
 * @access  Private
 */
router.get('/statistiques', getStatistiquesSinistres);

/**
 * @route   GET /api/sinistres/:id
 * @desc    Détails d'un sinistre
 * @access  Private
 */
router.get('/:id', getSinistreById);

// ============================================================
// ROUTES POUR SFD ET GESTIONNAIRE
// ============================================================

/**
 * @route   POST /api/sinistres
 * @desc    Déclarer un nouveau sinistre
 * @access  Private (SFD, GESTIONNAIRE_IG)
 */
router.post('/', restrictTo('SFD', 'GESTIONNAIRE_IG', 'ADMIN'), createSinistre);

/**
 * @route   POST /api/sinistres/:id/justificatifs
 * @desc    Ajouter un justificatif à un sinistre
 * @access  Private (SFD, GESTIONNAIRE_IG)
 */
router.post(
  '/:id/justificatifs',
  restrictTo('SFD', 'GESTIONNAIRE_IG', 'ADMIN'),
  upload.single('file'),
  ajouterJustificatif
);

// ============================================================
// ROUTES POUR GESTIONNAIRE ET ADMIN UNIQUEMENT
// ============================================================

/**
 * @route   PUT /api/sinistres/:id/valider
 * @desc    Valider un sinistre
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 */
router.put('/:id/valider', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), validerSinistre);

/**
 * @route   PUT /api/sinistres/:id/refuser
 * @desc    Refuser un sinistre
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 */
router.put('/:id/refuser', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), refuserSinistre);

/**
 * @route   PUT /api/sinistres/:id/payer
 * @desc    Marquer un sinistre comme payé
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 */
router.put('/:id/payer', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), payerSinistre);

module.exports = router;