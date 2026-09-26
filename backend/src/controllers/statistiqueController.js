// backend/src/controllers/statistiqueController.js
const Statistique = require('../models/Statistique');

// ============================================================
// 1. CRÉER OU METTRE À JOUR UNE STATISTIQUE MENSUELLE
// ============================================================

const upsertStatistique = async (req, res) => {
  try {
    const { pays, annee, mois, ...data } = req.body;

    if (!pays || !annee || !mois) {
      return res.status(400).json({
        success: false,
        message: 'pays, annee et mois sont requis',
      });
    }

    const statistique = await Statistique.findOneAndUpdate(
      { pays, annee, mois },
      { ...data, modifiePar: req.user._id },
      { returnDocument: 'after', upsert: true, runValidators: true }   // ✅ CORRIGÉ
    );

    res.status(201).json({
      success: true,
      message: 'Statistique enregistrée avec succès',
      data: statistique,
    });
  } catch (error) {
    console.error('Erreur upsertStatistique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 2. LISTE DES STATISTIQUES
// ============================================================

const getStatistiques = async (req, res) => {
  try {
    const { pays, annee, mois, limit = 100, page = 1 } = req.query;

    const filter = {};
    if (pays) filter.pays = pays;
    if (annee) filter.annee = parseInt(annee);
    if (mois) filter.mois = parseInt(mois);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const statistiques = await Statistique.find(filter)
      .sort({ annee: -1, mois: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Statistique.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: statistiques,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Erreur getStatistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 3. STATISTIQUES AGRÉGÉES PAR ANNÉE
// ============================================================

const getAgregat = async (req, res) => {
  try {
    const { pays, annee } = req.query;

    const filter = {};
    if (pays) filter.pays = pays;
    if (annee) filter.annee = parseInt(annee);

    const stats = await Statistique.find(filter).sort({ mois: 1 });

    if (stats.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          mois: [],
          total: {},
        },
      });
    }

    const moisData = {
      nbHommes: [],
      nbFemmes: [],
      nbPM: [],
      capitalAssure: [],
      primeTotale: [],
      nbSinistres: [],
      montantSinistres: [],
      commissionGestionIMF: [],
      montantDuAssureur: [],
      montantPayeSFD: [],
      commissionsFacturees: [],
      commissionsEncaissees: [],
      montantPayeAllianz: [],
    };

    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];

    const moisLabels = [];
    const totals = {
      nbHommes: 0,
      nbFemmes: 0,
      nbPM: 0,
      capitalAssure: 0,
      primeTotale: 0,
      nbSinistres: 0,
      montantSinistres: 0,
      commissionGestionIMF: 0,
      montantDuAssureur: 0,
      montantPayeSFD: 0,
      commissionsFacturees: 0,
      commissionsEncaissees: 0,
      montantPayeAllianz: 0,
    };

    stats.forEach((s) => {
      moisLabels.push(moisNoms[s.mois - 1]);
      moisData.nbHommes.push(s.nbHommes || 0);
      moisData.nbFemmes.push(s.nbFemmes || 0);
      moisData.nbPM.push(s.nbPM || 0);
      moisData.capitalAssure.push(s.capitalAssure || 0);
      moisData.primeTotale.push(s.primeTotale || 0);
      moisData.nbSinistres.push(s.nbSinistres || 0);
      moisData.montantSinistres.push(s.montantSinistres || 0);
      moisData.commissionGestionIMF.push(s.commissionGestionIMF || 0);
      moisData.montantDuAssureur.push(s.montantDuAssureur || 0);
      moisData.montantPayeSFD.push(s.montantPayeSFD || 0);
      moisData.commissionsFacturees.push(s.commissionsFacturees || 0);
      moisData.commissionsEncaissees.push(s.commissionsEncaissees || 0);
      moisData.montantPayeAllianz.push(s.montantPayeAllianz || 0);

      totals.nbHommes += s.nbHommes || 0;
      totals.nbFemmes += s.nbFemmes || 0;
      totals.nbPM += s.nbPM || 0;
      totals.capitalAssure += s.capitalAssure || 0;
      totals.primeTotale += s.primeTotale || 0;
      totals.nbSinistres += s.nbSinistres || 0;
      totals.montantSinistres += s.montantSinistres || 0;
      totals.commissionGestionIMF += s.commissionGestionIMF || 0;
      totals.montantDuAssureur += s.montantDuAssureur || 0;
      totals.montantPayeSFD += s.montantPayeSFD || 0;
      totals.commissionsFacturees += s.commissionsFacturees || 0;
      totals.commissionsEncaissees += s.commissionsEncaissees || 0;
      totals.montantPayeAllianz += s.montantPayeAllianz || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        annee: parseInt(annee) || new Date().getFullYear(),
        pays: pays || 'Sénégal',
        moisLabels,
        moisData,
        total: totals,
      },
    });
  } catch (error) {
    console.error('Erreur getAgregat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des agrégats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 4. SUPPRIMER UNE STATISTIQUE
// ============================================================

const deleteStatistique = async (req, res) => {
  try {
    const { id } = req.params;
    const statistique = await Statistique.findByIdAndDelete(id);

    if (!statistique) {
      return res.status(404).json({
        success: false,
        message: 'Statistique non trouvée',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Statistique supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur deleteStatistique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  upsertStatistique,
  getStatistiques,
  getAgregat,
  deleteStatistique,
};