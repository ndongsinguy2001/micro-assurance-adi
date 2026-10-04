// backend/__tests__/sheetDetector.test.js
/**
 * 🧪 Tests Phase 5.8 — Détection intelligente de feuilles
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const sheetDetector = require('../src/services/sheetDetector');

// ============================================================
// HELPER — Crée un classeur Excel temporaire
// ============================================================
const createTestWorkbook = (sheets) => {
  const workbook = new ExcelJS.Workbook();

  for (const { name, rows } of sheets) {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row));
  }

  return workbook;
};

describe('PHASE 5.8 — sheetDetector', () => {
  // ============================================================
  // TESTS detectReportingSheet
  // ============================================================
  describe('detectReportingSheet', () => {
    test('T5.8.1 — Feuille nommée "Mensuel OK" (nom standard)', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Mensuel OK',
          rows: [
            [],
            ['Identifiant emprunteur', 'Nom emprunteur', 'Montant du prêt'],
            ['A001', 'DUPONT', '100000'],
          ],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheet).toBeDefined();
      expect(result.sheetName).toBe('Mensuel OK');
      expect(result.headerRowIndex).toBe(2);
      expect(result.matchedKeywords).toBeGreaterThanOrEqual(2);
    });

    test('T5.8.2 — Feuille avec nom ARBITRAIRE ("Feuille1")', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Feuille1',
          rows: [
            ['Identifiant emprunteur', 'Nom emprunteur', 'Montant du prêt', 'Date du prêt'],
            ['A001', 'DUPONT', '100000', '15/03/2025'],
          ],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheet).toBeDefined();
      expect(result.sheetName).toBe('Feuille1');
      expect(result.headerRowIndex).toBe(1);
      expect(result.matchedKeywords).toBeGreaterThanOrEqual(2);

      // Doit générer un warning NON_STANDARD_SHEET_NAME
      const warning = result.warnings.find((w) => w.code === 'NON_STANDARD_SHEET_NAME');
      expect(warning).toBeDefined();
    });

    test('T5.8.3 — Feuille avec nom "Données 2025"', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Données 2025',
          rows: [
            ['Titre du fichier'],
            [],
            ['Identifiant emprunteur', 'Nom emprunteur', 'Montant du prêt'],
            ['A001', 'DUPONT', '100000'],
          ],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheet).toBeDefined();
      expect(result.sheetName).toBe('Données 2025');
      expect(result.headerRowIndex).toBe(3);
    });

    test('T5.8.4 — Plusieurs feuilles, bonne détection', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Sommaire',
          rows: [['Récapitulatif'], ['Total', '1000']],
        },
        {
          name: 'Feuille2',
          rows: [
            ['Identifiant emprunteur', 'Nom emprunteur'],
            ['A001', 'DUPONT'],
          ],
        },
        {
          name: 'Paramètres',
          rows: [['Âge minimum', '18']],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheetName).toBe('Feuille2');
      expect(result.exploredSheets.length).toBe(3);
    });

    test('T5.8.5 — Aucune feuille valide → NO_REPORTING_SHEET_FOUND', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Feuille1',
          rows: [['Juste du texte'], ['Rien à voir']],
        },
        {
          name: 'Feuille2',
          rows: [['Autre contenu'], ['Pas les bons mots-clés']],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheet).toBeNull();
      expect(result.warnings.some((w) => w.code === 'NO_REPORTING_SHEET_FOUND')).toBe(true);
    });

    test('T5.8.6 — Deux feuilles valides → warning MULTIPLE_REPORTING_SHEETS', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Data1',
          rows: [
            ['Identifiant emprunteur', 'Nom emprunteur'],
            ['A001', 'DUPONT'],
          ],
        },
        {
          name: 'Data2',
          rows: [
            ['Identifiant emprunteur', 'Nom emprunteur'],
            ['A002', 'DURAND'],
          ],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheet).toBeDefined();
      const warning = result.warnings.find((w) => w.code === 'MULTIPLE_REPORTING_SHEETS');
      expect(warning).toBeDefined();
    });

    test('T5.8.7 — Mots-clés avec accents et casse différents', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Feuille',
          rows: [
            ['IDENTIFIANT EMPRUNTEUR', 'NOM EMPRUNTEUR'],
            ['A001', 'DUPONT'],
          ],
        },
      ]);

      const result = sheetDetector.detectReportingSheet(workbook);

      expect(result.sheet).toBeDefined();
      expect(result.headerRowIndex).toBe(1);
    });
  });

  // ============================================================
  // TESTS detectPSBSheet
  // ============================================================
  describe('detectPSBSheet', () => {
    test('T5.8.8 — Détection feuille PSB standard', () => {
      const workbook = createTestWorkbook([
        {
          name: 'PSB',
          rows: [
            ['Âge minimum', '18 years'],
            ['Âge maximum début du prêt', '64 years'],
            ['Taux de prime', '0,65%'],
            ['Durée minimum prêt', '1 months'],
            ['Montant maximum du prêt', '25000000'],
          ],
        },
      ]);

      const result = sheetDetector.detectPSBSheet(workbook);

      expect(result.sheet).toBeDefined();
      expect(result.sheetName).toBe('PSB');
      expect(result.matchedKeywords).toBeGreaterThanOrEqual(3);
    });

    test('T5.8.9 — PSB avec nom arbitraire', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Paramètres contrat',
          rows: [
            ['Âge minimum', '18 years'],
            ['Âge maximum début du prêt', '64 years'],
            ['Taux de prime', '0,65%'],
            ['Durée minimum prêt', '1 months'],
          ],
        },
      ]);

      const result = sheetDetector.detectPSBSheet(workbook);

      expect(result.sheet).toBeDefined();
      expect(result.sheetName).toBe('Paramètres contrat');
    });

    test('T5.8.10 — PSB absent → warning', () => {
      const workbook = createTestWorkbook([
        {
          name: 'Data',
          rows: [['Nom', 'Prénom'], ['A', 'B']],
        },
      ]);

      const result = sheetDetector.detectPSBSheet(workbook);

      expect(result.sheet).toBeNull();
      expect(result.warnings.some((w) => w.code === 'NO_PSB_SHEET_FOUND')).toBe(true);
    });
  });
});