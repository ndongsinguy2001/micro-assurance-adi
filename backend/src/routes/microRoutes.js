const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration Multer pour l'import Excel
const tempDir = './uploads';
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
    cb(null, `import-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers Excel sont autorisés (.xlsx, .xls)'), false);
    }
  },
});

// Routes protégées
router.use(protect);

// 📊 Route d'import
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // TODO: Implémenter le traitement du fichier Excel
    res.json({
      success: true,
      message: 'Fichier reçu avec succès',
      file: req.file
    });
  } catch (error) {
    console.error('Erreur import:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'import',
      error: error.message
    });
  }
});

// 📋 Routes de base pour les reportings
router.get('/reportings', (req, res) => {
  res.json({
    success: true,
    message: 'Liste des reportings (à implémenter)'
  });
});

router.get('/reportings/:id', (req, res) => {
  res.json({
    success: true,
    message: `Détails du reporting ${req.params.id} (à implémenter)`
  });
});

module.exports = router;