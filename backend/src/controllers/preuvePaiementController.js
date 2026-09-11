// backend/src/controllers/preuvePaiementController.js
const path = require('path');
const fs = require('fs');
const PreuvePaiement = require('../models/PreuvePaiement');
const Facture = require('../models/Facture');

const PREUVES_DIR = './uploads/preuves-paiement';

const ensureDir = () => {
  if (!fs.existsSync(PREUVES_DIR)) fs.mkdirSync(PREUVES_DIR, { recursive: true });
};

// ============================================================
// 1. CRÉER
// ============================================================
const createPreuve = async (req, res) => {
  try {
    const {
      type,
      sfdId,
      assureurId,
      factureId,
      reportingMensuelId,
      montant,
      devise,
      datePaiement,
      referencePaiement,
      mois,
      annee,
      trimestre,
      commentaire,
    } = req.body;

    if (!type || !montant || !datePaiement) {
      return res.status(400).json({
        success: false,
        message: 'type, montant et datePaiement sont obligatoires',
      });
    }

    ensureDir();

    const preuveData = {
      type,
      sfdId: sfdId || undefined,
      assureurId: assureurId || undefined,
      factureId: factureId || undefined,
      reportingMensuelId: reportingMensuelId || undefined,
      montant: parseFloat(montant),
      devise: devise || 'XOF',
      datePaiement: new Date(datePaiement),
      referencePaiement,
      commentaire,
      creePar: req.user._id,
    };

    if (mois || annee || trimestre) {
      preuveData.periodeConcernee = {
        mois: mois ? (Array.isArray(mois) ? mois : [parseInt(mois)]) : undefined,
        annee: annee ? parseInt(annee) : undefined,
        trimestre: trimestre ? parseInt(trimestre) : undefined,
      };
    }

    if (req.file) {
      preuveData.fichier = {
        nom: req.file.originalname,
        chemin: req.file.path,
        taille: req.file.size,
        dateUpload: new Date(),
      };
    }

    const preuve = await PreuvePaiement.create(preuveData);

    // Si lié à une facture et type ASSUREUR_VERS_IG → marquer la facture payée
    if (factureId && type === 'ASSUREUR_VERS_IG') {
      const facture = await Facture.findById(factureId);
      if (facture && facture.statut !== 'PAYEE') {
        facture.marquerPayee(preuve.montant, referencePaiement, commentaire);
        facture.modifiePar = req.user._id;
        await facture.save();
      }
    }

    res.status(201).json({
      success: true,
      message: 'Preuve de paiement enregistrée',
      data: preuve,
    });
  } catch (error) {
    console.error('❌ Erreur createPreuve:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement',
    });
  }
};

// ============================================================
// 2. LISTE
// ============================================================
const getPreuves = async (req, res) => {
  try {
    const { type, statut, sfdId, assureurId, annee, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (statut) filter.statut = statut;
    if (sfdId) filter.sfdId = sfdId;
    if (assureurId) filter.assureurId = assureurId;
    if (annee) filter['periodeConcernee.annee'] = parseInt(annee);

    // ✅ Filtres par rôle
    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter.sfdId = req.user.sfdId;
    }
    if (req.user.role === 'ASSUREUR' && req.user.assureurId) {
      filter.assureurId = req.user.assureurId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const preuves = await PreuvePaiement.find(filter)
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code')
      .populate('factureId', 'reference montants')
      .populate('creePar', 'nom email')
      .sort({ datePaiement: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PreuvePaiement.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: preuves,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getPreuves:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
// 3. DÉTAILS
// ============================================================
const getPreuveById = async (req, res) => {
  try {
    const preuve = await PreuvePaiement.findById(req.params.id)
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code')
      .populate('factureId', 'reference montants')
      .populate('verifiePar', 'nom email')
      .populate('creePar', 'nom email');

    if (!preuve) {
      return res.status(404).json({ success: false, message: 'Preuve non trouvée' });
    }

    res.status(200).json({ success: true, data: preuve });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
// 4. VÉRIFIER / REJETER
// ============================================================
const verifierPreuve = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaire } = req.body;

    if (!['VERIFIEE', 'REJETEE'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }

    const preuve = await PreuvePaiement.findById(id);
    if (!preuve) {
      return res.status(404).json({ success: false, message: 'Preuve non trouvée' });
    }

    if (statut === 'VERIFIEE') preuve.verifier(req.user._id, commentaire);
    else preuve.rejeter(req.user._id, commentaire || 'Sans motif');

    preuve.modifiePar = req.user._id;
    await preuve.save();

    res.status(200).json({
      success: true,
      message: `Preuve ${statut.toLowerCase()}`,
      data: preuve,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
// 5. TÉLÉCHARGER LE FICHIER
// ============================================================
const telechargerFichier = async (req, res) => {
  try {
    const preuve = await PreuvePaiement.findById(req.params.id);
    if (!preuve || !preuve.fichier?.chemin) {
      return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
    }
    if (!fs.existsSync(preuve.fichier.chemin)) {
      return res.status(404).json({ success: false, message: 'Fichier supprimé du serveur' });
    }

    res.download(preuve.fichier.chemin, preuve.fichier.nom);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
// 6. SUPPRIMER
// ============================================================
const supprimerPreuve = async (req, res) => {
  try {
    const preuve = await PreuvePaiement.findById(req.params.id);
    if (!preuve) {
      return res.status(404).json({ success: false, message: 'Preuve non trouvée' });
    }

    if (preuve.fichier?.chemin && fs.existsSync(preuve.fichier.chemin)) {
      try {
        fs.unlinkSync(preuve.fichier.chemin);
      } catch (e) {
        /* ignore */
      }
    }

    await PreuvePaiement.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Preuve supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

module.exports = {
  createPreuve,
  getPreuves,
  getPreuveById,
  verifierPreuve,
  telechargerFichier,
  supprimerPreuve,
};