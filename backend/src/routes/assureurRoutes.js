// backend/src/routes/assureurRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const {
  createAssureur,
  getAssureurs,
  getAssureurById,
  updateAssureur,
  deleteAssureur
} = require('../controllers/assureurController');

// Toutes les routes sont protégées
router.use(protect);

// Routes publiques (pour tous les utilisateurs authentifiés)
router.get('/', getAssureurs);
router.get('/:id', getAssureurById);

// Routes admin uniquement
router.post('/', restrictTo('ADMIN'), createAssureur);
router.put('/:id', restrictTo('ADMIN'), updateAssureur);
router.delete('/:id', restrictTo('ADMIN'), deleteAssureur);

module.exports = router;