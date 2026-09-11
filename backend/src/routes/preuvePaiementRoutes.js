// backend/src/routes/preuvePaiementRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, restrictTo } = require('../middlewares/auth');
const {
  createPreuve,
  getPreuves,
  getPreuveById,
  verifierPreuve,
  telechargerFichier,
  supprimerPreuve,
} = require('../controllers/preuvePaiementController');

const dir = './uploads/preuves-paiement';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `preuve-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formats acceptés : PDF, JPG, PNG, XLSX, XLS'), false);
  },
});

router.use(protect);

router.get('/', getPreuves);
router.get('/:id', getPreuveById);
router.get('/:id/fichier', telechargerFichier);

router.post(
  '/',
  restrictTo('GESTIONNAIRE_IG', 'ADMIN', 'SFD'),
  upload.single('file'),
  createPreuve
);

router.put('/:id/verifier', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), verifierPreuve);
router.delete('/:id', restrictTo('GESTIONNAIRE_IG', 'ADMIN'), supprimerPreuve);

module.exports = router;