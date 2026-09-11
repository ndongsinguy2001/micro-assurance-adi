// backend/src/routes/factureRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const {
  genererFacture,
  getFactures,
  getFactureByReference,
  telechargerFacturePDF,
  payerFacture,
  getStatistiquesFactures,
  annulerFacture,
  envoyerFacture,
} = require('../controllers/facturationController');

// ✅ Toutes les routes sont protégées
router.use(protect);

// ============================================================
// ROUTES PUBLIQUES (pour tous les utilisateurs authentifiés)
// ============================================================

router.get('/', getFactures);
router.get('/statistiques', getStatistiquesFactures);
router.get('/:reference/pdf', telechargerFacturePDF);
router.get('/:reference', getFactureByReference);

// ============================================================
// ROUTES ADMIN / GESTIONNAIRE IG UNIQUEMENT
// ============================================================

router.post('/generer', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), genererFacture);
router.put(
  '/:reference/envoyer',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  envoyerFacture
);
router.put('/:reference/payer', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), payerFacture);
router.put(
  '/:reference/annuler',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN'),
  annulerFacture
);

module.exports = router;