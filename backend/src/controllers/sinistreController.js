// backend/src/controllers/sinistreController.js
const Sinistre = require('../models/Sinistre');
const Adhesion = require('../models/Adhesion');
const ReportingMensuel = require('../models/ReportingMensuel');
const SFD = require('../models/SFD');
const Contrat = require('../models/Contrat');
const Job = require('../models/Job');

// ============================================================
// CONSTANTES
// ============================================================

const STATUT_SINISTRE = {
  A_VERIFIER: 'A_VERIFIER',
  VALIDE: 'VALIDE',
  REFUSE: 'REFUSE',
  PAYE: 'PAYE',
};

// ============================================================
// 1. CRÉER UN SINISTRE
// ============================================================

const createSinistre = async (req, res) => {
  try {
    const {
      adhesionId,
      dateSinistre,
      typeSinistre,
      description,
      montantPret,
      capitalRestantDu,
      capitalRembourse,
      justificatifs,
      notes,
    } = req.body;

    const adhesion = await Adhesion.findById(adhesionId);
    if (!adhesion) {
      return res.status(404).json({
        success: false,
        message: 'Adhésion non trouvée',
      });
    }

    const existingSinistre = await Sinistre.findOne({ adhesionId });
    if (existingSinistre) {
      return res.status(400).json({
        success: false,
        message: 'Un sinistre existe déjà pour cette adhésion',
      });
    }

    const montantSinistre = capitalRestantDu || montantPret || 0;
    const montantPartSFD = capitalRestantDu || montantPret || 0;
    const montantPartAssure = capitalRembourse || 0;

    const sinistre = await Sinistre.create({
      adhesionId,
      sfdId: adhesion.sfdId,
      reportingMensuelId: adhesion.reportingMensuelId,
      contratId: adhesion.contratId,
      dateSinistre: dateSinistre || new Date(),
      typeSinistre: typeSinistre || 'DECES',
      description,
      montantPret: montantPret || adhesion.montantPret || 0,
      capitalRestantDu: capitalRestantDu || adhesion.montantPret || 0,
      capitalRembourse: capitalRembourse || 0,
      montantSinistre,
      montantPartSFD,
      montantPartAssure,
      justificatifs: justificatifs || [],
      statut: STATUT_SINISTRE.A_VERIFIER,
      notes,
      creePar: req.user._id,
    });

    adhesion.sinistre = {
      estSinistre: true,
      date: sinistre.dateSinistre,
      montant: sinistre.montantSinistre,
      statut: sinistre.statut,
    };
    await adhesion.save();

    sinistre.ajouterHistorique('DECLARATION', 'Sinistre déclaré', req.user._id);
    await sinistre.save();

    res.status(201).json({
      success: true,
      message: 'Sinistre déclaré avec succès',
      data: sinistre,
    });
  } catch (error) {
    console.error('❌ Erreur createSinistre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déclaration du sinistre',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 2. LISTE DES SINISTRES
// ============================================================

const getSinistres = async (req, res) => {
  try {
    const { sfdId, statut, type, dateDebut, dateFin, limit = 50, page = 1 } = req.query;

    const filter = { estActif: true };
    if (sfdId) filter.sfdId = sfdId;
    if (statut) filter.statut = statut;
    if (type) filter.typeSinistre = type;

    if (dateDebut || dateFin) {
      filter.dateSinistre = {};
      if (dateDebut) filter.dateSinistre.$gte = new Date(dateDebut);
      if (dateFin) filter.dateSinistre.$lte = new Date(dateFin);
    }

    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter.sfdId = req.user.sfdId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sinistres = await Sinistre.find(filter)
      .populate('sfdId', 'nom code')
      .populate('adhesionId', 'nomEmprunteur prenomEmprunteur')
      .populate('contratId', 'nom code')
      .populate('creePar', 'nom email')
      .sort({ dateSinistre: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sinistre.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: sinistres,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getSinistres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des sinistres',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 3. DÉTAILS D'UN SINISTRE
// ============================================================

const getSinistreById = async (req, res) => {
  try {
    const sinistre = await Sinistre.findById(req.params.id)
      .populate('sfdId', 'nom code contact')
      .populate('adhesionId', 'nomEmprunteur prenomEmprunteur dateNaissance montantPret')
      .populate('reportingMensuelId', 'mois annee')
      .populate('contratId', 'nom code typeGestionSinistres')
      .populate('creePar', 'nom email')
      .populate('validePar', 'nom email');

    if (!sinistre) {
      return res.status(404).json({
        success: false,
        message: 'Sinistre non trouvé',
      });
    }

    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      sinistre.sfdId?._id?.toString() !== req.user.sfdId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé.',
      });
    }

    res.status(200).json({
      success: true,
      data: sinistre,
    });
  } catch (error) {
    console.error('❌ Erreur getSinistreById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du sinistre',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 4. AJOUTER UN JUSTIFICATIF
// ============================================================

const ajouterJustificatif = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, nom } = req.body;

    const sinistre = await Sinistre.findById(id);
    if (!sinistre) {
      return res.status(404).json({
        success: false,
        message: 'Sinistre non trouvé',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni',
      });
    }

    const justificatif = {
      nom: nom || req.file.originalname,
      chemin: req.file.path,
      type: type || 'AUTRE',
      dateUpload: new Date(),
      taille: req.file.size,
      uploadedPar: req.user._id,
    };

    sinistre.justificatifs.push(justificatif);
    sinistre.verifications.piecesRecues = sinistre.toutesPiecesRecues();
    sinistre.modifiePar = req.user._id;
    sinistre.ajouterHistorique('AJOUT_JUSTIFICATIF', 'Justificatif ajouté', req.user._id);
    await sinistre.save();

    res.status(200).json({
      success: true,
      message: 'Justificatif ajouté avec succès',
      data: sinistre,
    });
  } catch (error) {
    console.error('❌ Erreur ajouterJustificatif:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du justificatif',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 5. VALIDER UN SINISTRE
// ============================================================

const validerSinistre = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire } = req.body;

    const sinistre = await Sinistre.findById(id);
    if (!sinistre) {
      return res.status(404).json({
        success: false,
        message: 'Sinistre non trouvé',
      });
    }

    if (sinistre.statut === 'VALIDE') {
      return res.status(400).json({
        success: false,
        message: 'Ce sinistre est déjà validé',
      });
    }

    if (sinistre.statut === 'REFUSE') {
      return res.status(400).json({
        success: false,
        message: 'Ce sinistre a été refusé',
      });
    }

    if (!sinistre.toutesPiecesRecues()) {
      return res.status(400).json({
        success: false,
        message: 'Toutes les pièces justificatives ne sont pas encore reçues',
      });
    }

    sinistre.statut = STATUT_SINISTRE.VALIDE;
    sinistre.verifications = {
      ...sinistre.verifications,
      existenceEmprunteur: true,
      piecesRecues: true,
      conditionsContrat: true,
      commentaire: commentaire || 'Sinistre validé',
    };
    sinistre.dateValidation = new Date();
    sinistre.validePar = req.user._id;
    sinistre.modifiePar = req.user._id;
    sinistre.ajouterHistorique('VALIDATION', commentaire || 'Sinistre validé', req.user._id);
    await sinistre.save();

    await Adhesion.findByIdAndUpdate(sinistre.adhesionId, {
      'sinistre.statut': 'VALIDE',
    });

    res.status(200).json({
      success: true,
      message: 'Sinistre validé avec succès',
      data: sinistre,
    });
  } catch (error) {
    console.error('❌ Erreur validerSinistre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation du sinistre',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 6. REFUSER UN SINISTRE
// ============================================================

const refuserSinistre = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire } = req.body;

    if (!commentaire) {
      return res.status(400).json({
        success: false,
        message: 'Un commentaire est requis pour refuser un sinistre',
      });
    }

    const sinistre = await Sinistre.findById(id);
    if (!sinistre) {
      return res.status(404).json({
        success: false,
        message: 'Sinistre non trouvé',
      });
    }

    if (sinistre.statut === 'REFUSE') {
      return res.status(400).json({
        success: false,
        message: 'Ce sinistre est déjà refusé',
      });
    }

    if (sinistre.statut === 'PAYE') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de refuser un sinistre déjà payé',
      });
    }

    sinistre.statut = STATUT_SINISTRE.REFUSE;
    sinistre.verifications.commentaire = commentaire;
    sinistre.modifiePar = req.user._id;
    sinistre.ajouterHistorique('REFUS', commentaire, req.user._id);
    await sinistre.save();

    // ✅ FIX : 'REFUSE' au lieu de 'REJETE'
    await Adhesion.findByIdAndUpdate(sinistre.adhesionId, {
      'sinistre.statut': 'REFUSE',
    });

    res.status(200).json({
      success: true,
      message: 'Sinistre refusé avec succès',
      data: sinistre,
    });
  } catch (error) {
    console.error('❌ Erreur refuserSinistre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du refus du sinistre',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 7. MARQUER UN SINISTRE COMME PAYÉ
// ============================================================

const payerSinistre = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire, montantPaye } = req.body;

    const sinistre = await Sinistre.findById(id);
    if (!sinistre) {
      return res.status(404).json({
        success: false,
        message: 'Sinistre non trouvé',
      });
    }

    if (sinistre.statut !== 'VALIDE') {
      return res.status(400).json({
        success: false,
        message: 'Seul un sinistre validé peut être marqué comme payé',
      });
    }

    sinistre.statut = STATUT_SINISTRE.PAYE;
    sinistre.datePaiement = new Date();
    if (montantPaye) sinistre.montantSinistre = montantPaye;
    sinistre.modifiePar = req.user._id;
    sinistre.ajouterHistorique('PAIEMENT', commentaire || 'Sinistre payé', req.user._id);
    await sinistre.save();

    await Adhesion.findByIdAndUpdate(sinistre.adhesionId, {
      'sinistre.statut': 'PAYE',
    });

    res.status(200).json({
      success: true,
      message: 'Sinistre marqué comme payé avec succès',
      data: sinistre,
    });
  } catch (error) {
    console.error('❌ Erreur payerSinistre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du paiement du sinistre',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 8. STATISTIQUES DES SINISTRES
// ============================================================

const getStatistiquesSinistres = async (req, res) => {
  try {
    const { sfdId, dateDebut, dateFin } = req.query;

    const filter = { estActif: true };
    if (sfdId) filter.sfdId = sfdId;
    if (dateDebut || dateFin) {
      filter.dateSinistre = {};
      if (dateDebut) filter.dateSinistre.$gte = new Date(dateDebut);
      if (dateFin) filter.dateSinistre.$lte = new Date(dateFin);
    }

    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter.sfdId = req.user.sfdId;
    }

    const total = await Sinistre.countDocuments(filter);
    const parStatut = await Sinistre.aggregate([
      { $match: filter },
      { $group: { _id: '$statut', count: { $sum: 1 } } },
    ]);

    const parType = await Sinistre.aggregate([
      { $match: filter },
      { $group: { _id: '$typeSinistre', count: { $sum: 1 } } },
    ]);

    const totalMontant = await Sinistre.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$montantSinistre' } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        parStatut: parStatut.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        parType: parType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        totalMontant: totalMontant[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('❌ Erreur getStatistiquesSinistres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  createSinistre,
  getSinistres,
  getSinistreById,
  ajouterJustificatif,
  validerSinistre,
  refuserSinistre,
  payerSinistre,
  getStatistiquesSinistres,
};