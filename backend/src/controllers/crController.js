// backend/src/controllers/crController.js
const path = require('path');
const fs = require('fs');
const CompteResultat = require('../models/CompteResultat');
const {
  calculerCR,
  genererEtPersister,
  TYPES_CLOTURE,
} = require('../services/crService');
const { generateCRExcel } = require('../services/excelCRService');

// ============================================================
// CONSTANTES
// ============================================================

const CR_DIR = './uploads/cr';

const ensureCRDir = () => {
  if (!fs.existsSync(CR_DIR)) {
    fs.mkdirSync(CR_DIR, { recursive: true });
  }
};

// ============================================================
// 1. GÉNÉRER UN COMPTE DE RÉSULTAT
// ============================================================

const genererCR = async (req, res) => {
  try {
    const { sfdId, annee, typeCloture, dryRun } = req.body;

    if (!sfdId || !annee) {
      return res.status(400).json({
        success: false,
        message: 'sfdId et annee sont requis',
      });
    }

    const typeFinal =
      typeCloture === TYPES_CLOTURE.ALLIANZ
        ? TYPES_CLOTURE.ALLIANZ
        : TYPES_CLOTURE.CIVILE;

    const anneeNum = parseInt(annee);
    if (isNaN(anneeNum) || anneeNum < 2000 || anneeNum > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Année invalide',
      });
    }

    // Mode simulation : calcul sans persistance
    if (dryRun) {
      const donnees = await calculerCR({
        sfdId,
        annee: anneeNum,
        typeCloture: typeFinal,
      });
      return res.status(200).json({
        success: true,
        message: 'Compte de résultat calculé (mode simulation)',
        data: donnees,
      });
    }

    // Mode normal : génération + persistance
    const cr = await genererEtPersister({
      sfdId,
      annee: anneeNum,
      typeCloture: typeFinal,
      userId: req.user._id,
    });

    // Génération de l'Excel
    ensureCRDir();
    const excelFilename = `CR_${cr.sfd.code}_${anneeNum}_${typeFinal}_${Date.now()}.xlsx`;
    const excelPath = path.join(CR_DIR, excelFilename);

    try {
      const excelResult = await generateCRExcel(cr, excelPath);
      cr.excelPath = excelResult.path;
      cr.excelNom = excelResult.filename;
      await cr.save();
    } catch (excelErr) {
      console.error('⚠️ Erreur génération Excel:', excelErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Compte de résultat généré avec succès',
      data: cr,
    });
  } catch (error) {
    console.error('❌ Erreur genererCR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la génération du compte de résultat',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// ============================================================
// 2. LISTE DES CR GÉNÉRÉS
// ============================================================

const getCRList = async (req, res) => {
  try {
    const { sfdId, annee, type, statut, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (sfdId) filter['sfd._id'] = sfdId;
    if (annee) filter['periode.annee'] = parseInt(annee);
    if (type) filter['periode.type'] = type;
    if (statut) filter.statut = statut;

    // ✅ Filtres selon rôle
    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter['sfd._id'] = req.user.sfdId;
    }
    if (req.user.role === 'ASSUREUR' && req.user.assureurId) {
      filter['contrat.assureurId'] = req.user.assureurId;
      // Un assureur ne voit que les CR validés
      filter.statut = { $in: ['VALIDE', 'ENVOYE_SFD'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const crs = await CompteResultat.find(filter)
      .sort({ 'periode.annee': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CompteResultat.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: crs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getCRList:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des CR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 3. DÉTAILS D'UN CR
// ============================================================

const getCRById = async (req, res) => {
  try {
    const cr = await CompteResultat.findById(req.params.id)
      .populate('validePar', 'nom email')
      .populate('envoyePar', 'nom email')
      .populate('creePar', 'nom email');

    if (!cr) {
      return res.status(404).json({
        success: false,
        message: 'Compte de résultat non trouvé',
      });
    }

    // ✅ Contrôle d'accès
    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      cr.sfd._id.toString() !== req.user.sfdId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    if (
      req.user.role === 'ASSUREUR' &&
      req.user.assureurId &&
      cr.contrat.assureurId?.toString() !== req.user.assureurId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    res.status(200).json({ success: true, data: cr });
  } catch (error) {
    console.error('❌ Erreur getCRById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du CR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 4. EXPORTER LE CR EN EXCEL
// ============================================================

const exporterCR = async (req, res) => {
  try {
    const { sfdId, annee } = req.params;
    const { typeCloture } = req.query;

    const typeFinal =
      typeCloture === TYPES_CLOTURE.ALLIANZ
        ? TYPES_CLOTURE.ALLIANZ
        : TYPES_CLOTURE.CIVILE;

    const anneeNum = parseInt(annee);

    // Chercher un CR existant
    const cr = await CompteResultat.findOne({
      'sfd._id': sfdId,
      'periode.annee': anneeNum,
      'periode.type': typeFinal,
    });

    let crToExport = cr;

    // Si pas de CR, on calcule à la volée (dry run)
    if (!crToExport) {
      const donnees = await calculerCR({
        sfdId,
        annee: anneeNum,
        typeCloture: typeFinal,
      });
      crToExport = donnees;
    }

    // Générer l'Excel dans un fichier temporaire
    ensureCRDir();
    const filename = `CR_${crToExport.sfd.code}_${anneeNum}_${typeFinal}_${Date.now()}.xlsx`;
    const filePath = path.join(CR_DIR, filename);

    await generateCRExcel(crToExport, filePath);

    // Envoyer le fichier
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Erreur téléchargement:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement',
          });
        }
      }
      // Nettoyer le fichier temporaire après un délai
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          /* ignore */
        }
      }, 60000);
    });
  } catch (error) {
    console.error('❌ Erreur exporterCR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'export du compte de résultat',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// ============================================================
// 5. SOUMETTRE UN CR À L'ASSUREUR
// ============================================================

const soumettreCR = async (req, res) => {
  try {
    const { id } = req.params;

    const cr = await CompteResultat.findById(id);
    if (!cr) {
      return res.status(404).json({
        success: false,
        message: 'Compte de résultat non trouvé',
      });
    }

    if (cr.statut !== 'BROUILLON') {
      return res.status(400).json({
        success: false,
        message: `Seul un CR au statut BROUILLON peut être soumis (statut actuel : ${cr.statut})`,
      });
    }

    cr.soumettre();
    cr.modifiePar = req.user._id;
    await cr.save();

    res.status(200).json({
      success: true,
      message: 'CR soumis à l\'assureur pour validation',
      data: cr,
    });
  } catch (error) {
    console.error('❌ Erreur soumettreCR:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 6. VALIDER UN CR (ASSUREUR / ADMIN)
// ============================================================

const validerCR = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire } = req.body;

    const cr = await CompteResultat.findById(id);
    if (!cr) {
      return res.status(404).json({
        success: false,
        message: 'Compte de résultat non trouvé',
      });
    }

    if (cr.statut !== 'SOUMIS_ASSUREUR') {
      return res.status(400).json({
        success: false,
        message: `Seul un CR au statut SOUMIS_ASSUREUR peut être validé (statut actuel : ${cr.statut})`,
      });
    }

    cr.valider(req.user._id);
    if (commentaire) {
      cr.notes = cr.notes
        ? `${cr.notes}\nValidation: ${commentaire}`
        : `Validation: ${commentaire}`;
    }
    cr.modifiePar = req.user._id;
    await cr.save();

    res.status(200).json({
      success: true,
      message: 'CR validé avec succès',
      data: cr,
    });
  } catch (error) {
    console.error('❌ Erreur validerCR:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 7. ENVOYER LE CR AU SFD
// ============================================================

const envoyerCRauSFD = async (req, res) => {
  try {
    const { id } = req.params;

    const cr = await CompteResultat.findById(id);
    if (!cr) {
      return res.status(404).json({
        success: false,
        message: 'Compte de résultat non trouvé',
      });
    }

    if (cr.statut !== 'VALIDE') {
      return res.status(400).json({
        success: false,
        message: `Seul un CR VALIDÉ peut être envoyé au SFD (statut actuel : ${cr.statut})`,
      });
    }

    cr.envoyerAuSFD(req.user._id);
    cr.modifiePar = req.user._id;
    await cr.save();

    res.status(200).json({
      success: true,
      message: 'CR envoyé au SFD avec succès',
      data: cr,
    });
  } catch (error) {
    console.error('❌ Erreur envoyerCRauSFD:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 8. SUPPRIMER UN CR (ADMIN uniquement, statut BROUILLON)
// ============================================================

const supprimerCR = async (req, res) => {
  try {
    const { id } = req.params;

    const cr = await CompteResultat.findById(id);
    if (!cr) {
      return res.status(404).json({
        success: false,
        message: 'Compte de résultat non trouvé',
      });
    }

    if (cr.statut !== 'BROUILLON') {
      return res.status(400).json({
        success: false,
        message: 'Seul un CR au statut BROUILLON peut être supprimé',
      });
    }

    // Supprimer le fichier Excel associé
    if (cr.excelPath && fs.existsSync(cr.excelPath)) {
      try {
        fs.unlinkSync(cr.excelPath);
      } catch (e) {
        console.error('⚠️ Impossible de supprimer le fichier Excel:', e.message);
      }
    }

    await CompteResultat.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'CR supprimé avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur supprimerCR:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  genererCR,
  getCRList,
  getCRById,
  exporterCR,
  soumettreCR,
  validerCR,
  envoyerCRauSFD,
  supprimerCR,
};