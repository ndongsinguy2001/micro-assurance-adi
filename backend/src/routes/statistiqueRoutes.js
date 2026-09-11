// backend/src/routes/statistiqueRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const {
  upsertStatistique,
  getStatistiques,
  getAgregat,
  deleteStatistique,
} = require('../controllers/statistiqueController');

router.use(protect);

// Routes publiques (pour tous les utilisateurs authentifiés)
router.get('/', getStatistiques);
router.get('/agregat', getAgregat);

// Routes admin uniquement
router.post('/', restrictTo('ADMIN'), upsertStatistique);
router.delete('/:id', restrictTo('ADMIN'), deleteStatistique);

module.exports = router;