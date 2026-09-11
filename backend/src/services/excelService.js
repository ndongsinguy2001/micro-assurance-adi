// backend/src/services/excelService.js
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Service de génération de fichiers Excel
 * - Fichier de clôture mensuel
 * - Export des données
 */

// ============================================================
// 1. GÉNÉRATION DU FICHIER DE CLÔTURE MENSUEL
// ============================================================

const generateClotureFile = async (
  reporting,
  adhesions,
  exclusions,
  sfd,
  contrat,
  outputPath
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();

      // ============================================================
      // ONGLET 1 : MENSUEL OK (Adhésions valides)
      // ============================================================
      const sheetOk = workbook.addWorksheet('Mensuel OK');

      const headers = [
        'Guichet',
        'Localité du Guichet',
        'Identifiant emprunteur',
        'Nom emprunteur',
        'Prénom emprunteur',
        'Adresse',
        'Date de naissance',
        'Profession',
        'Sexe',
        'date de fin du prêt',
        'Mois du reporting',
        'Date du prêt',
        'durée du prêt',
        'montant du prêt',
        'Type de crédit',
        'Type de prêt',
        "Taux d'interet du prêt",
        'prime',
        'Frais de gestion',
        'taxes',
        'Montant due',
        'Age',
        'contrôle age',
        'contrôle date du prêt',
        'Contrôle montant du prêt',
        'contrôle durée du prêt',
        'mois du prêt',
        'Contrôle',
        'Sinistre',
      ];

      const headerRow = sheetOk.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F81BD' },
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      adhesions.forEach((adh) => {
        const row = sheetOk.addRow([
          adh.guichet || '',
          adh.localite || '',
          adh.identifiantEmprunteur || '',
          adh.nomEmprunteur || '',
          adh.prenomEmprunteur || '',
          adh.adresse || '',
          adh.dateNaissance ? new Date(adh.dateNaissance) : null,
          adh.profession || '',
          adh.sexe || '',
          adh.dateFinPret ? new Date(adh.dateFinPret) : null,
          adh.moisReporting || '',
          adh.datePret ? new Date(adh.datePret) : null,
          adh.dureePret || 0,
          adh.montantPret || 0,
          adh.typeCredit || '',
          adh.typePret || '',
          adh.tauxInteretPret || 0,
          adh.prime || 0,
          adh.fraisGestion || 0,
          adh.taxes || 0,
          adh.montantDu || 0,
          adh.age || 0,
          adh.controleAge || 'ok',
          adh.controleDate || 'ok',
          adh.controleMontant || 'ok',
          adh.controleDuree || 'ok',
          adh.moisPret || 0,
          adh.controleGlobal || 'ok',
          '',
        ]);

        if (adh.controleGlobal === 'ok') {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE2EFDA' },
            };
          });
        }
      });

      sheetOk.columns.forEach((col) => {
        col.width = 18;
      });

      // ============================================================
      // ONGLET 2 : EXCLUSIONS
      // ============================================================
      const sheetExclusions = workbook.addWorksheet('Exclusions');

      const exclusionHeaders = [...headers, "Motif d'exclusion"];
      const exclHeaderRow = sheetExclusions.addRow(exclusionHeaders);
      exclHeaderRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' },
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      exclusions.forEach((adh) => {
        sheetExclusions.addRow([
          adh.guichet || '',
          adh.localite || '',
          adh.identifiantEmprunteur || '',
          adh.nomEmprunteur || '',
          adh.prenomEmprunteur || '',
          adh.adresse || '',
          adh.dateNaissance ? new Date(adh.dateNaissance) : null,
          adh.profession || '',
          adh.sexe || '',
          adh.dateFinPret ? new Date(adh.dateFinPret) : null,
          adh.moisReporting || '',
          adh.datePret ? new Date(adh.datePret) : null,
          adh.dureePret || 0,
          adh.montantPret || 0,
          adh.typeCredit || '',
          adh.typePret || '',
          adh.tauxInteretPret || 0,
          adh.prime || 0,
          adh.fraisGestion || 0,
          adh.taxes || 0,
          adh.montantDu || 0,
          adh.age || 0,
          adh.controleAge || 'no',
          adh.controleDate || 'no',
          adh.controleMontant || 'no',
          adh.controleDuree || 'no',
          adh.moisPret || 0,
          adh.controleGlobal || 'no',
          '',
          adh.motifExclusion || '',
        ]);
      });

      sheetExclusions.columns.forEach((col) => {
        col.width = 18;
      });

      // ============================================================
      // ONGLET 3 : RÉCAPITULATIF
      // ============================================================
      const sheetRecap = workbook.addWorksheet('Récapitulatif');

      sheetRecap.addRow(['RAPPORT DE CLÔTURE MENSUEL']);
      sheetRecap.addRow([]);
      sheetRecap.addRow(['SFD:', sfd.nom]);
      sheetRecap.addRow(['Code:', sfd.code]);
      sheetRecap.addRow(['Période:', `${reporting.mois}/${reporting.annee}`]);
      sheetRecap.addRow(['Date de clôture:', new Date().toLocaleDateString('fr-FR')]);
      sheetRecap.addRow([]);
      sheetRecap.addRow(['STATISTIQUES']);
      sheetRecap.addRow(['Total adhésions valides:', adhesions.length]);
      sheetRecap.addRow(['Total exclusions:', exclusions.length]);
      sheetRecap.addRow(['Total adhésions:', adhesions.length + exclusions.length]);
      sheetRecap.addRow([]);
      sheetRecap.addRow(['MONTANTS']);
      sheetRecap.addRow(['Total des primes:', reporting.totalPrime || 0]);
      sheetRecap.addRow(['Total frais de gestion:', reporting.totalFraisGestion || 0]);
      sheetRecap.addRow(['Total taxes:', reporting.totalTaxes || 0]);
      sheetRecap.addRow(['Total montant dû:', reporting.totalMontantDu || 0]);
      sheetRecap.addRow([]);
      sheetRecap.addRow(['COMMISSIONS']);
      sheetRecap.addRow(['Commission SFD:', reporting.commissionSFD || 0]);
      sheetRecap.addRow(['Commission IG:', reporting.commissionIG || 0]);
      sheetRecap.addRow(['Commission Assureur:', reporting.commissionAssureur || 0]);

      sheetRecap.getRow(1).font = { bold: true, size: 16 };

      // ============================================================
      // SAUVEGARDE
      // ============================================================
      await workbook.xlsx.writeFile(outputPath);

      resolve({
        success: true,
        path: outputPath,
        filename: path.basename(outputPath),
      });
    } catch (error) {
      reject(error);
    }
  });
};

// ============================================================
// 2. EXPORTER LES DONNÉES EN EXCEL
// ============================================================

const exportToCSV = async (data, headers, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Export');

      worksheet.addRow(headers);

      data.forEach((row) => {
        worksheet.addRow(Object.values(row));
      });

      workbook.xlsx
        .writeFile(outputPath)
        .then(() => {
          resolve({
            success: true,
            path: outputPath,
            filename: path.basename(outputPath),
          });
        })
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

// ============================================================
// 3. UTILITAIRES
// ============================================================

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const generateFileName = (prefix, sfdCode, mois, annee, extension = 'xlsx') => {
  const date = new Date();
  const timestamp = date.getTime();
  return `${prefix}_${sfdCode}_${mois}_${annee}_${timestamp}.${extension}`;
};

module.exports = {
  generateClotureFile,
  exportToCSV,
  ensureDirectoryExists,
  generateFileName,
};