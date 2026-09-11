// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

// Routes publiques
router.post('/register', register);
router.post('/login', login);

// Routes privées
router.get('/me', protect, getMe);

module.exports = router;