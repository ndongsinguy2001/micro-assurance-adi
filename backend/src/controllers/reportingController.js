// backend/src/controllers/reportingController.js
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const SFD = require('../models/SFD');
const Contrat = require('../models/Contrat');
const Assureur = require('../models/Assureur');
const ReportingMensuel = require('../models/ReportingMensuel');
const Adhesion = require('../models/Adhesion');
const Sinistre = require('../models/Sinistre');
const Job = require('../models/Job');
const SuiviIntermediation = require('../models/SuiviIntermediation');
const { addImportJob } = require('../services/queueService');
const { genererDocumentsCloture } = require('../services/documentsMensuelsService');

// ============================================================
//  CONSTANTES
// ============================================================

const STATUT_REPORTING = {
  RECU: 'RECU',
  EN_VALIDATION: 'EN_VALIDATION',
  EXCLUSIONS_A_CORRIGER: 'EXCLUSIONS_A_CORRIGER',
  CORRIGE: 'CORRIGE',
  CLOTURE: 'CLOTURE',
};

const BATCH_SIZE = 500;
const PREVIEW_LIMIT = 30;
const MAX_ROWS = 100000;

const MOIS_NOMS_UPPER = [
  'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE',
];

// ============================================================
//  UTILITAIRES
// ============================================================

const getOrCreateDefaultAssureur = async () => {
  let assureur = await Assureur.findOne({ code: 'DEFAULT' });
  if (!assureur) {
    assureur = await Assureur.create({
      nom: 'Assureur par défaut',
      code: 'DEFAULT',
      pays: 'Sénégal',
      statut: 'ACTIF',
    });
  }
  return assureur;
};

const excelDateToJSDate = (serial) => {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const parsed = parseFloat(serial);
    if (!isNaN(parsed)) serial = parsed;
  }
  if (typeof serial === 'number') {
    return new Date((serial - 25569) * 86400 * 1000);
  }
  return null;
};

const toNumber = (value) => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d,.]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return excelDateToJSDate(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    const num = parseFloat(value);
    if (!isNaN(num)) return excelDateToJSDate(num);
  }
  return null;
};

const calculerAge = (dateNaissance, dateReference) => {
  if (!dateNaissance || !dateReference) return 0;
  const naissance = new Date(dateNaissance);
  const reference = new Date(dateReference);
  let age = reference.getFullYear() - naissance.getFullYear();
  const m = reference.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && reference.getDate() < naissance.getDate())) age--;
  return age;
};

const findColIndex = (headerRow, possibleNames) => {
  if (!headerRow || !Array.isArray(headerRow)) return -1;

  // Match exact
  for (const name of possibleNames) {
    const index = headerRow.findIndex(
      (cell) =>
        cell && typeof cell === 'string' && cell.trim().toLowerCase() === name.toLowerCase()
    );
    if (index !== -1) return index;
  }

  // Match partiel
  for (const name of possibleNames) {
    const index = headerRow.findIndex(
      (cell) =>
        cell &&
        typeof cell === 'string' &&
        cell.trim().toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }

  return -1;
};

const extraireNomSFD = (rows) => {
  const keywords = ['Suivi', 'IMCEC', 'PAMECAS', 'RMRC', 'ACE', 'CITIZEN', 'PASBO', 'PADME'];

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    for (const cell of row) {
      if (cell && typeof cell === 'string') {
        for (const keyword of keywords) {
          if (cell.includes(keyword)) {
            const parts = cell.split(' ');
            for (let k = 0; k < parts.length; k++) {
              const part = parts[k];
              if (
                part.includes('IMCEC') ||
                part.includes('PAMECAS') ||
                part.includes('RMRC') ||
                part.includes('ACE') ||
                part.includes('CITIZEN') ||
                part.includes('PASBO') ||
                part.includes('PADME') ||
                part.includes('ASSOCIATION')
              ) {
                let name = part;
                if (k + 1 < parts.length && !isNaN(parts[k + 1])) {
                  name += ' ' + parts[k + 1];
                  if (k + 2 < parts.length && parts[k + 2] && !isNaN(parts[k + 2])) {
                    name += ' ' + parts[k + 2];
                  }
                }
                return name;
              }
            }
          }
        }
      }
    }
  }
  return null;
};

const generateJobCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JOB-${timestamp}-${random}`;
};

// ============================================================
//  IMPORT REPORTING — VERSION OPTIMISÉE MÉMOIRE
// ============================================================

const importReporting = async (req, res) => {
  let filePath = null;
  let job = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    filePath = req.file.path;

    // ============================================================
    // 1. Job de suivi
    // ============================================================
    job = await Job.create({
      type: 'IMPORT_REPORTING',
      code: generateJobCode(),
      statut: 'PENDING',
      donnees: { fichier: req.file.originalname, taille: req.file.size },
      creePar: req.user._id,
      utilisateurId: req.user._id,
    });

    // ============================================================
    // 2. Lecture Excel (options mémoire optimisées)
    // ============================================================
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath, {
      ignoreNodes: ['dataValidations', 'extLst'],
    });

    const sheetMensuel =
      workbook.getWorksheet('Mensuel OK') ||
      workbook.getWorksheet('Mensuel ok') ||
      workbook.getWorksheet('Mensuel');
    const sheetPSB = workbook.getWorksheet('PSB');

    if (!sheetMensuel) {
      await job.echouer('Onglet "Mensuel OK" introuvable');
      await job.save();
      return res.status(400).json({
        success: false,
        message: 'L\'onglet "Mensuel OK" ou "Mensuel ok" est obligatoire',
      });
    }

    if (!sheetPSB) {
      await job.echouer('Onglet "PSB" introuvable');
      await job.save();
      return res.status(400).json({
        success: false,
        message: 'L\'onglet "PSB" est obligatoire',
      });
    }

    // ============================================================
    // 3. Garde-fou taille fichier
    // ============================================================
    const totalRows = sheetMensuel.actualRowCount || sheetMensuel.rowCount || 0;

    if (totalRows > MAX_ROWS) {
      await job.echouer(`Fichier trop volumineux (${totalRows} lignes, max ${MAX_ROWS})`);
      await job.save();
      return res.status(400).json({
        success: false,
        message: `Fichier trop volumineux : ${totalRows} lignes (maximum ${MAX_ROWS}). Contactez l'administrateur.`,
      });
    }

    // ============================================================
    // 4. Lecture paramètres PSB
    // ============================================================
    const params = {};
    sheetPSB.eachRow({ includeEmpty: false }, (row) => {
      const key = row.getCell(1).text.trim();
      const value = row.getCell(2).text;
      const numValue = parseFloat(value);
      params[key] = isNaN(numValue) ? value : numValue;
    });

    // ============================================================
    // 5. Preview : 30 premières lignes pour détection
    // ============================================================
    const previewRows = [];
    for (let i = 1; i <= Math.min(PREVIEW_LIMIT, totalRows); i++) {
      const row = sheetMensuel.getRow(i);
      if (!row || !row.hasValues) {
        previewRows.push([]);
        continue;
      }
      const rowData = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowData.push(cell.text);
      });
      previewRows.push(rowData);
    }

    // --- Détection nom SFD ---
    let sfdName = extraireNomSFD(previewRows);
    if (!sfdName) {
      sfdName = previewRows[2] && previewRows[2][5] ? previewRows[2][5].trim() : 'SFD INCONNU';
    }

    // --- SFD : trouver ou créer ---
    let sfd = await SFD.findOne({ nom: sfdName });
    if (!sfd) {
      const code = sfdName.substring(0, 8).toUpperCase().replace(/ /g, '_');
      sfd = await SFD.create({
        nom: sfdName,
        code,
        pays: 'Sénégal',
        statut: 'ACTIF',
        creePar: req.user._id,
      });
    }

    // --- Contrat : trouver ou créer ---
    let contrat = await Contrat.findOne({ sfdId: sfd._id });
    const defaultAssureur = await getOrCreateDefaultAssureur();

    if (!contrat) {
      contrat = await Contrat.create({
        nom: `Contrat ${sfd.nom}`,
        code: `CTR-${sfd.code}-001`,
        sfdId: sfd._id,
        assureurId: defaultAssureur._id,
        ageMin: params['Âge minimum'] || 18,
        ageMaxDebut: params['Âge maximum début du prêt'] || 64,
        ageMaxFin: params['Âge maximum fin du prêt'] || 65,
        dureeMin: params['Durée minimum prêt'] || 1,
        montantMin: params['Montant minimum du prêt'] || 0,
        montantMax: params['Montant maximum du prêt'] || 25000000,
        tauxPrime1: params['Taux de prime'] || 0.0065,
        tauxPrime2: params['Taux de prime 2'] || 0.0163,
        seuilPrime2: params['Montant maximum du prêt'] || 14000000,
        tauxFraisGestion: params['Taux de frais de gestion'] || 0.08,
        tauxTaxe: params['Taxe'] || 0,
        creePar: req.user._id,
      });
    }

    // ============================================================
    // 6. Détection ligne d'en-tête
    // ============================================================
    const headerKeywords = [
      'Identifiant emprunteur',
      'Identifiant',
      'ID',
      'Nom emprunteur',
      'Nom',
      'NOM',
    ];

    let headerRowIndex = -1;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      if (!row || row.length === 0) continue;

      let matchCount = 0;
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          for (const kw of headerKeywords) {
            if (cell.includes(kw)) {
              matchCount++;
              break;
            }
          }
        }
      }

      if (matchCount >= 2) {
        headerRowIndex = i + 1;
        break;
      }
    }

    if (headerRowIndex === -1) {
      await job.echouer('En-tête du fichier non trouvé');
      await job.save();
      return res.status(400).json({
        success: false,
        message: 'En-tête du fichier non trouvé',
      });
    }

    const headers = previewRows[headerRowIndex - 1] || [];

    // ============================================================
    // 7. Mapping des colonnes
    // ============================================================
    const colIndex = {
      guichet: findColIndex(headers, ['Guichet']),
      localite: findColIndex(headers, ['Localité du Guichet', 'Localité']),
      identifiant: findColIndex(headers, ['Identifiant emprunteur', 'Identifiant', 'ID', 'id']),
      nom: findColIndex(headers, ['Nom emprunteur', 'Nom', 'NOM']),
      prenom: findColIndex(headers, ['Prénom emprunteur', 'Prénom', 'PRENOM']),
      adresse: findColIndex(headers, ['Adresse']),
      dateNaissance: findColIndex(headers, ['Date de naissance', 'Date naissance']),
      profession: findColIndex(headers, ['Profession']),
      sexe: findColIndex(headers, ['Sexe']),
      dateFinPret: findColIndex(headers, ['date de fin du prêt', 'Date fin prêt']),
      moisReporting: findColIndex(headers, ['Mois du reporting', 'Mois reporting']),
      datePret: findColIndex(headers, ['Date du prêt', 'Date prêt']),
      dureePret: findColIndex(headers, [
        'durée du prêt (en nombre de mois)',
        'durée du prêt',
        'Durée prêt',
      ]),
      montantPret: findColIndex(headers, ['montant du prêt', 'Montant prêt']),
      typeCredit: findColIndex(headers, ['Type de crédit', 'Type crédit']),
      typePret: findColIndex(headers, ['Type de prêt', 'Type prêt']),
      tauxInteret: findColIndex(headers, ["Taux d'interet du prêt", "Taux d'interet"]),
      sinistre: findColIndex(headers, ['Sinistre']),
      moisPret: findColIndex(headers, ['mois du prêt', 'Mois prêt']),
    };

    if (colIndex.nom === -1) {
      await job.echouer('Colonne "Nom" non trouvée');
      await job.save();
      return res.status(400).json({
        success: false,
        message: 'Colonne "Nom" non trouvée dans le fichier',
      });
    }

    // ============================================================
    // 8. Détection période (sur le preview uniquement)
    // ============================================================
    let mois = 1;
    let annee = new Date().getFullYear();
    let dateFromReporting = false;

    for (let i = headerRowIndex; i < Math.min(headerRowIndex + 10, previewRows.length); i++) {
      const row = previewRows[i];
      if (!row) continue;

      const moisStr = row[colIndex.moisReporting]
        ? row[colIndex.moisReporting].toString().trim().toUpperCase()
        : '';

      if (moisStr) {
        for (let m = 0; m < MOIS_NOMS_UPPER.length; m++) {
          if (moisStr.includes(MOIS_NOMS_UPPER[m])) {
            mois = m + 1;
            const yearMatch = moisStr.match(/\b(20\d{2})\b/);
            if (yearMatch) annee = parseInt(yearMatch[1]);
            dateFromReporting = true;
            break;
          }
        }
        if (dateFromReporting) break;
      }
    }

    if (!dateFromReporting || annee < 2000) {
      for (let i = headerRowIndex; i < previewRows.length; i++) {
        const row = previewRows[i];
        if (!row) continue;
        const datePret = toDate(row[colIndex.datePret]);
        if (datePret) {
          mois = datePret.getMonth() + 1;
          annee = datePret.getFullYear();
          break;
        }
      }
    }

    if (!annee || annee < 2000) annee = new Date().getFullYear();

    const dateDebut = new Date(annee, mois - 1, 1);
    const dateFin = new Date(annee, mois, 0);

    // Libérer le preview
    previewRows.length = 0;

    // ============================================================
    // 9. Suppression ancien reporting si existant
    // ============================================================
    const existing = await ReportingMensuel.findOne({ sfdId: sfd._id, mois, annee });
    if (existing) {
      await Adhesion.deleteMany({ reportingMensuelId: existing._id });
      await ReportingMensuel.findByIdAndDelete(existing._id);
    }

    // ============================================================
    // 10. Création du reporting
    // ============================================================
    const reporting = await ReportingMensuel.create({
      sfdId: sfd._id,
      contratId: contrat._id,
      mois,
      annee,
      trimestre: Math.ceil(mois / 3),
      dateDebut,
      dateFin,
      fichierOriginal: {
        nom: req.file.originalname,
        chemin: filePath,
        taille: req.file.size,
        dateUpload: new Date(),
      },
      statut: STATUT_REPORTING.EN_VALIDATION,
      creePar: req.user._id,
    });

    // ============================================================
    // 11. TRAITEMENT PRINCIPAL — ligne par ligne, batch libéré
    // ============================================================
    const adhesionIds = [];
    const exclusionIds = [];
    const erreurs = [];
    let totalAdhesions = 0;
    let totalExclusions = 0;
    let batch = [];
    let lastProgressUpdate = 0;

    job.demarrer();
    await job.save();

    const startTime = Date.now();

    for (let rowNumber = headerRowIndex + 1; rowNumber <= totalRows; rowNumber++) {
      const row = sheetMensuel.getRow(rowNumber);
      if (!row || !row.hasValues) continue;

      const rowData = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowData.push(cell.text);
      });

      const hasData = rowData.some((c) => c !== undefined && c !== null && c !== '');
      if (!hasData) {
        rowData.length = 0;
        continue;
      }

      const nom = rowData[colIndex.nom] ? rowData[colIndex.nom].toString().trim() : '';
      if (!nom) {
        rowData.length = 0;
        continue;
      }

      const identifiant = rowData[colIndex.identifiant]
        ? rowData[colIndex.identifiant].toString().trim()
        : `ADH-${Date.now()}-${rowNumber}`;
      const prenom = rowData[colIndex.prenom]
        ? rowData[colIndex.prenom].toString().trim()
        : '';
      const montantPret = toNumber(rowData[colIndex.montantPret]);
      const dureePret = toNumber(rowData[colIndex.dureePret]);
      const datePret = toDate(rowData[colIndex.datePret]);
      const dateNaissance = toDate(rowData[colIndex.dateNaissance]);
      const dateFinPret = toDate(rowData[colIndex.dateFinPret]);

      const age = calculerAge(dateNaissance, datePret);

      const controleDate =
        datePret && datePret >= dateDebut && datePret <= dateFin ? 'ok' : 'no';
      const controleAge =
        age >= contrat.ageMin &&
        age <= contrat.ageMaxDebut &&
        age + dureePret / 12 <= contrat.ageMaxFin
          ? 'ok'
          : 'no';
      const controleMontant =
        montantPret >= contrat.montantMin && montantPret <= contrat.montantMax ? 'ok' : 'no';
      const controleDuree = dureePret >= contrat.dureeMin ? 'ok' : 'no';
      const controleGlobal =
        controleAge === 'ok' &&
        controleDate === 'ok' &&
        controleMontant === 'ok' &&
        controleDuree === 'ok'
          ? 'ok'
          : 'no';

      let tauxPrime = contrat.tauxPrime1;
      if (montantPret > contrat.seuilPrime2) {
        tauxPrime = contrat.tauxPrime2 || contrat.tauxPrime1;
      }
      const prime = montantPret * tauxPrime;
      const fraisGestion = prime * contrat.tauxFraisGestion;
      const taxes = prime * contrat.tauxTaxe;
      const montantDu = prime + fraisGestion + taxes;

      const sinistreValue = rowData[colIndex.sinistre]
        ? rowData[colIndex.sinistre].toString().trim()
        : '';
      const estSinistre = !!sinistreValue;

      batch.push({
        reportingMensuelId: reporting._id,
        sfdId: sfd._id,
        contratId: contrat._id,
        guichet: rowData[colIndex.guichet]
          ? rowData[colIndex.guichet].toString().trim()
          : '',
        localite: rowData[colIndex.localite]
          ? rowData[colIndex.localite].toString().trim()
          : '',
        identifiantEmprunteur: identifiant,
        nomEmprunteur: nom,
        prenomEmprunteur: prenom,
        adresse: rowData[colIndex.adresse]
          ? rowData[colIndex.adresse].toString().trim()
          : '',
        dateNaissance,
        profession: rowData[colIndex.profession]
          ? rowData[colIndex.profession].toString().trim()
          : '',
        sexe: rowData[colIndex.sexe]
          ? rowData[colIndex.sexe].toString().trim().toUpperCase()
          : '',
        dateFinPret,
        moisReporting: rowData[colIndex.moisReporting]
          ? rowData[colIndex.moisReporting].toString().trim()
          : '',
        datePret,
        dureePret,
        montantPret,
        typeCredit: rowData[colIndex.typeCredit]
          ? rowData[colIndex.typeCredit].toString().trim()
          : '',
        typePret: rowData[colIndex.typePret]
          ? rowData[colIndex.typePret].toString().trim()
          : '',
        tauxInteretPret: toNumber(rowData[colIndex.tauxInteret]),
        prime,
        fraisGestion,
        taxes,
        montantDu,
        age,
        controleAge,
        controleDate,
        controleMontant,
        controleDuree,
        controleGlobal,
        nbMale:
          rowData[colIndex.sexe] &&
          rowData[colIndex.sexe].toString().toUpperCase() === 'M'
            ? 1
            : 0,
        nbFemale:
          rowData[colIndex.sexe] &&
          rowData[colIndex.sexe].toString().toUpperCase() === 'F'
            ? 1
            : 0,
        moisPret: parseInt(rowData[colIndex.moisPret]) || 0,
        sinistre: {
          estSinistre,
          type: estSinistre ? 'DECES' : undefined,
          statut: estSinistre ? 'A_VERIFIER' : undefined,
        },
        statut: controleGlobal === 'ok' ? 'ACTIVE' : 'EXCLUE',
        estExclue: controleGlobal === 'no',
        motifExclusion:
          controleGlobal === 'no'
            ? [
                controleAge === 'no'
                  ? `Âge invalide (${age} ans, max ${contrat.ageMaxDebut})`
                  : null,
                controleDate === 'no' ? `Date de prêt invalide (hors période)` : null,
                controleMontant === 'no'
                  ? `Montant invalide (${montantPret} FCFA, max ${contrat.montantMax})`
                  : null,
                controleDuree === 'no'
                  ? `Durée invalide (${dureePret} mois, min ${contrat.dureeMin})`
                  : null,
              ]
                .filter(Boolean)
                .join('; ')
            : '',
        ligneOriginale: rowNumber,
        creePar: req.user._id,
      });

      // Libérer la ligne
      rowData.length = 0;

      // ============================================================
      // Flush du batch
      // ============================================================
      if (batch.length >= BATCH_SIZE) {
        try {
          const inserted = await Adhesion.insertMany(batch, { ordered: false });
          inserted.forEach((doc) => {
            if (doc.estExclue) {
              exclusionIds.push(doc._id);
              totalExclusions++;
            } else {
              adhesionIds.push(doc._id);
              totalAdhesions++;
            }
          });
        } catch (err) {
          erreurs.push({
            ligne: rowNumber,
            message: err.message,
            donnees: batch.length,
          });
        }

        batch.length = 0;

        // Progression throttlée
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) {
          const progression = Math.round((rowNumber / totalRows) * 100);
          job.mettreAJourProgression(progression);
          await job.save();
          lastProgressUpdate = now;
        }
      }
    }

    // Dernier lot
    if (batch.length > 0) {
      try {
        const inserted = await Adhesion.insertMany(batch, { ordered: false });
        inserted.forEach((doc) => {
          if (doc.estExclue) {
            exclusionIds.push(doc._id);
            totalExclusions++;
          } else {
            adhesionIds.push(doc._id);
            totalAdhesions++;
          }
        });
      } catch (err) {
        erreurs.push({
          ligne: 'final',
          message: err.message,
          donnees: batch.length,
        });
      }
      batch.length = 0;
    }

    // ============================================================
    // 12. Calcul des totaux
    // ============================================================
    let totalPrime = 0;
    let totalFraisGestion = 0;
    let totalTaxes = 0;
    let totalMontantDu = 0;

    // Agrégation MongoDB directement (évite de charger tous les docs en RAM)
    if (adhesionIds.length > 0) {
      const totals = await Adhesion.aggregate([
        { $match: { _id: { $in: adhesionIds } } },
        {
          $group: {
            _id: null,
            totalPrime: { $sum: '$prime' },
            totalFraisGestion: { $sum: '$fraisGestion' },
            totalTaxes: { $sum: '$taxes' },
            totalMontantDu: { $sum: '$montantDu' },
          },
        },
      ]);

      if (totals.length > 0) {
        totalPrime = totals[0].totalPrime || 0;
        totalFraisGestion = totals[0].totalFraisGestion || 0;
        totalTaxes = totals[0].totalTaxes || 0;
        totalMontantDu = totals[0].totalMontantDu || 0;
      }
    }

    reporting.adhesions = adhesionIds;
    reporting.exclusions.ids = exclusionIds;
    reporting.nombreAdhesions = totalAdhesions;
    reporting.nombreExclusions = totalExclusions;
    reporting.erreursImport = erreurs;
    reporting.totalPrime = totalPrime;
    reporting.totalFraisGestion = totalFraisGestion;
    reporting.totalTaxes = totalTaxes;
    reporting.totalMontantDu = totalMontantDu;
    reporting.commissionSFD = totalPrime * (contrat.tauxCommissionSFD || 0.07);
    reporting.commissionIG = totalPrime * (contrat.tauxCommissionIG || 0.15);
    reporting.commissionAssureur = totalPrime * (contrat.tauxCommissionAssureur || 0.05);

    if (totalExclusions > 0) {
      reporting.statut = STATUT_REPORTING.EXCLUSIONS_A_CORRIGER;
      const dateLimite = new Date();
      dateLimite.setDate(dateLimite.getDate() + 5);
      reporting.exclusions.dateLimiteCorrection = dateLimite;
    }

    await reporting.save();

    // ============================================================
    // 13. Création des sinistres (batch)
    // ============================================================
    if (adhesionIds.length > 0) {
      const sinistresAdhesions = await Adhesion.find({
        _id: { $in: adhesionIds },
        'sinistre.estSinistre': true,
      })
        .select('_id datePret montantPret')
        .lean();

      if (sinistresAdhesions.length > 0) {
        const sinistresData = sinistresAdhesions.map((adh) => ({
          adhesionId: adh._id,
          sfdId: sfd._id,
          reportingMensuelId: reporting._id,
          contratId: contrat._id,
          dateSinistre: adh.datePret || new Date(),
          typeSinistre: 'DECES',
          montantPret: adh.montantPret || 0,
          capitalRestantDu: adh.montantPret || 0,
          capitalRembourse: 0,
          montantSinistre: adh.montantPret || 0,
          montantPartSFD: adh.montantPret || 0,
          montantPartAssure: 0,
          statut: 'A_VERIFIER',
          creePar: req.user._id,
        }));

        await Sinistre.insertMany(sinistresData, { ordered: false });
      }
    }

    // ============================================================
    // 14. Suivi intermédiation
    // ============================================================
    await SuiviIntermediation.findOneAndUpdate(
      { sfdId: sfd._id, mois, annee },
      {
        sfdId: sfd._id,
        mois,
        annee,
        reportingMensuelId: reporting._id,
        dateReceptionReporting: new Date(),
      },
      { upsert: true, new: true }
    );

    // ============================================================
    // 15. Fin du job
    // ============================================================
    const dureeMs = Date.now() - startTime;

    job.terminer(
      {
        reportingId: reporting._id,
        totalAdhesions,
        totalExclusions,
        totalPrime,
        erreurs: erreurs.length,
        dureeMs,
      },
      `Import terminé : ${totalAdhesions} adhésions, ${totalExclusions} exclusions en ${(dureeMs / 1000).toFixed(1)}s`
    );
    await job.save();

    // ============================================================
    // 16. Nettoyage fichier temporaire
    // ============================================================
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        /* ignore */
      }
    }

    res.status(201).json({
      success: true,
      message: 'Reporting importé avec succès',
      data: {
        reporting,
        job,
        totalAdhesions,
        totalExclusions,
        totalPrime,
        erreurs: erreurs.length,
        dureeMs,
      },
    });
  } catch (error) {
    console.error('❌ Erreur import reporting:', error);

    // Marquer le job en échec
    if (job) {
      try {
        await job.echouer(error.message);
        await job.save();
      } catch (e) {
        /* ignore */
      }
    }

    // Nettoyer le fichier temporaire
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        /* ignore */
      }
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'import du reporting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
//  SOUMETTRE IMPORT ASYNCHRONE (QUEUE)
// ============================================================

const soumettreImportReporting = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    const job = await addImportJob({
      sfdId: req.body.sfdId || null,
      mois: req.body.mois || null,
      annee: req.body.annee || null,
      filePath: req.file.path,
      fichier: req.file.originalname,
      taille: req.file.size,
      userId: req.user._id,
      priorite: req.body.priorite || 1,
    });

    res.status(202).json({
      success: true,
      message: 'Import soumis avec succès',
      data: {
        jobId: job.id,
        status: 'PENDING',
        queueName: 'import-reporting',
      },
    });
  } catch (error) {
    console.error('❌ Erreur soumettreImportReporting:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la soumission',
    });
  }
};

// ============================================================
//  LISTE DES REPORTINGS
// ============================================================

const getReportings = async (req, res) => {
  try {
    const { sfdId, mois, annee, statut, limit = 50, page = 1 } = req.query;

    const filter = { estActif: true };
    if (sfdId) filter.sfdId = sfdId;
    if (mois) filter.mois = parseInt(mois);
    if (annee) filter.annee = parseInt(annee);
    if (statut) filter.statut = statut;

    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter.sfdId = req.user.sfdId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reportings = await ReportingMensuel.find(filter)
      .populate('sfdId', 'nom code')
      .populate('contratId', 'nom code')
      .populate('creePar', 'nom email')
      .sort({ annee: -1, mois: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ReportingMensuel.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: reportings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getReportings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des reportings',
    });
  }
};

// ============================================================
//  DÉTAILS D'UN REPORTING
// ============================================================

const getReportingById = async (req, res) => {
  try {
    const reporting = await ReportingMensuel.findById(req.params.id)
      .populate('sfdId', 'nom code contact')
      .populate('contratId', 'nom code')
      .populate('creePar', 'nom email')
      .populate('cloturePar', 'nom email');

    if (!reporting) {
      return res.status(404).json({ success: false, message: 'Reporting non trouvé' });
    }

    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      reporting.sfdId?._id?.toString() !== req.user.sfdId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    res.status(200).json({ success: true, data: reporting });
  } catch (error) {
    console.error('❌ Erreur getReportingById:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
//  ADHÉSIONS D'UN REPORTING
// ============================================================

const getAdhesionsByReporting = async (req, res) => {
  try {
    const { id } = req.params;
    const { exclude, search, limit = 100, page = 1 } = req.query;

    const reporting = await ReportingMensuel.findById(id);
    if (!reporting) {
      return res.status(404).json({ success: false, message: 'Reporting non trouvé' });
    }

    const filter = { reportingMensuelId: id };
    if (exclude === 'true') filter.estExclue = true;
    if (exclude === 'false') filter.estExclue = false;

    if (search) {
      filter.$or = [
        { nomEmprunteur: { $regex: search, $options: 'i' } },
        { prenomEmprunteur: { $regex: search, $options: 'i' } },
        { identifiantEmprunteur: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const adhesions = await Adhesion.find(filter)
      .sort({ nomEmprunteur: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Adhesion.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: adhesions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getAdhesionsByReporting:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
//  RE-IMPORT D'UN FICHIER CORRIGÉ
// ============================================================

const reImporterReporting = async (req, res) => {
  try {
    const { id } = req.params;

    const reporting = await ReportingMensuel.findById(id);
    if (!reporting) {
      return res.status(404).json({ success: false, message: 'Reporting non trouvé' });
    }

    if (reporting.statut !== 'EXCLUSIONS_A_CORRIGER') {
      return res.status(400).json({
        success: false,
        message: 'Ce reporting n\'est pas en attente de correction',
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    reporting.statut = 'CORRIGE';
    reporting.exclusions.fichierCorrection = {
      nom: req.file.originalname,
      chemin: req.file.path,
      taille: req.file.size,
      dateUpload: new Date(),
    };
    reporting.exclusions.dateReceptionCorrection = new Date();
    reporting.modifiePar = req.user._id;
    await reporting.save();

    res.status(200).json({
      success: true,
      message: 'Fichier de correction reçu avec succès',
      data: reporting,
    });
  } catch (error) {
    console.error('❌ Erreur reImporterReporting:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ============================================================
//  CLÔTURER UN REPORTING
// ============================================================

const cloturerReporting = async (req, res) => {
  try {
    const { id } = req.params;

    const reporting = await ReportingMensuel.findById(id)
      .populate('sfdId')
      .populate('contratId');

    if (!reporting) {
      return res.status(404).json({ success: false, message: 'Reporting non trouvé' });
    }

    if (reporting.statut === 'CLOTURE') {
      return res.status(400).json({ success: false, message: 'Déjà clôturé' });
    }

    if (reporting.nombreExclusions > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de clôturer : ${reporting.nombreExclusions} exclusions en attente`,
      });
    }

    reporting.statut = STATUT_REPORTING.CLOTURE;
    reporting.dateCloture = new Date();
    reporting.cloturePar = req.user._id;
    reporting.modifiePar = req.user._id;
    await reporting.save();

    let documents = null;
    try {
      documents = await genererDocumentsCloture(
        reporting,
        reporting.sfdId,
        reporting.contratId,
        req.user
      );

      reporting.documents = {
        appelCotisation: documents.appelCotisation,
        appelReglementSinistres: documents.appelReglementSinistres,
        rapportSinistres: documents.rapportSinistres,
      };
      reporting.fichierCloture = documents.fichierCloture;
      await reporting.save();
    } catch (docError) {
      console.error('⚠️ Erreur génération documents:', docError.message);
    }

    await SuiviIntermediation.findOneAndUpdate(
      { sfdId: reporting.sfdId._id, mois: reporting.mois, annee: reporting.annee },
      {
        dateClotureReporting: new Date(),
        dateEnvoiDocuments: new Date(),
        statut: 'EN_COURS',
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Reporting clôturé avec succès',
      data: {
        reporting,
        documents,
      },
    });
  } catch (error) {
    console.error('❌ Erreur cloturerReporting:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la clôture',
    });
  }
};

// ============================================================
//  TÉLÉCHARGER UN DOCUMENT GÉNÉRÉ
// ============================================================

const telechargerDocument = async (req, res) => {
  try {
    const { id, type } = req.params;

    const reporting = await ReportingMensuel.findById(id);
    if (!reporting) {
      return res.status(404).json({ success: false, message: 'Reporting non trouvé' });
    }

    let doc = null;
    let nomFichier = 'document';

    switch (type) {
      case 'appel-cotisation':
        doc = reporting.documents?.appelCotisation;
        nomFichier = `AppelCotisation_${reporting.mois}_${reporting.annee}.pdf`;
        break;
      case 'appel-reglement':
        doc = reporting.documents?.appelReglementSinistres;
        nomFichier = `AppelReglement_${reporting.mois}_${reporting.annee}.pdf`;
        break;
      case 'rapport-sinistres':
        doc = reporting.documents?.rapportSinistres;
        nomFichier = `RapportSinistres_${reporting.mois}_${reporting.annee}.pdf`;
        break;
      case 'cloture':
        doc = reporting.fichierCloture;
        nomFichier = `Cloture_${reporting.mois}_${reporting.annee}.xlsx`;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Type de document invalide' });
    }

    if (!doc || !doc.chemin || !fs.existsSync(doc.chemin)) {
      return res.status(404).json({
        success: false,
        message: 'Document non disponible. Clôturez le reporting pour le générer.',
      });
    }

    res.download(doc.chemin, nomFichier);
  } catch (error) {
    console.error('❌ Erreur telechargerDocument:', error);
    res.status(500).json({ success: false, message: 'Erreur téléchargement' });
  }
};

// ============================================================
//  EXPORT
// ============================================================

module.exports = {
  importReporting,
  soumettreImportReporting,
  getReportings,
  getReportingById,
  getAdhesionsByReporting,
  reImporterReporting,
  cloturerReporting,
  telechargerDocument,
};