// backend/src/routes/contratRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');
const Contrat = require('../models/Contrat');

// ✅ Toutes les routes sont protégées
router.use(protect);

// ============================================================
// ROUTES PUBLIQUES (utilisateurs authentifiés)
// ============================================================

router.get('/', async (req, res) => {
  try {
    const { statut, sfdId, assureurId, search, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (statut) filter.statut = statut;
    if (sfdId) filter.sfdId = sfdId;
    if (assureurId) filter.assureurId = assureurId;

    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter.sfdId = req.user.sfdId;
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

    const contrats = await Contrat.find(filter)
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contrat.countDocuments(filter);

    res.json({
      success: true,
      data: contrats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getContrats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sfd/:sfdId', async (req, res) => {
  try {
    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      req.user.sfdId.toString() !== req.params.sfdId
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const contrats = await Contrat.find({ sfdId: req.params.sfdId }).populate(
      'assureurId',
      'nom code'
    );

    res.json({ success: true, data: contrats });
  } catch (error) {
    console.error('❌ Erreur getContratsBySFD:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contrat = await Contrat.findById(req.params.id)
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code');

    if (!contrat) {
      return res.status(404).json({ success: false, message: 'Contrat non trouvé' });
    }

    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      contrat.sfdId?._id?.toString() !== req.user.sfdId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    if (
      req.user.role === 'ASSUREUR' &&
      req.user.assureurId &&
      contrat.assureurId?._id?.toString() !== req.user.assureurId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    res.json({ success: true, data: contrat });
  } catch (error) {
    console.error('❌ Erreur getContratById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// ROUTES ADMIN / GESTIONNAIRE IG UNIQUEMENT
// ============================================================

router.post('/', restrictTo('ADMIN', 'GESTIONNAIRE_IG'), async (req, res) => {
  try {
    const contrat = new Contrat({
      ...req.body,
      code: req.body.code?.toUpperCase(),
      creePar: req.user._id,
    });
    await contrat.save();
    res.status(201).json({ success: true, data: contrat });
  } catch (error) {
    console.error('❌ Erreur createContrat:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', restrictTo('ADMIN', 'GESTIONNAIRE_IG'), async (req, res) => {
  try {
    const updates = { ...req.body, modifiePar: req.user._id };
    if (updates.code) updates.code = updates.code.toUpperCase();

    const contrat = await Contrat.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!contrat) {
      return res.status(404).json({ success: false, message: 'Contrat non trouvé' });
    }
    res.json({ success: true, data: contrat });
  } catch (error) {
    console.error('❌ Erreur updateContrat:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', restrictTo('ADMIN'), async (req, res) => {
  try {
    const ReportingMensuel = require('../models/ReportingMensuel');
    const nbReportings = await ReportingMensuel.countDocuments({
      contratId: req.params.id,
    });
    if (nbReportings > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer : ${nbReportings} reporting(s) lié(s)`,
      });
    }

    const contrat = await Contrat.findByIdAndDelete(req.params.id);
    if (!contrat) {
      return res.status(404).json({ success: false, message: 'Contrat non trouvé' });
    }
    res.json({ success: true, message: 'Contrat supprimé avec succès' });
  } catch (error) {
    console.error('❌ Erreur deleteContrat:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;