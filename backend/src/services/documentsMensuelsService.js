// backend/src/services/documentsMensuelsService.js
const path = require('path');
const fs = require('fs');
const Sinistre = require('../models/Sinistre');
const Adhesion = require('../models/Adhesion');
const ReportingMensuel = require('../models/ReportingMensuel');
const {
  generateAppelCotisation,
  generateRapportSinistres,
  ensureDirectoryExists,
} = require('./pdfService');
const { generateClotureFile } = require('./excelService');

const DOCUMENTS_DIR = './uploads/documents';

/**
 * Génère tous les documents d'un reporting clôturé
 */
const genererDocumentsCloture = async (reporting, sfd, contrat, user) => {
  ensureDirectoryExists(DOCUMENTS_DIR);

  const docsDir = path.join(DOCUMENTS_DIR, sfd.code);
  ensureDirectoryExists(docsDir);

  const dateSuffix = `${reporting.mois}_${reporting.annee}_${Date.now()}`;
  const resultats = {
    appelCotisation: null,
    appelReglementSinistres: null,
    rapportSinistres: null,
    fichierCloture: null,
  };

  // --- 1. Charger les adhésions (valides + exclusions) ---
  const adhesions = await Adhesion.find({ _id: { $in: reporting.adhesions } });
  const exclusions = await Adhesion.find({ _id: { $in: reporting.exclusions.ids } });

  // --- 2. Charger les sinistres de ce reporting ---
  const sinistres = await Sinistre.find({ reportingMensuelId: reporting._id })
    .populate('adhesionId', 'nomEmprunteur prenomEmprunteur dateNaissance montantPret');

  // --- 3. Fichier de clôture Excel ---
  try {
    const excelPath = path.join(docsDir, `SFD_${sfd.code}_${dateSuffix}.xlsx`);
    const excelResult = await generateClotureFile(
      reporting,
      adhesions,
      exclusions,
      sfd,
      contrat,
      excelPath
    );
    resultats.fichierCloture = {
      nom: excelResult.filename,
      chemin: excelResult.path,
      dateGeneration: new Date(),
    };
  } catch (e) {
    console.error('⚠️ Erreur génération fichier clôture:', e.message);
  }

  // --- 4. Appel à cotisation PDF ---
  try {
    const appelPath = path.join(docsDir, `AppelCotisation_${dateSuffix}.pdf`);
    const appelResult = await generateAppelCotisation(
      reporting,
      sfd,
      contrat,
      user,
      appelPath
    );
    resultats.appelCotisation = {
      nom: appelResult.filename,
      chemin: appelResult.path,
      reference: appelResult.reference,
      dateGeneration: new Date(),
    };
  } catch (e) {
    console.error('⚠️ Erreur génération appel à cotisation:', e.message);
  }

  // --- 5. Rapport de sinistres PDF (si sinistres) ---
  if (sinistres.length > 0) {
    try {
      const rapportPath = path.join(docsDir, `RapportSinistres_${dateSuffix}.pdf`);
      const rapportResult = await generateRapportSinistres(
        sinistres,
        reporting,
        sfd,
        rapportPath
      );
      resultats.rapportSinistres = {
        nom: rapportResult.filename,
        chemin: rapportResult.path,
        dateGeneration: new Date(),
      };
    } catch (e) {
      console.error('⚠️ Erreur génération rapport sinistres:', e.message);
    }
  }

  // --- 6. Appel règlement sinistres (uniquement Allianz/DIRECT) ---
  if (contrat.typeGestionSinistres === 'DIRECT' && sinistres.length > 0) {
    const totalSinistres = sinistres.reduce(
      (sum, s) => sum + (s.montantSinistre || 0),
      0
    );

    // Réutilise le même service pour l'appel règlement
    try {
      const appelReglPath = path.join(docsDir, `AppelReglement_${dateSuffix}.pdf`);
      const appelReglResult = await generateAppelCotisation(
        {
          ...reporting.toObject(),
          totalMontantDu: totalSinistres,
          totalPrime: totalSinistres,
          totalFraisGestion: 0,
          totalTaxes: 0,
          commissionSFD: 0,
          commissionIG: 0,
          commissionAssureur: 0,
        },
        sfd,
        contrat,
        user,
        appelReglPath
      );
      resultats.appelReglementSinistres = {
        nom: appelReglResult.filename,
        chemin: appelReglResult.path,
        dateGeneration: new Date(),
      };
    } catch (e) {
      console.error('⚠️ Erreur génération appel règlement:', e.message);
    }
  }

  return resultats;
};

module.exports = {
  genererDocumentsCloture,
  DOCUMENTS_DIR,
};