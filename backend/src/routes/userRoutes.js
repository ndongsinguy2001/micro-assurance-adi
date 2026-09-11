// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  changerMotDePasse,
  toggleActif,
  deleteUser,
} = require('../controllers/userController');

// ✅ Toutes les routes sont protégées
router.use(protect);

// ✅ Toutes les routes sont ADMIN uniquement
router.use(restrictTo('ADMIN'));

// ============================================================
// ROUTES
// ============================================================

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/password', changerMotDePasse);
router.put('/:id/toggle', toggleActif);
router.delete('/:id', deleteUser);

module.exports = router;