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
const ImportJob = require('../models/ImportJob');
const fileHashService = require('../services/fileHashService');
const importStatsService = require('../services/importStatsService');
const periodDetector = require('../services/periodDetector');
const idempotencyService = require('../services/idempotencyService');
const ruleEngine = require('../services/ruleEngine');
const { addImportJob } = require('../services/queueService');
const { genererDocumentsCloture } = require('../services/documentsMensuelsService');
const {
  ADHESION_LIGHT_PROJECTION,
  IMPORT_JOB_LIGHT_PROJECTION,
  IMPORT_JOB_DETAIL_PROJECTION,  // 🔹 Phase 5.7
  REPORTING_LIGHT_PROJECTION,
  getProjection,
} = require('../constants/projections');

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

const generateUniqueSFDCode = async (nom) => {
  let base = nom
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 8);

  if (base.length < 3) base = 'SFD';

  let code = base;
  let counter = 1;

  while (await SFD.exists({ code })) {
    counter++;
    const suffix = String(counter);
    const maxBaseLen = Math.max(3, 10 - suffix.length - 1);
    code = `${base.substring(0, maxBaseLen)}_${suffix}`;

    if (counter > 999) {
      code = `SFD_${Date.now().toString(36).toUpperCase()}`;
      break;
    }
  }

  return code;
};

const getOrCreateSFD = async (nom, userId) => {
  let sfd = await SFD.findOne({ nom });
  if (sfd) return sfd;

  const code = await generateUniqueSFDCode(nom);

  try {
    sfd = await SFD.create({
      nom,
      code,
      pays: 'Sénégal',
      statut: 'ACTIF',
      creePar: userId,
    });
    return sfd;
  } catch (err) {
    if (err.code === 11000) {
      sfd = await SFD.findOne({ nom });
      if (sfd) return sfd;

      const fallbackCode = `SFD_${Date.now().toString(36).toUpperCase()}`;
      sfd = await SFD.create({
        nom,
        code: fallbackCode,
        pays: 'Sénégal',
        statut: 'ACTIF',
        creePar: userId,
      });
      return sfd;
    }
    throw err;
  }
};

const getOrCreateContrat = async (sfd, params, defaultAssureur, userId) => {
  let contrat = await Contrat.findOne({ sfdId: sfd._id });
  if (contrat) return contrat;

  let code = `CTR-${sfd.code}-001`;
  let counter = 1;
  while (await Contrat.exists({ code })) {
    counter++;
    code = `CTR-${sfd.code}-${String(counter).padStart(3, '0')}`;
    if (counter > 999) {
      code = `CTR-${sfd.code}-${Date.now().toString(36).toUpperCase()}`;
      break;
    }
  }

  try {
    contrat = await Contrat.create({
      nom: `Contrat ${sfd.nom}`,
      code,
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
      creePar: userId,
    });
    return contrat;
  } catch (err) {
    if (err.code === 11000) {
      contrat = await Contrat.findOne({ sfdId: sfd._id });
      if (contrat) return contrat;
    }
    throw err;
  }
};

const importsInProgress = new Set();

// ============================================================
//  HELPERS DE CONVERSION
// ============================================================

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

  for (const name of possibleNames) {
    const index = headerRow.findIndex(
      (cell) =>
        cell &&
        typeof cell === 'string' &&
        cell.trim().toLowerCase() === name.toLowerCase()
    );
    if (index !== -1) return index;
  }

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
  const keywords = [
    'Suivi', 'IMCEC', 'PAMECAS', 'RMRC', 'ACE', 'CITIZEN', 'PASBO', 'PADME',
  ];

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
                  if (
                    k + 2 < parts.length &&
                    parts[k + 2] &&
                    !isNaN(parts[k + 2])
                  ) {
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
//  IMPORT REPORTING
// ============================================================

const importReporting = async (req, res) => {
  let filePath = null;
  let job = null;
  let importJob = null;
  const userId = req.user._id.toString();

  const forceReplace =
    req.body.forceReplace === true || req.body.forceReplace === 'true';
  const replacementReason = req.body.replacementReason || null;

  if (importsInProgress.has(userId)) {
    return res.status(423).json({
      success: false,
      error: 'IMPORT_IN_PROGRESS',
      message:
        'Un import est déjà en cours pour votre compte. Veuillez attendre qu\'il se termine avant d\'en lancer un nouveau.',
    });
  }

  importsInProgress.add(userId);

  try {
    if (!req.file) {
      importsInProgress.delete(userId);
      return res
        .status(400)
        .json({ success: false, message: 'Aucun fichier fourni' });
    }

    filePath = req.file.path;

    const fileHash = await fileHashService.computeFileHash(filePath);

    if (!fileHash) {
      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(422).json({
        success: false,
        error: 'FILE_HASH_UNAVAILABLE',
        message:
          'Impossible de calculer l\'empreinte du fichier. Vérifiez que le fichier est lisible et non corrompu.',
      });
    }

    job = await Job.create({
      type: 'IMPORT_REPORTING',
      code: generateJobCode(),
      statut: 'PENDING',
      donnees: { fichier: req.file.originalname, taille: req.file.size },
      creePar: req.user._id,
      utilisateurId: req.user._id,
    });

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
      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        message: 'L\'onglet "Mensuel OK" ou "Mensuel ok" est obligatoire',
      });
    }

    if (!sheetPSB) {
      await job.echouer('Onglet "PSB" introuvable');
      await job.save();
      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        message: 'L\'onglet "PSB" est obligatoire',
      });
    }

    const totalRows =
      sheetMensuel.actualRowCount || sheetMensuel.rowCount || 0;

    if (totalRows > MAX_ROWS) {
      await job.echouer(
        `Fichier trop volumineux (${totalRows} lignes, max ${MAX_ROWS})`
      );
      await job.save();
      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        message: `Fichier trop volumineux : ${totalRows} lignes (maximum ${MAX_ROWS}).`,
      });
    }

    const params = {};
    sheetPSB.eachRow({ includeEmpty: false }, (row) => {
      const key = row.getCell(1).text.trim();
      const value = row.getCell(2).text;
      const numValue = parseFloat(value);
      params[key] = isNaN(numValue) ? value : numValue;
    });

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

    let sfdName = extraireNomSFD(previewRows);
    if (!sfdName) {
      sfdName =
        previewRows[2] && previewRows[2][5]
          ? previewRows[2][5].trim()
          : 'SFD INCONNU';
    }

    const sfd = await getOrCreateSFD(sfdName, req.user._id);
    const defaultAssureur = await getOrCreateDefaultAssureur();
    const contrat = await getOrCreateContrat(
      sfd,
      params,
      defaultAssureur,
      req.user._id
    );

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
      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        message: 'En-tête du fichier non trouvé',
      });
    }

    const headers = previewRows[headerRowIndex - 1] || [];

    const colIndex = {
      guichet: findColIndex(headers, ['Guichet']),
      localite: findColIndex(headers, ['Localité du Guichet', 'Localité']),
      identifiant: findColIndex(headers, [
        'Identifiant emprunteur',
        'Identifiant',
        'ID',
        'id',
      ]),
      nom: findColIndex(headers, ['Nom emprunteur', 'Nom', 'NOM']),
      prenom: findColIndex(headers, [
        'Prénom emprunteur',
        'Prénom',
        'PRENOM',
      ]),
      adresse: findColIndex(headers, ['Adresse']),
      dateNaissance: findColIndex(headers, [
        'Date de naissance',
        'Date naissance',
      ]),
      profession: findColIndex(headers, ['Profession']),
      sexe: findColIndex(headers, ['Sexe']),
      dateFinPret: findColIndex(headers, [
        'date de fin du prêt',
        'Date fin prêt',
      ]),
      moisReporting: findColIndex(headers, [
        'Mois du reporting',
        'Mois reporting',
      ]),
      datePret: findColIndex(headers, ['Date du prêt', 'Date prêt']),
      dureePret: findColIndex(headers, [
        'durée du prêt (en nombre de mois)',
        'durée du prêt',
        'Durée prêt',
      ]),
      montantPret: findColIndex(headers, ['montant du prêt', 'Montant prêt']),
      typeCredit: findColIndex(headers, ['Type de crédit', 'Type crédit']),
      typePret: findColIndex(headers, ['Type de prêt', 'Type prêt']),
      tauxInteret: findColIndex(headers, [
        "Taux d'interet du prêt",
        "Taux d'interet",
      ]),
      sinistre: findColIndex(headers, ['Sinistre']),
      moisPret: findColIndex(headers, ['mois du prêt', 'Mois prêt']),
    };

    if (colIndex.nom === -1) {
      await job.echouer('Colonne "Nom" non trouvée');
      await job.save();
      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        message: 'Colonne "Nom" non trouvée dans le fichier',
      });
    }

    const periodResult = periodDetector.detectPeriod({
      fileName: req.file.originalname,
      previewRows,
      headerRowIndex,
      colIndex: {
        moisReporting: colIndex.moisReporting,
        datePret: colIndex.datePret,
      },
      userProvided: null,
    });

    if (
      !periodResult.isReliable ||
      periodResult.mois == null ||
      periodResult.annee == null
    ) {
      await job.echouer('Période de reporting non détectable');
      await job.save();

      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }

      return res.status(400).json({
        success: false,
        message:
          'Période du reporting non détectable. Vérifiez que le nom du fichier contient le mois et l\'année.',
        data: {
          detectedPeriod: {
            source: periodResult.source,
            confidence: periodResult.confidence,
            candidates: periodResult.candidates,
            warnings: periodResult.warnings,
          },
        },
      });
    }

    const mois = periodResult.mois;
    const annee = periodResult.annee;

    const analysis = await idempotencyService.analyzeImport({
      fileHash,
      institutionId: sfd._id,
      month: mois,
      year: annee,
      forceReplace,
    });

    if (analysis.action === 'BLOCK') {
      await job.echouer(`Import bloqué : ${analysis.errorCode}`);
      await job.save();

      importsInProgress.delete(userId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }

      const existingJob = analysis.existingJob || analysis.conflictingJob;
      const errorResponse = idempotencyService.buildErrorResponse(
        analysis.errorCode,
        existingJob,
        analysis.reason
      );

      return res.status(errorResponse.statusCode).json(errorResponse.body);
    }

    const versionNumber = analysis.versionNumber;

    const dateDebut = new Date(annee, mois - 1, 1);
    const dateFin = new Date(annee, mois, 0);

    previewRows.length = 0;

    importJob = await ImportJob.create({
      fileHash,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      institutionId: sfd._id,
      contratId: contrat._id,
      status: 'RUNNING',
      lifecycle: 'ACTIVE',
      startedAt: new Date(),
      detectedPeriod: {
        month: mois,
        year: annee,
        source: periodResult.source,
        confidence: periodResult.confidence,
        isReliable: periodResult.isReliable,
        isAmbiguous: periodResult.isAmbiguous,
        candidates: periodResult.candidates.map((c) => ({
          month: c.mois,
          year: c.annee,
          source: c.source,
          confidence: c.confidence,
        })),
        warnings: periodResult.warnings,
      },
      counters: importStatsService.createCounters(),
      notInstrumentedYet: importStatsService.getNotInstrumentedCounters(),
      ignoredLines: [],
      versionNumber,
      forceReplaceRequested: forceReplace,
      replacementReason: replacementReason || null,
    });

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
      importJobId: importJob._id,
      lifecycle: 'ACTIVE',
      versionNumber,
    });

    importJob.reportingMensuelId = reporting._id;
    await importJob.save();

    if (analysis.action === 'CREATE_WITH_REPLACE') {
      const oldJob = analysis.existingJob || analysis.conflictingJob;

      if (oldJob && oldJob._id) {
        await idempotencyService.linkImportJobs(importJob._id, oldJob._id);

        if (oldJob.reportingMensuelId) {
          await idempotencyService.linkReportings(
            reporting._id,
            oldJob.reportingMensuelId
          );

          await idempotencyService.markAdhesionsAsSuperseded(
            oldJob.reportingMensuelId
          );
        }
      }
    }

    importJob.sourceRowsRange = {
      startRow: headerRowIndex + 1,
      endRow: totalRows,
      sheetUsed: sheetMensuel.name,
    };
    await importJob.save();

    const adhesionIds = [];
    const exclusionIds = [];
    const erreurs = [];
    let totalAdhesions = 0;
    let totalExclusions = 0;
    let batch = [];
    let lastProgressUpdate = 0;

    const counters = importJob.counters;

    job.demarrer();
    await job.save();

    const startTime = Date.now();

    for (
      let rowNumber = headerRowIndex + 1;
      rowNumber <= totalRows;
      rowNumber++
    ) {
      importStatsService.incrementCounter(counters, 'sourceRows');

      const row = sheetMensuel.getRow(rowNumber);

      if (!row || !row.hasValues) {
        importStatsService.incrementCounter(counters, 'ignoredRows');
        importJob.addIgnoredLine(
          rowNumber,
          sheetMensuel.name,
          'NO_VALUES',
          null
        );
        continue;
      }

      const rowData = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowData.push(cell.text);
      });

      const hasData = rowData.some(
        (c) => c !== undefined && c !== null && String(c).trim() !== ''
      );

      if (!hasData) {
        importStatsService.incrementCounter(counters, 'ignoredRows');
        const rawSnapshot = {};
        rowData.forEach((v, i) => {
          rawSnapshot[`col_${i}`] = v;
        });
        importJob.addIgnoredLine(
          rowNumber,
          sheetMensuel.name,
          'EMPTY_ROW',
          rawSnapshot
        );
        rowData.length = 0;
        continue;
      }

      const nom = rowData[colIndex.nom]
        ? rowData[colIndex.nom].toString().trim()
        : '';

      if (!nom) {
        importStatsService.incrementCounter(counters, 'ignoredRows');
        const rawSnapshot = {};
        rowData.forEach((v, i) => {
          rawSnapshot[`col_${i}`] = v;
        });
        importJob.addIgnoredLine(
          rowNumber,
          sheetMensuel.name,
          'MISSING_NAME',
          rawSnapshot
        );
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

      const ruleResults = ruleEngine.evaluateAll({
        datePret,
        dateDebut,
        dateFin,
        age,
        dureePret,
        montantPret,
        contrat,
      });

      const {
        controleDate,
        controleAge,
        controleMontant,
        controleDuree,
        controleGlobal,
        validationResults,
        exclusionReasons,
      } = ruleResults;

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

      const rawData = {};
      rowData.forEach((v, i) => {
        rawData[`col_${i}`] = v;
      });

      const normalizedData = {
        nom,
        prenom,
        identifiant,
        montantPret,
        dureePret,
        age,
        datePret: datePret ? datePret.toISOString() : null,
        dateNaissance: dateNaissance ? dateNaissance.toISOString() : null,
        dateFinPret: dateFinPret ? dateFinPret.toISOString() : null,
        sexe: rowData[colIndex.sexe]
          ? rowData[colIndex.sexe].toString().trim().toUpperCase()
          : '',
      };

      const motifExclusion =
        controleGlobal === 'no'
          ? [
              controleAge === 'no'
                ? `Âge invalide (${age} ans, max ${contrat.ageMaxDebut})`
                : null,
              controleDate === 'no'
                ? `Date de prêt invalide (hors période)`
                : null,
              controleMontant === 'no'
                ? `Montant invalide (${montantPret} FCFA, max ${contrat.montantMax})`
                : null,
              controleDuree === 'no'
                ? `Durée invalide (${dureePret} mois, min ${contrat.dureeMin})`
                : null,
            ]
              .filter(Boolean)
              .join('; ')
          : '';

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
        motifExclusion,
        ligneOriginale: rowNumber,
        creePar: req.user._id,

        importJobId: importJob._id,
        sheetName: sheetMensuel.name,
        sourceRowNumber: rowNumber,
        rawData,
        normalizedData,
        validationResults,
        exclusionReasons,
        status: controleGlobal === 'ok' ? 'VALID' : 'EXCLUDED',

        reportingLifecycle: 'ACTIVE',
      });

      rowData.length = 0;

      if (batch.length >= BATCH_SIZE) {
        try {
          const inserted = await Adhesion.insertMany(batch, {
            ordered: false,
          });
          inserted.forEach((doc) => {
            if (doc.estExclue) {
              exclusionIds.push(doc._id);
              totalExclusions++;
              importStatsService.incrementCounter(counters, 'excludedRows');
            } else {
              adhesionIds.push(doc._id);
              totalAdhesions++;
              importStatsService.incrementCounter(counters, 'validRows');
            }
          });
        } catch (err) {
          const analysis2 = importStatsService.analyzeInsertManyError(
            err,
            batch.length
          );

          if (analysis2.isExact) {
            const insertedDocs = Array.isArray(err.insertedDocs)
              ? err.insertedDocs
              : [];
            insertedDocs.forEach((doc) => {
              if (doc.estExclue) {
                exclusionIds.push(doc._id);
                totalExclusions++;
                importStatsService.incrementCounter(
                  counters,
                  'excludedRows'
                );
              } else {
                adhesionIds.push(doc._id);
                totalAdhesions++;
                importStatsService.incrementCounter(counters, 'validRows');
              }
            });

            importStatsService.incrementCounter(
              counters,
              'errorRows',
              analysis2.errorCount
            );

            erreurs.push({
              ligne: rowNumber,
              message: err.message,
              donnees: batch.length,
              insertedCount: analysis2.insertedCount,
              errorCount: analysis2.errorCount,
              isExact: true,
              method: analysis2.details.method,
            });
          } else {
            importStatsService.incrementCounter(
              counters,
              'errorRows',
              batch.length
            );

            importJob.addAnomaly(
              'INSERT_MANY_OPAQUE',
              `Impossible de distinguer les insertions réussies des échecs sur le batch finissant à la ligne ${rowNumber}.`,
              'WARNING',
              rowNumber
            );

            erreurs.push({
              ligne: rowNumber,
              message: err.message,
              donnees: batch.length,
              insertedCount: 0,
              errorCount: batch.length,
              isExact: false,
              method: 'fallback',
            });
          }
        }

        batch.length = 0;

        const now = Date.now();
        if (now - lastProgressUpdate > 1000) {
          const progression = Math.round((rowNumber / totalRows) * 100);
          job.mettreAJourProgression(progression);
          await job.save();
          lastProgressUpdate = now;
        }
      }
    }

    if (batch.length > 0) {
      try {
        const inserted = await Adhesion.insertMany(batch, { ordered: false });
        inserted.forEach((doc) => {
          if (doc.estExclue) {
            exclusionIds.push(doc._id);
            totalExclusions++;
            importStatsService.incrementCounter(counters, 'excludedRows');
          } else {
            adhesionIds.push(doc._id);
            totalAdhesions++;
            importStatsService.incrementCounter(counters, 'validRows');
          }
        });
      } catch (err) {
        const analysis2 = importStatsService.analyzeInsertManyError(
          err,
          batch.length
        );

        if (analysis2.isExact) {
          const insertedDocs = Array.isArray(err.insertedDocs)
            ? err.insertedDocs
            : [];
          insertedDocs.forEach((doc) => {
            if (doc.estExclue) {
              exclusionIds.push(doc._id);
              totalExclusions++;
              importStatsService.incrementCounter(counters, 'excludedRows');
            } else {
              adhesionIds.push(doc._id);
              totalAdhesions++;
              importStatsService.incrementCounter(counters, 'validRows');
            }
          });

          importStatsService.incrementCounter(
            counters,
            'errorRows',
            analysis2.errorCount
          );

          erreurs.push({
            ligne: 'final',
            message: err.message,
            donnees: batch.length,
            insertedCount: analysis2.insertedCount,
            errorCount: analysis2.errorCount,
            isExact: true,
            method: analysis2.details.method,
          });
        } else {
          importStatsService.incrementCounter(
            counters,
            'errorRows',
            batch.length
          );

          importJob.addAnomaly(
            'INSERT_MANY_OPAQUE',
            `Impossible de distinguer les insertions réussies des échecs sur le batch final.`,
            'WARNING',
            null
          );

          erreurs.push({
            ligne: 'final',
            message: err.message,
            donnees: batch.length,
            insertedCount: 0,
            errorCount: batch.length,
            isExact: false,
            method: 'fallback',
          });
        }
      }
      batch.length = 0;
    }

    counters.processedRows =
      counters.validRows + counters.excludedRows + counters.errorRows;

    let totalPrime = 0;
    let totalFraisGestion = 0;
    let totalTaxes = 0;
    let totalMontantDu = 0;

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
    reporting.commissionAssureur =
      totalPrime * (contrat.tauxCommissionAssureur || 0.05);

    if (totalExclusions > 0) {
      reporting.statut = STATUT_REPORTING.EXCLUSIONS_A_CORRIGER;
      const dateLimite = new Date();
      dateLimite.setDate(dateLimite.getDate() + 5);
      reporting.exclusions.dateLimiteCorrection = dateLimite;
    }

    const coherence = importStatsService.assertCoherence(counters);

    if (!coherence.coherent) {
      importJob.addAnomaly('TOTAL_MISMATCH', coherence.message, 'ERROR', null);
    }

    reporting.sourceTotals = counters;
    await reporting.save();

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

    await SuiviIntermediation.findOneAndUpdate(
      { sfdId: sfd._id, mois, annee },
      {
        sfdId: sfd._id,
        mois,
        annee,
        reportingMensuelId: reporting._id,
        dateReceptionReporting: new Date(),
      },
      { upsert: true, returnDocument: 'after' }
    );

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
      `Import terminé : ${totalAdhesions} adhésions, ${totalExclusions} exclusions en ${(
        dureeMs / 1000
      ).toFixed(1)}s`
    );
    await job.save();

    importJob.counters = counters;
    importJob.markCompleted();
    await importJob.save();

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        /* ignore */
      }
    }

    importsInProgress.delete(userId);

    await reporting.populate('sfdId', 'nom code');

    res.status(201).json({
      success: true,
      message:
        analysis.action === 'CREATE_WITH_REPLACE'
          ? `Reporting remplacé avec succès (version ${versionNumber})`
          : 'Reporting importé avec succès',
      data: {
        reporting,
        job,
        importJob: {
          _id: importJob._id,
          versionNumber: importJob.versionNumber,
          lifecycle: importJob.lifecycle,
          supersedes: importJob.supersedes,
          supersededBy: importJob.supersededBy,
        },
        institution: {
          _id: sfd._id,
          nom: sfd.nom,
          code: sfd.code,
        },
        totalAdhesions,
        totalExclusions,
        totalPrime,
        erreurs: erreurs.length,
        dureeMs,
        action: analysis.action,
      },
    });
  } catch (error) {
    importsInProgress.delete(userId);

    console.error('❌ Erreur import reporting:', error);

    if (error.code === 11000) {
      if (job) {
        try {
          await job.echouer('Doublon détecté (race condition)');
          await job.save();
        } catch (e) {}
      }
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
      }
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_FILE',
        message:
          'Un import identique est déjà en cours ou a été créé simultanément. Veuillez réessayer.',
      });
    }

    if (job) {
      try {
        await job.echouer(error.message);
        await job.save();
      } catch (e) {}
    }

    if (importJob) {
      try {
        importJob.addAnomaly('IMPORT_FAILED', error.message, 'ERROR', null);
        importJob.markFailed(error.message);
        await importJob.save();
      } catch (e) {}
    }

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'import du reporting',
      error:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
//  SOUMETTRE IMPORT ASYNCHRONE
// ============================================================

const soumettreImportReporting = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'Aucun fichier fourni' });
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
    const {
      sfdId,
      mois,
      annee,
      statut,
      limit = 50,
      page = 1,
      includeSuperseded = 'false',
      includeDetails = 'false',
    } = req.query;

    const filter = { estActif: true };

    if (includeSuperseded !== 'true') {
      filter.lifecycle = 'ACTIVE';
    }

    if (sfdId) filter.sfdId = sfdId;
    if (mois) filter.mois = parseInt(mois);
    if (annee) filter.annee = parseInt(annee);
    if (statut) filter.statut = statut;

    if (req.user.role === 'SFD' && req.user.sfdId) {
      filter.sfdId = req.user.sfdId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const projection = getProjection(
      includeDetails,
      REPORTING_LIGHT_PROJECTION
    );

    const reportings = await ReportingMensuel.find(filter, projection)
      .populate('sfdId', 'nom code')
      .populate('contratId', 'nom code')
      .populate('creePar', 'nom email')
      .sort({ annee: -1, mois: -1, versionNumber: -1 })
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
      return res
        .status(404)
        .json({ success: false, message: 'Reporting non trouvé' });
    }

    if (
      req.user.role === 'SFD' &&
      req.user.sfdId &&
      reporting.sfdId?._id?.toString() !== req.user.sfdId.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: 'Accès refusé.' });
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
    const {
      exclude,
      search,
      limit = 100,
      page = 1,
      includeDetails = 'false',
    } = req.query;

    const reporting = await ReportingMensuel.findById(id);
    if (!reporting) {
      return res
        .status(404)
        .json({ success: false, message: 'Reporting non trouvé' });
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

    const projection = getProjection(
      includeDetails,
      ADHESION_LIGHT_PROJECTION
    );

    const adhesions = await Adhesion.find(filter, projection)
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
//  RE-IMPORT FICHIER CORRIGÉ
// ============================================================

const reImporterReporting = async (req, res) => {
  try {
    const { id } = req.params;

    const reporting = await ReportingMensuel.findById(id);
    if (!reporting) {
      return res
        .status(404)
        .json({ success: false, message: 'Reporting non trouvé' });
    }

    if (reporting.statut !== 'EXCLUSIONS_A_CORRIGER') {
      return res.status(400).json({
        success: false,
        message: 'Ce reporting n\'est pas en attente de correction',
      });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'Aucun fichier fourni' });
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
      return res
        .status(404)
        .json({ success: false, message: 'Reporting non trouvé' });
    }

    if (reporting.statut === 'CLOTURE') {
      return res
        .status(400)
        .json({ success: false, message: 'Déjà clôturé' });
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
      {
        sfdId: reporting.sfdId._id,
        mois: reporting.mois,
        annee: reporting.annee,
      },
      {
        dateClotureReporting: new Date(),
        dateEnvoiDocuments: new Date(),
        statut: 'EN_COURS',
      },
      { upsert: true, returnDocument: 'after' }
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
//  TÉLÉCHARGER UN DOCUMENT
// ============================================================

const telechargerDocument = async (req, res) => {
  try {
    const { id, type } = req.params;

    const reporting = await ReportingMensuel.findById(id);
    if (!reporting) {
      return res
        .status(404)
        .json({ success: false, message: 'Reporting non trouvé' });
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
        return res
          .status(400)
          .json({ success: false, message: 'Type de document invalide' });
    }

    if (!doc || !doc.chemin || !fs.existsSync(doc.chemin)) {
      return res.status(404).json({
        success: false,
        message:
          'Document non disponible. Clôturez le reporting pour le générer.',
      });
    }

    res.download(doc.chemin, nomFichier);
  } catch (error) {
    console.error('❌ Erreur telechargerDocument:', error);
    res.status(500).json({ success: false, message: 'Erreur téléchargement' });
  }
};

// ============================================================
//  🔹 PHASE 5.7 — RÉCUPÉRER UN IMPORTJOB
// ============================================================

/**
 * @route   GET /api/reporting/jobs/:id
 * @desc    Récupérer un ImportJob
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 *
 * ⚠️ Phase 5.7 : `ignoredLines` est EXCLU par défaut
 *    pour réduire la taille de la réponse (586 Ko → ~86 Ko).
 *
 *    Utiliser `?includeIgnored=true` pour le récupérer.
 *    Ou la route dédiée `GET /jobs/:id/ignored-lines` (paginée).
 */
const getImportJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeIgnored = 'false' } = req.query;

    // 🔹 Phase 5.7 — Projection : exclure ignoredLines par défaut
    const projection = getProjection(
      includeIgnored,
      IMPORT_JOB_DETAIL_PROJECTION
    );

    const importJob = await ImportJob.findById(id, projection)
      .populate('institutionId', 'nom code')
      .populate('contratId', 'nom code')
      .populate('uploadedBy', 'nom email')
      .populate(
        'reportingMensuelId',
        'mois annee statut lifecycle versionNumber'
      )
      .populate('supersedes', 'fileName versionNumber createdAt')
      .populate('supersededBy', 'fileName versionNumber createdAt');

    if (!importJob) {
      return res.status(404).json({
        success: false,
        message: 'ImportJob non trouvé',
      });
    }

    // 🔹 Phase 5.7 — Métadonnées sur ignoredLines
    // (sans les charger si non demandé)
    const response = importJob.toObject();

    if (!response.ignoredLines) {
      // Charger uniquement le count et les stats par raison
      const stats = await ImportJob.aggregate([
        { $match: { _id: importJob._id } },
        {
          $project: {
            total: { $size: '$ignoredLines' },
            byReason: {
              $arrayToObject: {
                $map: {
                  input: { $setUnion: ['$ignoredLines.reason', []] },
                  as: 'reason',
                  in: {
                    k: '$$reason',
                    v: {
                      $size: {
                        $filter: {
                          input: '$ignoredLines',
                          as: 'line',
                          cond: { $eq: ['$$line.reason', '$$reason'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ]);

      const ignoredStats = stats[0] || { total: 0, byReason: {} };

      response.ignoredLinesMeta = {
        total: ignoredStats.total || 0,
        byReason: ignoredStats.byReason || {},
        endpoint: `/api/reporting/jobs/${importJob._id}/ignored-lines`,
      };
    } else {
      response.ignoredLinesMeta = {
        total: response.ignoredLines.length,
        byReason: response.ignoredLines.reduce((acc, line) => {
          acc[line.reason] = (acc[line.reason] || 0) + 1;
          return acc;
        }, {}),
      };
    }

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('❌ Erreur getImportJobById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement de l\'ImportJob',
    });
  }
};

// ============================================================
//  🔹 PHASE 5.7 — LIGNES IGNORÉES PAGINÉES
// ============================================================

/**
 * @route   GET /api/reporting/jobs/:id/ignored-lines
 * @desc    Récupérer les lignes ignorées d'un ImportJob (paginé)
 * @access  Private (GESTIONNAIRE_IG, ADMIN)
 *
 * Query params :
 *   - page  : numéro de page (défaut 1)
 *   - limit : nombre par page (défaut 50, max 500)
 *   - reason: filtrer par raison (NO_VALUES, EMPTY_ROW, MISSING_NAME)
 */
const getIgnoredLines = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 50,
      reason,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Vérifier que l'ImportJob existe
    const job = await ImportJob.findById(id).select('_id ignoredLines').lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'ImportJob non trouvé',
      });
    }

    // Filtre sur la raison (optionnel)
    const matchFilter = { _id: job._id };
    const unwindFilter = reason ? { $eq: ['$ignoredLines.reason', reason] } : {};

    // Agrégation paginée
    const pipeline = [
      { $match: matchFilter },
      { $unwind: '$ignoredLines' },
    ];

    if (reason) {
      pipeline.push({
        $match: { 'ignoredLines.reason': reason },
      });
    }

    // Compter le total
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await ImportJob.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Paginer
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });
    pipeline.push({
      $project: {
        _id: 0,
        sourceRowNumber: '$ignoredLines.sourceRowNumber',
        sheetName: '$ignoredLines.sheetName',
        reason: '$ignoredLines.reason',
        rawData: '$ignoredLines.rawData',
      },
    });

    const ignoredLines = await ImportJob.aggregate(pipeline);

    // Stats par raison (toujours, pour le filtre frontend)
    const statsResult = await ImportJob.aggregate([
      { $match: matchFilter },
      { $unwind: '$ignoredLines' },
      {
        $group: {
          _id: '$ignoredLines.reason',
          count: { $sum: 1 },
        },
      },
    ]);

    const byReason = statsResult.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: ignoredLines,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
      stats: {
        byReason,
        totalIgnored: job.ignoredLines?.length || 0,
      },
      filters: {
        reason: reason || null,
      },
    });
  } catch (error) {
    console.error('❌ Erreur getIgnoredLines:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des lignes ignorées',
    });
  }
};

// ============================================================
//  HISTORIQUE D'UNE PÉRIODE
// ============================================================

const getImportHistory = async (req, res) => {
  try {
    const { institutionId, month, year } = req.query;

    if (!institutionId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'institutionId, month et year sont obligatoires',
      });
    }

    const jobs = await ImportJob.find({
      institutionId,
      'detectedPeriod.month': parseInt(month),
      'detectedPeriod.year': parseInt(year),
    })
      .populate('uploadedBy', 'nom email')
      .sort({ versionNumber: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: jobs,
      total: jobs.length,
    });
  } catch (error) {
    console.error('❌ Erreur getImportHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement de l\'historique',
    });
  }
};

// ============================================================
//  LISTE DES IMPORTJOBS
// ============================================================

const getImportJobs = async (req, res) => {
  try {
    const {
      institutionId,
      month,
      year,
      lifecycle,
      limit = 50,
      page = 1,
      includeDetails = 'false',
    } = req.query;

    const filter = {};
    if (institutionId) filter.institutionId = institutionId;
    if (month) filter['detectedPeriod.month'] = parseInt(month);
    if (year) filter['detectedPeriod.year'] = parseInt(year);
    if (lifecycle) filter.lifecycle = lifecycle;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const projection = getProjection(
      includeDetails,
      IMPORT_JOB_LIGHT_PROJECTION
    );

    const jobs = await ImportJob.find(filter)
      .select(projection || '')
      .populate('institutionId', 'nom code')
      .populate('uploadedBy', 'nom email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ImportJob.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getImportJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des jobs',
    });
  }
};

// ============================================================
//  EXPORTS
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
  getImportJobById,
  getIgnoredLines,        // 🔹 Phase 5.7
  getImportHistory,
  getImportJobs,
};