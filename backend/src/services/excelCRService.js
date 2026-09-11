// backend/src/services/excelCRService.js
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const moisNoms = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/**
 * Génère le fichier Excel du Compte de Résultat
 * @param {Object} cr - Objet CompteResultat (persisté ou brut)
 * @param {String} outputPath - Chemin complet du fichier Excel
 */
const generateCRExcel = async (cr, outputPath) => {
  ensureDirectoryExists(path.dirname(outputPath));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inclusive Guarantee';
  workbook.created = new Date();

  // ============================================================
  // ONGLET 1 : SYNTHÈSE
  // ============================================================
  const sheetSynth = workbook.addWorksheet('Synthèse');

  const titleRow = sheetSynth.addRow(['COMPTE DE RÉSULTAT']);
  titleRow.font = { bold: true, size: 18, color: { argb: 'FF1A56DB' } };
  titleRow.alignment = { horizontal: 'center' };
  sheetSynth.mergeCells('A1:D1');

  sheetSynth.addRow([]);

  // Infos générales
  const infoRows = [
    ['SFD', cr.sfd.nom],
    ['Code SFD', cr.sfd.code],
    ['Contrat', cr.contrat?.nom || 'N/A'],
    ['Assureur', cr.contrat?.assureurNom || 'N/A'],
    ['Exercice', `${cr.periode.annee}`],
    ['Type de clôture', cr.periode.type === 'ALLIANZ' ? 'Allianz (Oct-Sep)' : 'Année civile'],
    [
      'Période',
      `${new Date(cr.periode.debut).toLocaleDateString('fr-FR')} → ${new Date(cr.periode.fin).toLocaleDateString('fr-FR')}`,
    ],
    ['Statut', cr.statut],
    ['Date de génération', new Date(cr.dateGeneration).toLocaleString('fr-FR')],
  ];

  infoRows.forEach(([label, value]) => {
    const row = sheetSynth.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  });

  sheetSynth.addRow([]);

  // --- CRÉDIT ---
  const creditHeader = sheetSynth.addRow(['CRÉDIT']);
  creditHeader.font = { bold: true, size: 13, color: { argb: 'FF16A34A' } };
  sheetSynth.addRow(['Libellé', 'Montant (F CFA)']).font = { bold: true };

  const creditLines = [
    ['Primes collectées', cr.credit.primesCollectees],
    ['Reprise provision PENA', cr.credit.reprises.pena],
    ['Reprise provision sinistres non réglés', cr.credit.reprises.sinistresNonRegles],
    ['Reprise provision sinistres inconnus', cr.credit.reprises.sinistresInconnus],
  ];

  creditLines.forEach(([label, value]) => {
    const row = sheetSynth.addRow([label, value]);
    row.getCell(2).numFmt = '#,##0';
  });

  const totalCreditRow = sheetSynth.addRow(['TOTAL CRÉDIT', cr.credit.total]);
  totalCreditRow.font = { bold: true };
  totalCreditRow.getCell(2).numFmt = '#,##0';

  sheetSynth.addRow([]);

  // --- DÉBIT ---
  const debitHeader = sheetSynth.addRow(['DÉBIT']);
  debitHeader.font = { bold: true, size: 13, color: { argb: 'FFDC2626' } };
  sheetSynth.addRow(['Libellé', 'Montant (F CFA)']).font = { bold: true };

  const debitLines = [
    ['Sinistres payés', cr.debit.sinistresPayes],
    ['Provision sinistres non réglés', cr.debit.provisions.sinistresNonRegles],
    ['Provision sinistres inconnus', cr.debit.provisions.sinistresInconnus],
    ['Provision PENA', cr.debit.provisions.pena],
    ['Commission SFD', cr.debit.commissions.sfd],
    ['Commission IG', cr.debit.commissions.ig],
    ['Commission Assureur', cr.debit.commissions.assureur],
    ['Frais de management', cr.debit.commissions.fraisManagement],
    ['Frais de réassurance', cr.debit.commissions.fraisReassurance],
    ['Report à nouveau', cr.debit.reportANouveau],
  ];

  debitLines.forEach(([label, value]) => {
    const row = sheetSynth.addRow([label, value]);
    row.getCell(2).numFmt = '#,##0';
  });

  const totalDebitRow = sheetSynth.addRow(['TOTAL DÉBIT', cr.debit.total]);
  totalDebitRow.font = { bold: true };
  totalDebitRow.getCell(2).numFmt = '#,##0';

  sheetSynth.addRow([]);

  // --- RÉSULTAT ---
  const resultatHeader = sheetSynth.addRow(['RÉSULTAT']);
  resultatHeader.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };

  const resultatRow = sheetSynth.addRow(['Résultat de l\'exercice', cr.resultat.resultat]);
  resultatRow.font = { bold: true, size: 12 };
  resultatRow.getCell(2).numFmt = '#,##0';
  resultatRow.getCell(2).font = {
    bold: true,
    color: { argb: cr.resultat.resultat >= 0 ? 'FF16A34A' : 'FFDC2626' },
  };

  sheetSynth.addRow([]);

  const pbHeader = sheetSynth.addRow(['PARTICIPATION AUX BÉNÉFICES']);
  pbHeader.font = { bold: true, size: 13 };

  const pbSFDRow = sheetSynth.addRow([
    `PB SFD (${(cr.taux.pourcentagePB_SFD * 100).toFixed(0)}%)`,
    cr.resultat.pb.sfd,
  ]);
  pbSFDRow.getCell(2).numFmt = '#,##0';
  pbSFDRow.getCell(2).font = { color: { argb: 'FF1A56DB' } };

  const pbAssureurRow = sheetSynth.addRow([
    `PB Assureur (${(cr.taux.pourcentagePB_Assureur * 100).toFixed(0)}%)`,
    cr.resultat.pb.assureur,
  ]);
  pbAssureurRow.getCell(2).numFmt = '#,##0';
  pbAssureurRow.getCell(2).font = { color: { argb: 'FF7C3AED' } };

  // Largeur des colonnes
  sheetSynth.getColumn(1).width = 45;
  sheetSynth.getColumn(2).width = 25;

  // ============================================================
  // ONGLET 2 : TAUX APPLIQUÉS
  // ============================================================
  const sheetTaux = workbook.addWorksheet('Taux appliqués');
  sheetTaux.addRow(['Paramètre', 'Valeur']).font = { bold: true };
  sheetTaux.getColumn(1).width = 40;
  sheetTaux.getColumn(2).width = 20;

  const tauxLines = [
    ['Commission SFD', `${(cr.taux.commissionSFD * 100).toFixed(2)}%`],
    ['Commission IG', `${(cr.taux.commissionIG * 100).toFixed(2)}%`],
    ['Commission Assureur', `${(cr.taux.commissionAssureur * 100).toFixed(2)}%`],
    ['Frais de management', `${(cr.taux.fraisManagement * 100).toFixed(2)}%`],
    ['Frais de réassurance', `${(cr.taux.fraisReassurance * 100).toFixed(2)}%`],
    ['PB SFD', `${(cr.taux.pourcentagePB_SFD * 100).toFixed(2)}%`],
    ['PB Assureur', `${(cr.taux.pourcentagePB_Assureur * 100).toFixed(2)}%`],
  ];

  tauxLines.forEach((row) => {
    sheetTaux.addRow(row);
  });

  // ============================================================
  // ONGLET 3 : DÉTAIL REPORTINGS
  // ============================================================
  const sheetReportings = workbook.addWorksheet('Reportings');
  sheetReportings.addRow(['Mois', 'Année', 'Prime totale', 'Nb adhésions']).font = {
    bold: true,
  };
  sheetReportings.getColumn(1).width = 15;
  sheetReportings.getColumn(2).width = 10;
  sheetReportings.getColumn(3).width = 20;
  sheetReportings.getColumn(4).width = 15;

  (cr.reportings || []).forEach((r) => {
    const row = sheetReportings.addRow([
      moisNoms[r.mois - 1] || r.mois,
      r.annee,
      r.totalPrime || 0,
      r.nombreAdhesions || 0,
    ]);
    row.getCell(3).numFmt = '#,##0';
  });

  // Total
  const totalRow = sheetReportings.addRow([
    'TOTAL',
    '',
    cr.credit.primesCollectees,
    (cr.reportings || []).reduce((sum, r) => sum + (r.nombreAdhesions || 0), 0),
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(3).numFmt = '#,##0';

  // ============================================================
  // ONGLET 4 : DÉTAIL PROVISIONS
  // ============================================================
  const sheetProv = workbook.addWorksheet('Provisions');
  sheetProv.addRow(['Type de provision', 'Montant']).font = { bold: true };
  sheetProv.getColumn(1).width = 45;
  sheetProv.getColumn(2).width = 20;

  const provLines = [
    ['Primes impactées au-delà de N', cr.debit.provisions.primesImpacteesNPlus],
    ['Provision PENA', cr.debit.provisions.pena],
    ['Provision sinistres non réglés', cr.debit.provisions.sinistresNonRegles],
    ['Provision sinistres inconnus', cr.debit.provisions.sinistresInconnus],
  ];

  provLines.forEach(([label, value]) => {
    const row = sheetProv.addRow([label, value]);
    row.getCell(2).numFmt = '#,##0';
  });

  // Sauvegarde
  await workbook.xlsx.writeFile(outputPath);

  return {
    success: true,
    path: outputPath,
    filename: path.basename(outputPath),
  };
};

module.exports = {
  generateCRExcel,
  ensureDirectoryExists,
};