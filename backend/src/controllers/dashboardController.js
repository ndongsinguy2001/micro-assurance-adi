// backend/src/controllers/dashboardController.js
const SFD = require('../models/SFD');
const ReportingMensuel = require('../models/ReportingMensuel');
const Sinistre = require('../models/Sinistre');
const Contrat = require('../models/Contrat');
const Adhesion = require('../models/Adhesion');

// ============================================================
// 1. INDICATEURS GLOBAUX POUR IG
// ============================================================

const getIndicateursGlobaux = async (req, res) => {
  try {
    const sfdActifs = await SFD.countDocuments({ statut: 'ACTIF' });
    const sfdTotaux = await SFD.countDocuments();

    const reportingsEnCours = await ReportingMensuel.countDocuments({
      statut: { $in: ['EN_VALIDATION', 'EXCLUSIONS_A_CORRIGER', 'CORRIGE'] },
    });
    const reportingsClotures = await ReportingMensuel.countDocuments({ statut: 'CLOTURE' });

    const sinistresEnAttente = await Sinistre.countDocuments({ statut: 'A_VERIFIER' });
    const sinistresValides = await Sinistre.countDocuments({ statut: 'VALIDE' });
    const sinistresPayes = await Sinistre.countDocuments({ statut: 'PAYE' });

    const dernierReporting = await ReportingMensuel.findOne()
      .sort({ annee: -1, mois: -1 });

    let primesTotales = 0;
    if (dernierReporting) {
      const reportings = await ReportingMensuel.find({
        annee: dernierReporting.annee,
        mois: dernierReporting.mois,
      });
      primesTotales = reportings.reduce((sum, r) => sum + (r.totalPrime || 0), 0);
    }

    const contratsActifs = await Contrat.countDocuments({ statut: 'ACTIF' });

    res.status(200).json({
      success: true,
      data: {
        sfd: {
          actifs: sfdActifs,
          total: sfdTotaux,
          tauxActivation: sfdTotaux > 0 ? ((sfdActifs / sfdTotaux) * 100).toFixed(1) : 0,
        },
        reportings: {
          enCours: reportingsEnCours,
          clotures: reportingsClotures,
        },
        sinistres: {
          enAttente: sinistresEnAttente,
          valides: sinistresValides,
          payes: sinistresPayes,
        },
        primes: {
          total: primesTotales,
          mois: dernierReporting ? `${dernierReporting.mois}/${dernierReporting.annee}` : null,
        },
        contrats: {
          actifs: contratsActifs,
        },
      },
    });
  } catch (error) {
    console.error('❌ Erreur getIndicateursGlobaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des indicateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 2. INDICATEURS POUR UN SFD (AVEC CONTRÔLE D'ACCÈS)
// ============================================================

const getIndicateursSFD = async (req, res) => {
  try {
    const { sfdId } = req.params;

    // ✅ Vérification d'accès : un SFD ne peut voir que ses propres données
    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      req.user.sfdId.toString() !== sfdId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez voir que vos propres données.',
      });
    }

    // ✅ Un ASSUREUR ne peut voir que les SFD liés à ses contrats
    if (req.user.role === 'ASSUREUR' && req.user.assureurId) {
      const contrat = await Contrat.findOne({
        sfdId,
        assureurId: req.user.assureurId,
      });
      if (!contrat) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Ce SFD n\'est pas lié à votre compte.',
        });
      }
    }

    const sfd = await SFD.findById(sfdId);
    if (!sfd) {
      return res.status(404).json({
        success: false,
        message: 'SFD non trouvé',
      });
    }

    const reportings = await ReportingMensuel.find({ sfdId })
      .sort({ annee: -1, mois: -1 })
      .limit(12);

    const totalReportings = await ReportingMensuel.countDocuments({ sfdId });
    const reportingsClotures = await ReportingMensuel.countDocuments({
      sfdId,
      statut: 'CLOTURE',
    });

    let totalPrimes = 0;
    reportings.forEach((r) => {
      totalPrimes += r.totalPrime || 0;
    });

    const sinistres = await Sinistre.find({ sfdId });
    const sinistresEnAttente = sinistres.filter((s) => s.statut === 'A_VERIFIER').length;
    const sinistresValides = sinistres.filter((s) => s.statut === 'VALIDE').length;
    const sinistresPayes = sinistres.filter((s) => s.statut === 'PAYE').length;

    const contrat = await Contrat.findOne({ sfdId, statut: 'ACTIF' });

    res.status(200).json({
      success: true,
      data: {
        sfd: {
          _id: sfd._id,
          nom: sfd.nom,
          code: sfd.code,
          statut: sfd.statut,
        },
        contrat: contrat
          ? {
              _id: contrat._id,
              nom: contrat.nom,
              dateEffet: contrat.dateEffet,
            }
          : null,
        reportings: {
          total: totalReportings,
          clotures: reportingsClotures,
          derniers: reportings.slice(0, 6).map((r) => ({
            mois: r.mois,
            annee: r.annee,
            statut: r.statut,
            totalPrime: r.totalPrime,
            nombreAdhesions: r.nombreAdhesions,
          })),
        },
        sinistres: {
          total: sinistres.length,
          enAttente: sinistresEnAttente,
          valides: sinistresValides,
          payes: sinistresPayes,
        },
        primes: {
          total: totalPrimes,
          moyenne: reportings.length > 0 ? totalPrimes / reportings.length : 0,
        },
      },
    });
  } catch (error) {
    console.error('❌ Erreur getIndicateursSFD:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des indicateurs du SFD',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 3. SUIVI INTERMÉDIATION
// ============================================================

const getSuiviIntermediation = async (req, res) => {
  try {
    const { mois, annee } = req.query;

    const moisCourant = mois || new Date().getMonth() + 1;
    const anneeCourante = annee || new Date().getFullYear();

    const sfds = await SFD.find({ statut: 'ACTIF' });

    const reportings = await ReportingMensuel.find({
      mois: parseInt(moisCourant),
      annee: parseInt(anneeCourante),
    });

    const suivi = sfds.map((sfd) => {
      const reporting = reportings.find(
        (r) => r.sfdId.toString() === sfd._id.toString()
      );

      let statut = 'NON_RECU';
      let dateReception = null;
      let dateCloture = null;
      let nombreAdhesions = 0;
      let nombreExclusions = 0;
      let reportingId = null;

      if (reporting) {
        statut = reporting.statut;
        dateReception = reporting.dateReception;
        dateCloture = reporting.dateCloture;
        nombreAdhesions = reporting.nombreAdhesions || 0;
        nombreExclusions = reporting.nombreExclusions || 0;
        reportingId = reporting._id;
      }

      return {
        sfd: {
          _id: sfd._id,
          nom: sfd.nom,
          code: sfd.code,
        },
        reporting: {
          _id: reportingId,
          statut,
          dateReception,
          dateCloture,
          nombreAdhesions,
          nombreExclusions,
        },
        estEnRetard: !reporting && new Date().getDate() > 10,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        mois: parseInt(moisCourant),
        annee: parseInt(anneeCourante),
        totalSFD: sfds.length,
        reportingsRecus: reportings.length,
        suivi,
      },
    });
  } catch (error) {
    console.error('❌ Erreur getSuiviIntermediation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du suivi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getIndicateursGlobaux,
  getIndicateursSFD,
  getSuiviIntermediation,
};