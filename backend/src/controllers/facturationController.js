// backend/src/controllers/facturationController.js
const path = require('path');
const fs = require('fs');
const Facture = require('../models/Facture');
const ReportingMensuel = require('../models/ReportingMensuel');
const SFD = require('../models/SFD');
const Contrat = require('../models/Contrat');
const Job = require('../models/Job');
const { generateFacturePDF } = require('../services/pdfFactureService');

// ============================================================
// CONSTANTES
// ============================================================

const STATUT_FACTURE = {
  GENEREE: 'GENEREE',
  ENVOYEE: 'ENVOYEE',
  PAYEE: 'PAYEE',
  ANNULEE: 'ANNULEE',
};

const TAUX_TVA = 0.18;
const FACTURES_DIR = './uploads/factures';

const MOIS_TRIMESTRE = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

// ============================================================
// UTILITAIRES
// ============================================================

const generateFactureReference = (sfdCode, trimestre, annee) => {
  return `F-${sfdCode}-Q${trimestre}-${annee}`;
};

const ensureFacturesDir = () => {
  if (!fs.existsSync(FACTURES_DIR)) {
    fs.mkdirSync(FACTURES_DIR, { recursive: true });
  }
};

// ============================================================
// 1. GÉNÉRER UNE FACTURE TRIMESTRIELLE
// ============================================================

const genererFacture = async (req, res) => {
  try {
    const { sfdId, trimestre, annee, tauxChange, notes } = req.body;

    // --- Validation ---
    if (!sfdId || !trimestre || !annee) {
      return res.status(400).json({
        success: false,
        message: 'sfdId, trimestre et annee sont requis',
      });
    }

    const trimestreNum = parseInt(trimestre);
    const anneeNum = parseInt(annee);

    if (trimestreNum < 1 || trimestreNum > 4) {
      return res.status(400).json({
        success: false,
        message: 'Trimestre invalide (1-4)',
      });
    }

    // --- Vérification SFD ---
    const sfd = await SFD.findById(sfdId);
    if (!sfd) {
      return res.status(404).json({
        success: false,
        message: 'SFD non trouvé',
      });
    }

    // --- Vérification Contrat ---
    const contrat = await Contrat.findOne({ sfdId, statut: 'ACTIF' }).populate(
      'assureurId',
      'nom code'
    );
    if (!contrat) {
      return res.status(404).json({
        success: false,
        message: 'Aucun contrat actif trouvé pour ce SFD',
      });
    }

    // --- Vérification anti-doublon ---
    const reference = generateFactureReference(sfd.code, trimestreNum, anneeNum);
    const existingFacture = await Facture.findOne({ reference });
    if (existingFacture) {
      return res.status(400).json({
        success: false,
        message: `Une facture existe déjà avec la référence ${reference}`,
        data: { factureId: existingFacture._id, statut: existingFacture.statut },
      });
    }

    // --- Détermination des mois ---
    const mois = MOIS_TRIMESTRE[trimestreNum];
    const dateDebut = new Date(anneeNum, mois[0] - 1, 1);
    const dateFin = new Date(anneeNum, mois[mois.length - 1], 0);

    // --- Récupération des reportings clôturés ---
    const reportings = await ReportingMensuel.find({
      sfdId,
      annee: anneeNum,
      mois: { $in: mois },
      statut: 'CLOTURE',
    }).sort({ mois: 1 });

    if (reportings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun reporting clôturé trouvé pour ce trimestre',
      });
    }

    // --- Vérification exhaustivité ---
    const moisReportings = reportings.map((r) => r.mois);
    const moisManquants = mois.filter((m) => !moisReportings.includes(m));

    if (moisManquants.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Reportings manquants pour les mois : ${moisManquants.join(', ')}`,
      });
    }

    // --- Calcul des montants ---
    let totalPrimes = 0;
    let totalAdhesions = 0;
    let totalExclusions = 0;

    reportings.forEach((r) => {
      totalPrimes += r.totalPrime || 0;
      totalAdhesions += r.nombreAdhesions || 0;
      totalExclusions += r.nombreExclusions || 0;
    });

    const tauxCommissionIG = contrat.tauxCommissionIG || 0.15;
    const commissionIG = totalPrimes * tauxCommissionIG;
    const tva = commissionIG * TAUX_TVA;
    const totalTTC = commissionIG + tva;

    const tauxChangeFinal = parseFloat(tauxChange) || 1;
    const totalTTCDevise = tauxChangeFinal > 0 ? totalTTC / tauxChangeFinal : totalTTC;

    // --- Construction de la facture ---
    const facture = await Facture.create({
      reference,
      date: new Date(),
      sfd: {
        _id: sfd._id,
        nom: sfd.nom,
        code: sfd.code,
        contact: sfd.contact || {},
        adresse: sfd.adresse || '',
        pays: sfd.pays || 'Sénégal',
      },
      contrat: {
        _id: contrat._id,
        nom: contrat.nom,
        code: contrat.code,
        assureurId: contrat.assureurId?._id,
        assureurNom: contrat.assureurId?.nom || '',
      },
      periode: {
        trimestre: trimestreNum,
        annee: anneeNum,
        mois,
        debut: dateDebut,
        fin: dateFin,
        tauxChange: tauxChangeFinal,
      },
      reportings: reportings.map((r) => ({
        _id: r._id,
        mois: r.mois,
        annee: r.annee,
        totalPrime: r.totalPrime || 0,
        nombreAdhesions: r.nombreAdhesions || 0,
        nombreExclusions: r.nombreExclusions || 0,
      })),
      montants: {
        totalPrimes,
        tauxCommission: tauxCommissionIG,
        commissionIG,
        tauxTVA: TAUX_TVA,
        tva,
        totalTTC,
        totalTTCDevise,
      },
      details: {
        nombreReportings: reportings.length,
        nombreAdhesions: totalAdhesions,
        nombreExclusions: totalExclusions,
      },
      statut: STATUT_FACTURE.GENEREE,
      dateGeneration: new Date(),
      notes: notes || '',
      creePar: req.user._id,
    });

    // --- Génération du PDF ---
    ensureFacturesDir();
    const pdfFilename = `facture_${reference}_${Date.now()}.pdf`;
    const pdfPath = path.join(FACTURES_DIR, pdfFilename);

    try {
      const pdfResult = await generateFacturePDF(facture, pdfPath);
      facture.pdfPath = pdfResult.path;
      facture.pdfNom = pdfResult.filename;
      await facture.save();
    } catch (pdfError) {
      console.error('⚠️ Erreur génération PDF:', pdfError.message);
      // On continue malgré l'échec PDF, la facture est créée
    }

    // --- Création du Job de suivi ---
    const job = await Job.create({
      type: 'GENERATION_FACTURES',
      code: `JOB-FACT-${Date.now()}`,
      statut: 'COMPLETED',
      progression: 100,
      donnees: {
        factureRef: reference,
        sfdId: sfd._id,
        trimestre: trimestreNum,
        annee: anneeNum,
      },
      resultat: {
        factureId: facture._id,
        totalPrimes,
        commissionIG,
        totalTTC,
      },
      dateDebut: new Date(),
      dateFin: new Date(),
      creePar: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Facture générée avec succès',
      data: {
        facture,
        job,
        pdfUrl: facture.pdfPath ? `/api/factures/${reference}/pdf` : null,
      },
    });
  } catch (error) {
    console.error('❌ Erreur genererFacture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 2. LISTE DES FACTURES
// ============================================================

const getFactures = async (req, res) => {
  try {
    const { sfdId, annee, trimestre, statut, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (sfdId) filter['sfd._id'] = sfdId;
    if (annee) filter['periode.annee'] = parseInt(annee);
    if (trimestre) filter['periode.trimestre'] = parseInt(trimestre);
    if (statut) filter.statut = statut;

    // ✅ Si l'utilisateur est un SFD, il ne voit que ses factures
    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter['sfd._id'] = req.user.sfdId;
    }

    // ✅ Si l'utilisateur est un ASSUREUR, il ne voit que ses factures (via contrat)
    if (req.user.role === 'ASSUREUR' && req.user.assureurId) {
      filter['contrat.assureurId'] = req.user.assureurId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const factures = await Facture.find(filter)
      .sort({ dateGeneration: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Facture.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: factures,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getFactures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des factures',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 3. DÉTAILS D'UNE FACTURE PAR RÉFÉRENCE
// ============================================================

const getFactureByReference = async (req, res) => {
  try {
    const { reference } = req.params;

    const facture = await Facture.findOne({ reference });
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    // ✅ Contrôle d'accès
    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      facture.sfd._id.toString() !== req.user.sfdId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    if (
      req.user.role === 'ASSUREUR' &&
      req.user.assureurId &&
      facture.contrat.assureurId?.toString() !== req.user.assureurId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    res.status(200).json({ success: true, data: facture });
  } catch (error) {
    console.error('❌ Erreur getFactureByReference:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 4. TÉLÉCHARGER LA FACTURE PDF
// ============================================================

const telechargerFacturePDF = async (req, res) => {
  try {
    const { reference } = req.params;

    const facture = await Facture.findOne({ reference });
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    // ✅ Contrôle d'accès
    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      facture.sfd._id.toString() !== req.user.sfdId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    if (
      req.user.role === 'ASSUREUR' &&
      req.user.assureurId &&
      facture.contrat.assureurId?.toString() !== req.user.assureurId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    // --- Vérifier si le PDF existe ---
    if (!facture.pdfPath || !fs.existsSync(facture.pdfPath)) {
      // Régénérer le PDF
      ensureFacturesDir();
      const pdfFilename = facture.pdfNom || `facture_${reference}_${Date.now()}.pdf`;
      const pdfPath = path.join(FACTURES_DIR, pdfFilename);

      try {
        const pdfResult = await generateFacturePDF(facture, pdfPath);
        facture.pdfPath = pdfResult.path;
        facture.pdfNom = pdfResult.filename;
        await facture.save();
      } catch (pdfError) {
        console.error('❌ Erreur régénération PDF:', pdfError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du PDF',
        });
      }
    }

    res.download(facture.pdfPath, `facture_${reference}.pdf`, (err) => {
      if (err) {
        console.error('❌ Erreur téléchargement PDF:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement',
          });
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur telechargerFacturePDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 5. MARQUER UNE FACTURE COMME PAYÉE
// ============================================================

const payerFacture = async (req, res) => {
  try {
    const { reference } = req.params;
    const { datePaiement, referencePaiement, montantPaye, commentaire } = req.body;

    const facture = await Facture.findOne({ reference });
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    if (facture.statut === STATUT_FACTURE.PAYEE) {
      return res.status(400).json({
        success: false,
        message: 'Cette facture est déjà payée',
      });
    }

    if (facture.statut === STATUT_FACTURE.ANNULEE) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de payer une facture annulée',
      });
    }

    facture.statut = STATUT_FACTURE.PAYEE;
    facture.datePaiement = datePaiement ? new Date(datePaiement) : new Date();
    facture.referencePaiement = referencePaiement || '';
    facture.montantPaye = parseFloat(montantPaye) || facture.montants.totalTTC;
    if (commentaire) {
      facture.notes = facture.notes
        ? `${facture.notes}\nPaiement: ${commentaire}`
        : `Paiement: ${commentaire}`;
    }
    facture.modifiePar = req.user._id;

    await facture.save();

    res.status(200).json({
      success: true,
      message: 'Facture marquée comme payée',
      data: facture,
    });
  } catch (error) {
    console.error('❌ Erreur payerFacture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du paiement de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 6. STATISTIQUES DES FACTURES
// ============================================================

const getStatistiquesFactures = async (req, res) => {
  try {
    const { annee } = req.query;

    const filter = {};
    if (annee) filter['periode.annee'] = parseInt(annee);

    // ✅ Filtres selon rôle
    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter['sfd._id'] = req.user.sfdId;
    }
    if (req.user.role === 'ASSUREUR' && req.user.assureurId) {
      filter['contrat.assureurId'] = req.user.assureurId;
    }

    const total = await Facture.countDocuments(filter);

    const parStatut = await Facture.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$statut',
          count: { $sum: 1 },
          total: { $sum: '$montants.totalTTC' },
        },
      },
    ]);

    const totalMontantAgg = await Facture.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$montants.totalTTC' } } },
    ]);

    const stats = {
      total,
      parStatut: {
        GENEREE: { count: 0, montant: 0 },
        ENVOYEE: { count: 0, montant: 0 },
        PAYEE: { count: 0, montant: 0 },
        ANNULEE: { count: 0, montant: 0 },
      },
      totalMontant: totalMontantAgg[0]?.total || 0,
    };

    parStatut.forEach((item) => {
      if (stats.parStatut[item._id]) {
        stats.parStatut[item._id] = { count: item.count, montant: item.total };
      }
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Erreur getStatistiquesFactures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 7. ANNULER UNE FACTURE
// ============================================================

const annulerFacture = async (req, res) => {
  try {
    const { reference } = req.params;
    const { motif } = req.body;

    if (!motif) {
      return res.status(400).json({
        success: false,
        message: 'Un motif est requis pour annuler la facture',
      });
    }

    const facture = await Facture.findOne({ reference });
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    if (facture.statut === STATUT_FACTURE.PAYEE) {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler une facture déjà payée',
      });
    }

    if (facture.statut === STATUT_FACTURE.ANNULEE) {
      return res.status(400).json({
        success: false,
        message: 'Cette facture est déjà annulée',
      });
    }

    facture.statut = STATUT_FACTURE.ANNULEE;
    facture.motifAnnulation = motif;
    facture.modifiePar = req.user._id;
    await facture.save();

    res.status(200).json({
      success: true,
      message: 'Facture annulée avec succès',
      data: facture,
    });
  } catch (error) {
    console.error('❌ Erreur annulerFacture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 8. MARQUER UNE FACTURE COMME ENVOYÉE
// ============================================================

const envoyerFacture = async (req, res) => {
  try {
    const { reference } = req.params;

    const facture = await Facture.findOne({ reference });
    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    if (facture.statut !== STATUT_FACTURE.GENEREE) {
      return res.status(400).json({
        success: false,
        message: 'Seule une facture générée peut être marquée comme envoyée',
      });
    }

    facture.statut = STATUT_FACTURE.ENVOYEE;
    facture.dateEnvoi = new Date();
    facture.modifiePar = req.user._id;
    await facture.save();

    res.status(200).json({
      success: true,
      message: 'Facture marquée comme envoyée',
      data: facture,
    });
  } catch (error) {
    console.error('❌ Erreur envoyerFacture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage de la facture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  genererFacture,
  getFactures,
  getFactureByReference,
  telechargerFacturePDF,
  payerFacture,
  getStatistiquesFactures,
  annulerFacture,
  envoyerFacture,
};