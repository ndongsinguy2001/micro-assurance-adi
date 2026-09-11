// backend/src/middlewares/errorHandler.js
/**
 * Middleware d'erreur global
 * Centralise la gestion des erreurs de l'API
 */

const errorHandler = (err, req, res, next) => {
  console.error('❌ Erreur:', err.message);
  console.error('📚 Stack:', err.stack);

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: messages,
    });
  }

  // Erreur de duplication MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'champ';
    const value = err.keyValue ? err.keyValue[field] : '';
    return res.status(400).json({
      success: false,
      message: `La valeur '${value}' est déjà utilisée pour le champ '${field}'`,
      field,
    });
  }

  // Erreur de cast MongoDB (ID invalide)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `ID invalide pour le champ '${err.path}'`,
      field: err.path,
    });
  }

  // Erreur Multer (upload)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `Erreur d'upload: ${err.message}`,
      field: err.field,
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expiré',
    });
  }

  // Erreur générique
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

/**
 * Middleware pour les routes non trouvées
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.originalUrl}`,
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};