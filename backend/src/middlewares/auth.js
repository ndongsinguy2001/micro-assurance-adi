const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware d'authentification
 * Vérifie que l'utilisateur est connecté via son token JWT
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-motDePasse');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }
      
      if (!req.user.actif) {
        return res.status(401).json({
          success: false,
          message: 'Compte désactivé'
        });
      }

      next();
    } catch (error) {
      console.error('Erreur auth:', error);
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé, token manquant'
    });
  }
};

/**
 * Middleware de restriction par rôle
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé, utilisateur non authentifié'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Rôle requis: ' + roles.join(', ')
      });
    }

    next();
  };
};

module.exports = {
  protect,
  restrictTo
};