// backend/src/routes/sfdRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const SFD = require('../models/SFD');

// ✅ Toutes les routes sont protégées
router.use(protect);

// ============================================================
// ROUTES PUBLIQUES (utilisateurs authentifiés)
// ============================================================

router.get('/', async (req, res) => {
  try {
    const { statut, search, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (statut) filter.statut = statut;

    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter._id = req.user.sfdId;
    }

    if (req.user.role === 'ASSUREUR' && req.user.assureurId) {
      filter.assureurId = req.user.assureurId;
    }

    if (search) {
      filter.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sfds = await SFD.find(filter)
      .sort({ nom: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SFD.countDocuments(filter);

    res.json({
      success: true,
      data: sfds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getSFDs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      req.user.sfdId.toString() !== req.params.id
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const sfd = await SFD.findById(req.params.id);
    if (!sfd) {
      return res.status(404).json({ success: false, message: 'SFD non trouvé' });
    }

    res.json({ success: true, data: sfd });
  } catch (error) {
    console.error('❌ Erreur getSFDById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// ROUTES ADMIN / GESTIONNAIRE IG UNIQUEMENT
// ============================================================

router.post('/', restrictTo('ADMIN', 'GESTIONNAIRE_IG'), async (req, res) => {
  try {
    const sfd = new SFD({
      ...req.body,
      creePar: req.user._id,
    });
    await sfd.save();
    res.status(201).json({ success: true, data: sfd });
  } catch (error) {
    console.error('❌ Erreur createSFD:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', restrictTo('ADMIN', 'GESTIONNAIRE_IG'), async (req, res) => {
  try {
    const sfd = await SFD.findByIdAndUpdate(
      req.params.id,
      { ...req.body, modifiePar: req.user._id },
      { new: true, runValidators: true }
    );
    if (!sfd) {
      return res.status(404).json({ success: false, message: 'SFD non trouvé' });
    }
    res.json({ success: true, data: sfd });
  } catch (error) {
    console.error('❌ Erreur updateSFD:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', restrictTo('ADMIN'), async (req, res) => {
  try {
    const Contrat = require('../models/Contrat');
    const nbContrats = await Contrat.countDocuments({ sfdId: req.params.id });
    if (nbContrats > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer : ${nbContrats} contrat(s) lié(s)`,
      });
    }

    const sfd = await SFD.findByIdAndDelete(req.params.id);
    if (!sfd) {
      return res.status(404).json({ success: false, message: 'SFD non trouvé' });
    }
    res.json({ success: true, message: 'SFD supprimé avec succès' });
  } catch (error) {
    console.error('❌ Erreur deleteSFD:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;