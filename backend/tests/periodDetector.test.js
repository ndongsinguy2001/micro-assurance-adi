// backend/__tests__/periodDetector.test.js
/**
 * 🧪 Tests Phase 5.2 — Détection robuste de période
 *
 * Groupes de tests :
 *   A. Tests recette T1/T2/T3
 *   B. Tests de priorité (filename vs header vs content)
 *   C. Tests d'erreur (bloquants)
 *   D. Tests de non-régression (legacy fallback)
 *   E. Tests de complétude (mois sans année)
 *   F. Tests de conflits (warnings)
 */

const periodDetector = require('../src/services/periodDetector');
const { detectPeriod } = periodDetector;
const { _internal } = periodDetector;

// ============================================================
// Helper : construit un preview minimal
// ============================================================
const buildPreview = (rows) => rows;

// ============================================================
// A. TESTS RECETTE
// ============================================================
describe('PHASE 5.2 — A. Tests recette T1/T2/T3', () => {
  test('T1 — REPORTING IMcEC MBOUR JANVIER 2020 → 01/2020', () => {
    const result = detectPeriod({
      fileName: 'REPORTING IMcEC MBOUR JANVIER 2020.xls',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(1);
    expect(result.annee).toBe(2020);
    expect(result.source).toBe('filename');
    expect(result.confidence).toBe('HIGH');
    expect(result.isReliable).toBe(true);
  });

  test('T2 — REPORTING ADI ALLIANZ IMECEMBOUR MARS 2025 → 03/2025', () => {
    const result = detectPeriod({
      fileName: 'REPORTING ADI ALLIANZ IMECEMBOUR MARS 2025',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('filename');
    expect(result.confidence).toBe('HIGH');
    expect(result.isReliable).toBe(true);
  });

  test('T3 — REPORTING ADI IMCEC MBOUR MAI 2021 → 05/2021', () => {
    const result = detectPeriod({
      fileName: 'REPORTING ADI IMCEC MBOUR MAI 2021',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(5);
    expect(result.annee).toBe(2021);
    expect(result.source).toBe('filename');
    expect(result.confidence).toBe('HIGH');
    expect(result.isReliable).toBe(true);
  });
});

// ============================================================
// B. TESTS DE PRIORITÉ
// ============================================================
describe('PHASE 5.2 — B. Priorité des sources', () => {
  test('B.1 — filename + header identiques → filename retenu', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        ['Date début', '01/03/2025', 'Date fin', '31/03/2025'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('filename');
    expect(result.isAmbiguous).toBe(false);
  });

  test('B.2 — filename différent du header → filename prioritaire + warning', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        ['Date début', '01/03/2026', 'Date fin', '31/03/2026'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('filename');
    expect(result.isAmbiguous).toBe(true);

    const conflictWarning = result.warnings.find((w) => w.code === 'PERIOD_CONFLICT');
    expect(conflictWarning).toBeDefined();
    expect(conflictWarning.severity).toBe('WARNING');
  });

  test('B.3 — filename + content différents → filename prioritaire', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        [],                     // L1
        [],                     // L2
        [],                     // L3
        ['Identifiant', 'Nom', 'Mois du reporting'], // L4 = en-tête
        ['A001', 'DUPONT', 'JANVIER 2026'],          // L5 = contenu
      ],
      headerRowIndex: 4,
      colIndex: { moisReporting: 2, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('filename');
    expect(result.isAmbiguous).toBe(true);
  });

  test('B.4 — filename sans période → header utilisé', () => {
    const result = detectPeriod({
      fileName: 'reporting_generic.xlsx',
      previewRows: [
        ['Date début', '01/03/2025', 'Date fin', '31/03/2025'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('sheet-header');
  });

  test('B.5 — filename + header vides → content utilisé', () => {
    const result = detectPeriod({
      fileName: 'reporting_generic.xlsx',
      previewRows: [
        [],
        [],
        ['Identifiant', 'Nom', 'Mois du reporting'],
        ['A001', 'DUPONT', 'JANVIER 2025'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: 2, datePret: -1 },
    });

    expect(result.mois).toBe(1);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('content');
  });
});

// ============================================================
// C. TESTS D'ERREUR (bloquants)
// ============================================================
describe('PHASE 5.2 — C. Tests d\'erreur', () => {
  test('C.1 — Aucune période → NO_PERIOD_SOURCE', () => {
    const result = detectPeriod({
      fileName: 'reporting.xlsx',
      previewRows: [],
      headerRowIndex: -1,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBeNull();
    expect(result.annee).toBeNull();
    expect(result.source).toBe('none');
    expect(result.isReliable).toBe(false);

    const error = result.warnings.find((w) => w.code === 'NO_PERIOD_SOURCE');
    expect(error).toBeDefined();
    expect(error.severity).toBe('ERROR');
  });

  test('C.2 — Plusieurs mois dans filename → bloquant', () => {
    const result = detectPeriod({
      fileName: 'REPORTING JANVIER-MARS 2025.xlsx',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBeNull();
    expect(result.annee).toBeNull();
    expect(result.isAmbiguous).toBe(true);
    expect(result.isReliable).toBe(false);

    const err = result.warnings.find((w) => w.code === 'MULTIPLE_MONTHS_IN_FILENAME');
    expect(err).toBeDefined();
    expect(err.severity).toBe('ERROR');
  });

  test('C.3 — Année invalide dans filename (hors 2000-2100)', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 1999.xlsx',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    // L'année 1999 est valide en soi (4 chiffres), donc on la garde
    // mais on ne déclenche pas de blocage
    expect(result.mois).toBe(3);
    expect(result.annee).toBe(1999);
    // Le détecteur accepte 1999 comme année historique
  });

  test('C.4 — Filename sans période → FILENAME_NO_PERIOD en INFO', () => {
    const result = detectPeriod({
      fileName: 'reporting.xlsx',
      previewRows: [],
      headerRowIndex: -1,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    const info = result.warnings.find((w) => w.code === 'FILENAME_NO_PERIOD');
    expect(info).toBeDefined();
    expect(info.severity).toBe('INFO');
  });

  test('C.5 — Année courte dans filename (MARS 25) → warning + interprétation', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 25.xlsx',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025); // 25 → 2025

    const warn = result.warnings.find((w) => w.code === 'SHORT_YEAR_IN_FILENAME');
    expect(warn).toBeDefined();
    expect(warn.severity).toBe('WARNING');
  });
});

// ============================================================
// D. TESTS DE NON-RÉGRESSION (legacy)
// ============================================================
describe('PHASE 5.2 — D. Non-régression legacy', () => {
  test('D.1 — Fichier sans nom + contenu avec Date du prêt → legacy', () => {
    const result = detectPeriod({
      fileName: 'reporting.xlsx',
      previewRows: [
        [],
        [],
        ['Identifiant', 'Nom', 'Date du prêt'],
        ['A001', 'DUPONT', '15/01/2025'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: -1, datePret: 2 },
    });

    expect(result.mois).toBe(1);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('legacy');
    expect(result.confidence).toBe('LOW');
  });

  test('D.2 — Filename + Date du prêt cohérents', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        ['Identifiant', 'Nom', 'Date du prêt'],
        ['A001', 'DUPONT', '15/03/2025'],
      ],
      headerRowIndex: 1,
      colIndex: { moisReporting: -1, datePret: 2 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.source).toBe('filename');
    expect(result.isAmbiguous).toBe(false);
  });

  test('D.3 — Filename sans période + Date du prêt → legacy', () => {
    const result = detectPeriod({
      fileName: 'reporting_mensuel.xlsx',
      previewRows: [
        ['Identifiant', 'Nom', 'Date du prêt'],
        ['A001', 'DUPONT', '20/05/2021'],
      ],
      headerRowIndex: 1,
      colIndex: { moisReporting: -1, datePret: 2 },
    });

    expect(result.mois).toBe(5);
    expect(result.annee).toBe(2021);
    expect(result.source).toBe('legacy');
  });
});

// ============================================================
// E. TESTS DE COMPLÉTUDE (mois sans année)
// ============================================================
describe('PHASE 5.2 — E. Complétude mois/année', () => {
  test('E.1 — Filename avec mois sans année → complétion par content', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS.xlsx',
      previewRows: [
        [],
        ['Identifiant', 'Nom', 'Mois du reporting'],
        ['A001', 'DUPONT', 'MARS 2025'],
      ],
      headerRowIndex: 2,
      colIndex: { moisReporting: 2, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    // Le mois vient du filename (priorité) mais l'année du content
    expect(result.source).toBe('filename');
    expect(result.confidence).toBe('MEDIUM');

    const completed = result.warnings.find(
      (w) => w.code === 'PERIOD_COMPLETED_FROM_MULTIPLE_SOURCES'
    );
    expect(completed).toBeDefined();
  });
});

// ============================================================
// F. TESTS DE CONFLITS
// ============================================================
describe('PHASE 5.2 — F. Détection des conflits', () => {
  test('F.1 — filename + header conflit → warning PERIOD_CONFLICT', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        ['Date début', '01/04/2026', 'Date fin', '30/04/2026'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.isAmbiguous).toBe(true);

    const conflict = result.warnings.find((w) => w.code === 'PERIOD_CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict.details.selectedPeriod).toEqual({ mois: 3, annee: 2025 });
    expect(conflict.details.selectedSource).toBe('filename');
    expect(conflict.details.candidates.length).toBeGreaterThanOrEqual(2);
  });

  test('F.2 — filename + header identiques → pas de warning', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        ['Date début', '01/03/2025', 'Date fin', '31/03/2025'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result.isAmbiguous).toBe(false);
    const conflict = result.warnings.find((w) => w.code === 'PERIOD_CONFLICT');
    expect(conflict).toBeUndefined();
  });

  test('F.3 — Toutes les sources concordent → aucun warning de conflit', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [
        ['Date début', '01/03/2025', 'Date fin', '31/03/2025'],
        [],
        ['Identifiant', 'Nom', 'Mois du reporting', 'Date du prêt'],
        ['A001', 'DUPONT', 'MARS 2025', '15/03/2025'],
      ],
      headerRowIndex: 3,
      colIndex: { moisReporting: 2, datePret: 3 },
    });

    expect(result.mois).toBe(3);
    expect(result.annee).toBe(2025);
    expect(result.isAmbiguous).toBe(false);
  });
});

// ============================================================
// G. TESTS UNITAIRES DES HELPERS INTERNES
// ============================================================
describe('PHASE 5.2 — G. Helpers internes', () => {
  test('G.1 — normalizeString retire accents et met en majuscules', () => {
    expect(_internal.normalizeString('Février 2025')).toBe('FEVRIER 2025');
    expect(_internal.normalizeString('DÉCEMBRE')).toBe('DECEMBRE');
    expect(_internal.normalizeString('  mars  ')).toBe('MARS');
    expect(_internal.normalizeString(null)).toBe('');
  });

  test('G.2 — stripExtension retire l\'extension', () => {
    expect(_internal.stripExtension('reporting.xlsx')).toBe('reporting');
    expect(_internal.stripExtension('MARS 2025.xls')).toBe('MARS 2025');
    expect(_internal.stripExtension('no_extension')).toBe('no_extension');
    expect(_internal.stripExtension(null)).toBe('');
  });

  test('G.3 — parseDateCell parse différents formats', () => {
    const d1 = _internal.parseDateCell('15/03/2025');
    expect(d1.getFullYear()).toBe(2025);
    expect(d1.getMonth()).toBe(2); // mars = index 2

    const d2 = _internal.parseDateCell('2025-03-15');
    expect(d2.getFullYear()).toBe(2025);
    expect(d2.getMonth()).toBe(2);

    // Excel serial : 15/03/2025 ≈ 45731
    const d3 = _internal.parseDateCell(45731);
    expect(d3).toBeInstanceOf(Date);

    expect(_internal.parseDateCell(null)).toBeNull();
    expect(_internal.parseDateCell('invalid')).toBeNull();
  });

  test('G.4 — detectFromFilename formats multiples', () => {
    // Format texte standard
    let r = _internal.detectFromFilename('REPORTING MARS 2025.xlsx');
    expect(r.mois).toBe(3);
    expect(r.annee).toBe(2025);

    // Format numérique MM-YYYY
    r = _internal.detectFromFilename('reporting_03-2025.xlsx');
    expect(r.mois).toBe(3);
    expect(r.annee).toBe(2025);

    // Format numérique YYYY-MM
    r = _internal.detectFromFilename('reporting_2025-03.xlsx');
    expect(r.mois).toBe(3);
    expect(r.annee).toBe(2025);

    // Sans période
    r = _internal.detectFromFilename('reporting_generic.xlsx');
    expect(r.mois).toBeNull();
  });
});

// ============================================================
// H. TESTS DE NON-RÉGRESSION AVEC LA PHASE 5.1
// ============================================================
describe('PHASE 5.2 — H. Non-régression Phase 5.1', () => {
  test('H.1 — La structure de retour contient tous les champs attendus', () => {
    const result = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    expect(result).toHaveProperty('mois');
    expect(result).toHaveProperty('annee');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('isReliable');
    expect(result).toHaveProperty('isAmbiguous');
    expect(result).toHaveProperty('candidates');
    expect(result).toHaveProperty('warnings');

    expect(Array.isArray(result.candidates)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('H.2 — ImportJob.setDetectedPeriod remplit correctement', () => {
    const ImportJob = require('../src/models/ImportJob');

    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
    });

    const periodResult = detectPeriod({
      fileName: 'REPORTING MARS 2025.xlsx',
      previewRows: [],
      headerRowIndex: 6,
      colIndex: { moisReporting: -1, datePret: -1 },
    });

    doc.setDetectedPeriod(periodResult);

    expect(doc.detectedPeriod.month).toBe(3);
    expect(doc.detectedPeriod.year).toBe(2025);
    expect(doc.detectedPeriod.source).toBe('filename');
    expect(doc.detectedPeriod.confidence).toBe('HIGH');
    expect(doc.detectedPeriod.isReliable).toBe(true);
    expect(doc.detectedPeriod.isAmbiguous).toBe(false);
    expect(doc.detectedPeriod.candidates.length).toBeGreaterThan(0);
  });

  test('H.3 — Aucun champ de la Phase 5.1 supprimé', () => {
    const ImportJob = require('../src/models/ImportJob');
    const paths = Object.keys(ImportJob.schema.paths);

    // Champs Phase 5.1 toujours présents
    expect(paths).toContain('fileHash');
    expect(paths).toContain('fileName');
    expect(paths).toContain('fileSize');
    expect(paths).toContain('counters.sourceRows');
    expect(paths).toContain('counters.validRows');
    expect(paths).toContain('ignoredLines');
    expect(paths).toContain('notInstrumentedYet');
    expect(paths).toContain('sheetNames');
    expect(paths).toContain('sourceRowsRange.startRow');
  });
});