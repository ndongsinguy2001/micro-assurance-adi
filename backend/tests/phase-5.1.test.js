// backend/__tests__/phase-5.1.test.js
// ⚠️ Nécessite : npm install --save-dev jest

const path = require('path');
const fs = require('fs');
const os = require('os');

const fileHashService = require('../src/services/fileHashService');
const importStatsService = require('../src/services/importStatsService');

// ============================================================
//  fileHashService
// ============================================================
describe('PHASE 5.1 — fileHashService', () => {
  test('T5.1.3 — Hash stable sur un même fichier', async () => {
    const tmpFile = path.join(os.tmpdir(), `test-hash-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'contenu de test stable');

    const h1 = await fileHashService.computeFileHash(tmpFile);
    const h2 = await fileHashService.computeFileHash(tmpFile);

    expect(h1).toBeTruthy();
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);

    fs.unlinkSync(tmpFile);
  });

  test('T5.1.4 — Hash différent sur deux fichiers distincts', async () => {
    const f1 = path.join(os.tmpdir(), `test-hash-A-${Date.now()}.txt`);
    const f2 = path.join(os.tmpdir(), `test-hash-B-${Date.now()}.txt`);
    fs.writeFileSync(f1, 'contenu A');
    fs.writeFileSync(f2, 'contenu B');

    const h1 = await fileHashService.computeFileHash(f1);
    const h2 = await fileHashService.computeFileHash(f2);

    expect(h1).not.toBe(h2);

    fs.unlinkSync(f1);
    fs.unlinkSync(f2);
  });

  test('T5.1.5 — Hash sur fichier absent renvoie null sans exception', async () => {
    const h = await fileHashService.computeFileHash('/chemin/inexistant/fichier.xlsx');
    expect(h).toBeNull();
  });
});

// ============================================================
//  importStatsService — Compteurs et cohérence
// ============================================================
describe('PHASE 5.1 — importStatsService (compteurs)', () => {
  test('T5.1.6 — Compteurs cohérents (valid + excluded + ignored + error)', () => {
    const c = importStatsService.createCounters();
    c.sourceRows = 1568;
    c.processedRows = 1538;
    c.validRows = 1420;
    c.excludedRows = 100;
    c.ignoredRows = 30;
    c.errorRows = 18;

    const r = importStatsService.assertCoherence(c);
    expect(r.coherent).toBe(true);
    expect(r.delta).toBe(0);
  });

  test('T5.1.7 — Compteurs incohérents sur sourceRows (delta détecté)', () => {
    const c = importStatsService.createCounters();
    c.sourceRows = 1568;
    c.processedRows = 1538;
    c.validRows = 1420;
    c.excludedRows = 100;
    c.ignoredRows = 30;
    c.errorRows = 18;

    // On force un sourceRows incohérent
    c.sourceRows = 1600;

    const r = importStatsService.assertCoherence(c);
    expect(r.coherent).toBe(false);
    expect(r.delta).toBe(32);
    expect(r.message).toContain('sourceRows');
  });

  test('T5.1.8 — Compteurs vides cohérents', () => {
    const c = importStatsService.createCounters();
    const r = importStatsService.assertCoherence(c);
    expect(r.coherent).toBe(true);
  });

  test('Test C — sourceRows est INDÉPENDANT des autres compteurs', () => {
    const c = importStatsService.createCounters();
    importStatsService.setSourceRows(c, 1568);

    importStatsService.incrementCounter(c, 'validRows', 100);
    importStatsService.incrementCounter(c, 'excludedRows', 50);

    expect(c.sourceRows).toBe(1568);
    expect(c.validRows).toBe(100);
    expect(c.excludedRows).toBe(50);
  });

  test('Test D — Détection d\'écart entre sourceRows et somme des statuts', () => {
    const c = importStatsService.createCounters();
    c.sourceRows = 1568;
    c.processedRows = 1500;
    c.validRows = 1400;
    c.excludedRows = 100;
    c.ignoredRows = 30;
    c.errorRows = 0;

    const r = importStatsService.assertCoherence(c);
    expect(r.coherent).toBe(false);
    // delta = 1568 - (1400+100+30+0) = 38
    expect(r.delta).toBe(38);
  });

  test('Test F — Import complet : sourceRows = valid + excluded + ignored + error', () => {
    const c = importStatsService.createCounters();
    c.sourceRows = 1568;
    c.processedRows = 1538;
    c.validRows = 1420;
    c.excludedRows = 100;
    c.ignoredRows = 30;
    c.errorRows = 18;

    const r = importStatsService.assertCoherence(c);
    expect(r.coherent).toBe(true);

    const sum = c.validRows + c.excludedRows + c.ignoredRows + c.errorRows;
    expect(sum).toBe(c.sourceRows);
  });

  test('incrementCounter — clé inconnue rejette', () => {
    const c = importStatsService.createCounters();
    expect(() => importStatsService.incrementCounter(c, 'foo')).toThrow();
  });

  test('setSourceRows — valeur négative rejette', () => {
    const c = importStatsService.createCounters();
    expect(() => importStatsService.setSourceRows(c, -1)).toThrow();
  });

  test('getNotInstrumentedCounters — renvoie les 2 compteurs', () => {
    const arr = importStatsService.getNotInstrumentedCounters();
    expect(arr).toEqual(['duplicateRows', 'invalidRows']);
  });
});

// ============================================================
//  analyzeInsertManyError — Test E
// ============================================================
describe('PHASE 5.1 — analyzeInsertManyError (Test E)', () => {
  test('Test E.1 — Erreur partielle avec insertedDocs → traçabilité exacte', () => {
    const err = new Error('E11000 duplicate key');
    err.insertedDocs = [{ _id: 'a' }, { _id: 'b' }];
    err.writeErrors = [{ index: 2, errmsg: 'duplicate' }];

    const r = importStatsService.analyzeInsertManyError(err, 5);
    expect(r.isExact).toBe(true);
    expect(r.insertedCount).toBe(2);
    expect(r.errorCount).toBe(3);
  });

  test('Test E.2 — Erreur avec writeErrors uniquement', () => {
    const err = new Error('bulk error');
    err.writeErrors = [
      { index: 0, errmsg: 'e1' },
      { index: 3, errmsg: 'e2' },
    ];

    const r = importStatsService.analyzeInsertManyError(err, 10);
    expect(r.isExact).toBe(true);
    expect(r.insertedCount).toBe(8);
    expect(r.errorCount).toBe(2);
    expect(r.details.method).toBe('writeErrors');
  });

  test('Test E.3 — Fallback documenté si aucune information fine', () => {
    const err = new Error('opaque error');

    const r = importStatsService.analyzeInsertManyError(err, 10);
    expect(r.isExact).toBe(false);
    expect(r.insertedCount).toBe(0);
    expect(r.errorCount).toBe(10);
    expect(r.details.warning).toContain('Impossible de distinguer');
  });
});

// ============================================================
//  Test A / B — Traçabilité des lignes ignorées
// ============================================================
describe('PHASE 5.1 — Traçabilité des lignes ignorées', () => {
  test('Test A — Ligne vide comptée comme IGNORED avec traçabilité', () => {
    const ImportJob = require('../src/models/ImportJob');

    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
      counters: importStatsService.createCounters(),
      ignoredLines: [],
    });

    doc.addIgnoredLine(124, 'Mensuel OK', 'EMPTY_ROW', { col_0: '', col_1: '' });

    expect(doc.ignoredLines.length).toBe(1);
    expect(doc.ignoredLines[0].sourceRowNumber).toBe(124);
    expect(doc.ignoredLines[0].reason).toBe('EMPTY_ROW');
    expect(doc.ignoredLines[0].sheetName).toBe('Mensuel OK');
  });

  test('Test B — Ligne sans nom comptée comme IGNORED avec traçabilité', () => {
    const ImportJob = require('../src/models/ImportJob');

    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
      counters: importStatsService.createCounters(),
      ignoredLines: [],
    });

    doc.addIgnoredLine(251, 'Mensuel OK', 'MISSING_NAME', { col_2: '   ' });

    expect(doc.ignoredLines.length).toBe(1);
    expect(doc.ignoredLines[0].sourceRowNumber).toBe(251);
    expect(doc.ignoredLines[0].reason).toBe('MISSING_NAME');
  });
});