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

// ============================================================
//  FONCTIONS UTILITAIRES
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
    console.log('✅ Assureur par défaut créé');
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
  if (m < 0 || (m === 0 && reference.getDate() < naissance.getDate())) {
    age--;
  }
  return age;
};

const findColIndex = (headerRow, possibleNames) => {
  if (!headerRow || !Array.isArray(headerRow)) return -1;

  for (const name of possibleNames) {
    const index = headerRow.findIndex((cell) => {
      if (!cell || typeof cell !== 'string') return false;
      return cell.trim().toLowerCase() === name.toLowerCase();
    });
    if (index !== -1) return index;
  }

  for (const name of possibleNames) {
    const index = headerRow.findIndex((cell) => {
      if (!cell || typeof cell !== 'string') return false;
      return cell.trim().toLowerCase().includes(name.toLowerCase());
    });
    if (index !== -1) return index;
  }

  return -1;
};

const extraireNomSFD = (rows) => {
  const keywords = ['Suivi', 'IMCEC', 'PAMECAS', 'RMRC', 'ACE', 'CITIZEN', 'PASBO', 'PADME'];

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
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
  const date = new Date();
  const timestamp = date.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JOB-${timestamp}-${random}`;
};

// ============================================================
//  ROUTE : IMPORT REPORTING (SYNCHRONE)
// ============================================================

const importReporting = async (req, res) => {
  const BATCH_SIZE = 500;
  let filePath = null;
  let job = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni',
      });
    }

    filePath = req.file.path;

    // 1. Créer un job
    job = await Job.create({
      type: 'IMPORT_REPORTING',
      code: generateJobCode(),
      statut: 'PENDING',
      donnees: {
        fichier: req.file.originalname,
        taille: req.file.size,
      },
      creePar: req.user._id,
      utilisateurId: req.user._id,
    });

    // 2. Lire le fichier
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

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

    // 3. Paramètres PSB
    const params = {};
    sheetPSB.eachRow({ includeEmpty: false }, (row) => {
      const key = row.getCell(1).text.trim();
      const value = row.getCell(2).text;
      const numValue = parseFloat(value);
      params[key] = isNaN(numValue) ? value : numValue;
    });

    // 4. Extraction des données brutes
    const rawData = [];
    sheetMensuel.eachRow({ includeEmpty: false }, (row) => {
      const rowData = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowData.push(cell.text);
      });
      rawData.push(rowData);
    });

    // 5. Nom du SFD
    let sfdName = extraireNomSFD(rawData);
    if (!sfdName) {
      sfdName = rawData[2] && rawData[2][5] ? rawData[2][5].trim() : 'SFD INCONNU';
    }

    // 6. Trouver ou créer le SFD
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

    // 7. Trouver ou créer le contrat
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

    // 8. Trouver l'en-tête
    let headerRowIndex = -1;
    const headerKeywords = ['Identifiant emprunteur', 'Identifiant', 'ID', 'Nom emprunteur', 'Nom', 'NOM'];

    for (let i = 0; i < Math.min(30, rawData.length); i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      let matchCount = 0;
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'string') {
          for (const keyword of headerKeywords) {
            if (cell.includes(keyword)) {
              matchCount++;
              break;
            }
          }
        }
      }
      if (matchCount >= 2) {
        headerRowIndex = i;
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

    const headers = rawData[headerRowIndex];
    const startRowIndex = headerRowIndex + 1;

    // 9. Extraction colonnes
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
      dureePret: findColIndex(headers, ['durée du prêt (en nombre de mois)', 'durée du prêt', 'Durée prêt']),
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

    // 10. Détection période
    const moisNoms = [
      'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
      'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE',
    ];

    let mois = 1;
    let annee = new Date().getFullYear();
    let dateFromReporting = false;

    for (let i = startRowIndex; i < Math.min(startRowIndex + 10, rawData.length); i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      const moisReportingStr = row[colIndex.moisReporting]
        ? row[colIndex.moisReporting].toString().trim()
        : '';
      if (moisReportingStr) {
        const cleanStr = moisReportingStr.toUpperCase().trim();
        for (let m = 0; m < moisNoms.length; m++) {
          if (cleanStr.includes(moisNoms[m])) {
            mois = m + 1;
            const yearMatch = cleanStr.match(/\b(20\d{2})\b/);
            if (yearMatch) annee = parseInt(yearMatch[1]);
            dateFromReporting = true;
            break;
          }
        }
        if (dateFromReporting) break;
      }
    }

    if (!dateFromReporting || annee < 2000) {
      let datePretReference = null;
      for (let i = startRowIndex; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const datePret = toDate(row[colIndex.datePret]);
        if (datePret) {
          datePretReference = datePret;
          break;
        }
      }
      if (datePretReference) {
        mois = datePretReference.getMonth() + 1;
        annee = datePretReference.getFullYear();
      } else {
        mois = new Date().getMonth() + 1;
        annee = new Date().getFullYear();
      }
    }

    if (!annee || annee < 2000) annee = new Date().getFullYear();

    const dateDebut = new Date(annee, mois - 1, 1);
    const dateFin = new Date(annee, mois, 0);

    // 11. Suppression ancien reporting
    const existingReporting = await ReportingMensuel.findOne({
      sfdId: sfd._id,
      mois,
      annee,
    });
    if (existingReporting) {
      await Adhesion.deleteMany({ reportingMensuelId: existingReporting._id });
      await ReportingMensuel.findByIdAndDelete(existingReporting._id);
    }

    // 12. Créer le reporting
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

    // 13. Traitement des lignes
    const adhesionIds = [];
    const exclusionIds = [];
    const adhesionDataArray = [];
    const erreurs = [];
    let totalAdhesions = 0;
    let totalExclusions = 0;

    job.demarrer();
    await job.save();

    for (let i = startRowIndex; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const hasData = row.some((cell) => cell !== undefined && cell !== null && cell !== '');
      if (!hasData) continue;

      const nom = row[colIndex.nom] ? row[colIndex.nom].toString().trim() : '';
      if (!nom) continue;

      const identifiant = row[colIndex.identifiant]
        ? row[colIndex.identifiant].toString().trim()
        : `ADH-${Date.now()}-${i}`;
      const prenom = row[colIndex.prenom] ? row[colIndex.prenom].toString().trim() : '';
      const montantPret = toNumber(row[colIndex.montantPret]);
      const dureePret = toNumber(row[colIndex.dureePret]);
      const datePret = toDate(row[colIndex.datePret]);
      const dateNaissance = toDate(row[colIndex.dateNaissance]);
      const dateFinPret = toDate(row[colIndex.dateFinPret]);

      const age = calculerAge(dateNaissance, datePret);

      const controleDate = datePret && datePret >= dateDebut && datePret <= dateFin ? 'ok' : 'no';
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

      const sinistreValue = row[colIndex.sinistre]
        ? row[colIndex.sinistre].toString().trim()
        : '';
      const estSinistre = sinistreValue ? true : false;

      adhesionDataArray.push({
        reportingMensuelId: reporting._id,
        sfdId: sfd._id,
        contratId: contrat._id,
        guichet: row[colIndex.guichet] ? row[colIndex.guichet].toString().trim() : '',
        localite: row[colIndex.localite] ? row[colIndex.localite].toString().trim() : '',
        identifiantEmprunteur: identifiant,
        nomEmprunteur: nom,
        prenomEmprunteur: prenom,
        adresse: row[colIndex.adresse] ? row[colIndex.adresse].toString().trim() : '',
        dateNaissance,
        profession: row[colIndex.profession] ? row[colIndex.profession].toString().trim() : '',
        sexe: row[colIndex.sexe]
          ? row[colIndex.sexe].toString().trim().toUpperCase()
          : '',
        dateFinPret,
        moisReporting: row[colIndex.moisReporting]
          ? row[colIndex.moisReporting].toString().trim()
          : '',
        datePret,
        dureePret,
        montantPret,
        typeCredit: row[colIndex.typeCredit] ? row[colIndex.typeCredit].toString().trim() : '',
        typePret: row[colIndex.typePret] ? row[colIndex.typePret].toString().trim() : '',
        tauxInteretPret: toNumber(row[colIndex.tauxInteret]),
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
          row[colIndex.sexe] && row[colIndex.sexe].toString().toUpperCase() === 'M' ? 1 : 0,
        nbFemale:
          row[colIndex.sexe] && row[colIndex.sexe].toString().toUpperCase() === 'F' ? 1 : 0,
        moisPret: parseInt(row[colIndex.moisPret]) || 0,
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
        ligneOriginale: i + 1,
        creePar: req.user._id,
      });

      // Traitement par lot
      if (adhesionDataArray.length >= BATCH_SIZE) {
        try {
          const inserted = await Adhesion.insertMany(adhesionDataArray);
          inserted.forEach((doc) => {
            if (doc.estExclue) {
              exclusionIds.push(doc._id);
              totalExclusions++;
            } else {
              adhesionIds.push(doc._id);
              totalAdhesions++;
            }
          });
          const progression = ((i - startRowIndex) / (rawData.length - startRowIndex)) * 100;
          job.mettreAJourProgression(Math.round(progression));
          await job.save();
        } catch (err) {
          erreurs.push({
            ligne: i + 1,
            message: err.message,
            donnees: adhesionDataArray.length,
          });
        }
        adhesionDataArray.length = 0;
      }
    }

    // Dernier lot
    if (adhesionDataArray.length > 0) {
      try {
        const inserted = await Adhesion.insertMany(adhesionDataArray);
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
          ligne: rawData.length,
          message: err.message,
          donnees: adhesionDataArray.length,
        });
      }
    }

    // 14. Mise à jour reporting
    reporting.adhesions = adhesionIds;
    reporting.exclusions.ids = exclusionIds;
    reporting.nombreAdhesions = totalAdhesions;
    reporting.nombreExclusions = totalExclusions;
    reporting.erreursImport = erreurs;

    const adhesions = await Adhesion.find({ _id: { $in: adhesionIds } });
    let totalPrime = 0;
    let totalFraisGestion = 0;
    let totalTaxes = 0;
    let totalMontantDu = 0;

    adhesions.forEach((adh) => {
      totalPrime += adh.prime || 0;
      totalFraisGestion += adh.fraisGestion || 0;
      totalTaxes += adh.taxes || 0;
      totalMontantDu += adh.montantDu || 0;
    });

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

    // 15. Création des sinistres
    const sinistresAdhesions = await Adhesion.find({
      _id: { $in: adhesionIds },
      'sinistre.estSinistre': true,
    });

    for (const adh of sinistresAdhesions) {
      await Sinistre.create({
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
      });
    }

    // 16. Créer/mettre à jour SuiviIntermediation
    await SuiviIntermediation.findOneAndUpdate(
      { sfdId: sfd._id, mois, annee },
      {
        sfdId: sfd._id,
        mois,
        annee,
        reportingMensuelId: reporting._id,
        dateReceptionReporting: new Date(),
        statut: totalExclusions > 0 ? 'EN_COURS' : 'EN_COURS',
        creePar: req.user._id,
      },
      { upsert: true, new: true }
    );

    // 17. Fin du job
    job.terminer(
      {
        reportingId: reporting._id,
        totalAdhesions,
        totalExclusions,
        totalPrime,
        erreurs: erreurs.length,
      },
      `Import terminé: ${totalAdhesions} adhésions, ${totalExclusions} exclusions`
    );
    await job.save();

    // 18. Nettoyage
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
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
      },
    });
  } catch (error) {
    console.error('❌ Erreur import reporting:', error);

    // Marquer le job en erreur
    if (job) {
      try {
        await job.echouer(error.message);
        await job.save();
      } catch (e) {
        /* ignore */
      }
    }

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
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
//  ROUTE : SOUMETTRE UN IMPORT ASYNCHRONE (QUEUE)
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
//  ROUTES : GESTION DES REPORTINGS
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
//  CLÔTURER UN REPORTING (avec génération des documents)
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

    // --- 1. Marquer clôturé ---
    reporting.statut = STATUT_REPORTING.CLOTURE;
    reporting.dateCloture = new Date();
    reporting.cloturePar = req.user._id;
    reporting.modifiePar = req.user._id;
    await reporting.save();

    // --- 2. Générer les documents ---
    let documents = null;
    try {
      documents = await genererDocumentsCloture(
        reporting,
        reporting.sfdId,
        reporting.contratId,
        req.user
      );

      // Sauvegarder les chemins
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

    // --- 3. Mettre à jour SuiviIntermediation ---
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