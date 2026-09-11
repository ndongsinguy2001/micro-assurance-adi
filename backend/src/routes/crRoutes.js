// backend/src/routes/crRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const {
  genererCR,
  getCRList,
  getCRById,
  exporterCR,
  soumettreCR,
  validerCR,
  envoyerCRauSFD,
  supprimerCR,
} = require('../controllers/crController');

// ✅ Toutes les routes sont protégées
router.use(protect);

// ============================================================
// ROUTES DE CONSULTATION
// ============================================================

/**
 * @route   GET /api/cr
 * @desc    Liste des comptes de résultat (avec filtres)
 * @access  Private (filtré par rôle)
 */
router.get('/', getCRList);

/**
 * @route   GET /api/cr/export/:sfdId/:annee
 * @desc    Exporter un CR en Excel
 * @access  Private (IG, ADMIN, ASSUREUR)
 */
router.get(
  '/export/:sfdId/:annee',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN', 'ASSUREUR'),
  exporterCR
);

// ============================================================
// ROUTES MÉTIER
// ============================================================

/**
 * @route   POST /api/cr/generer
 * @desc    Générer un CR (ou simulation si dryRun=true)
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 */
router.post('/generer', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), genererCR);

// ============================================================
// ROUTES WORKFLOW
// ============================================================

/**
 * @route   PUT /api/cr/:id/soumettre
 * @desc    Soumettre un CR à l'assureur
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 */
router.put(
  '/:id/soumettre',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  soumettreCR
);

/**
 * @route   PUT /api/cr/:id/valider
 * @desc    Valider un CR (par l'assureur)
 * @access  Private (ASSUREUR, ADMIN)
 */
router.put('/:id/valider', restrictTo('ASSUREUR', 'ADMIN'), validerCR);

/**
 * @route   PUT /api/cr/:id/envoyer
 * @desc    Envoyer le CR validé au SFD
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 */
router.put(
  '/:id/envoyer',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  envoyerCRauSFD
);

// ============================================================
// ROUTES DÉTAILS (placées en dernier pour éviter les conflits)
// ============================================================

/**
 * @route   GET /api/cr/:id
 * @desc    Détails d'un CR
 * @access  Private (filtré par rôle)
 */
router.get('/:id', getCRById);

/**
 * @route   DELETE /api/cr/:id
 * @desc    Supprimer un CR (brouillon uniquement)
 * @access  Private (ADMIN)
 */
router.delete('/:id', restrictTo('ADMIN'), supprimerCR);

module.exports = router;