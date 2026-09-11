// backend/src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const {
  getIndicateursGlobaux,
  getIndicateursSFD,
  getSuiviIntermediation
} = require('../controllers/dashboardController');

// Toutes les routes sont protégées
router.use(protect);

// Routes pour IG et ADMIN
router.get('/indicateurs', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), getIndicateursGlobaux);
router.get('/suivi', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), getSuiviIntermediation);

// Routes pour tous (y compris SFD pour voir ses propres indicateurs)
router.get('/sfd/:sfdId', getIndicateursSFD);

module.exports = router;