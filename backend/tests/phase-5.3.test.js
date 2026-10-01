// backend/__tests__/phase-5.3.test.js
/**
 * 🧪 Tests Phase 5.3 — Idempotence et gestion des réimports
 *
 * ⚠️ Tests unitaires purs avec mocks Jest.
 *    Aucune connexion MongoDB requise.
 */

// ============================================================
// MOCKS DES MODÈLES
// ============================================================

// Helper : construit une chaîne fluide Mongoose-like
const createQueryMock = (resolvedValue) => {
  const query = {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolvedValue),
    exec: jest.fn().mockResolvedValue(resolvedValue),
    // Support du await direct sur la query (retourne resolvedValue)
    then: (onFulfilled) => Promise.resolve(resolvedValue).then(onFulfilled),
  };
  return query;
};

// --- Mock ImportJob ---
jest.mock('../src/models/ImportJob', () => {
  const mongoose = require('mongoose');

  // Modèle mocké : à la fois constructeur ET objet avec méthodes statiques
  const MockImportJob = function (data) {
    Object.assign(this, data);
    this.lifecycle = data.lifecycle || 'ACTIVE';
  };

  // Méthodes d'instance
  MockImportJob.prototype.markSuperseded = function (supersededById) {
    this.lifecycle = 'SUPERSEDED';
    this.supersededBy = supersededById;
    return this;
  };
  MockImportJob.prototype.markReplaced = function (supersedesId) {
    this.lifecycle = 'REPLACED';
    this.supersedes = supersedesId;
    return this;
  };
  MockImportJob.prototype.markFailed = function (errorMessage) {
    this.status = 'FAILED';
    this.lifecycle = 'FAILED';
    this.errorMessage = errorMessage || 'Erreur inconnue';
    return this;
  };
  MockImportJob.prototype.markCompleted = function () {
    this.status = 'COMPLETED';
    return this;
  };
  MockImportJob.prototype.markRunning = function () {
    this.status = 'RUNNING';
    return this;
  };
  MockImportJob.prototype.addAnomaly = function (code, message, severity = 'WARNING', rowNumber = null) {
    if (!this.anomalies) this.anomalies = [];
    this.anomalies.push({ code, message, severity, rowNumber, date: new Date() });
    return this;
  };
  MockImportJob.prototype.addIgnoredLine = function (sourceRowNumber, sheetName, reason, rawData = null) {
    if (!this.ignoredLines) this.ignoredLines = [];
    this.ignoredLines.push({ sourceRowNumber, sheetName, reason, rawData });
    return this;
  };
  MockImportJob.prototype.setDetectedPeriod = function (periodResult) {
    if (!periodResult) return this;
    this.detectedPeriod = {
      month: periodResult.mois,
      year: periodResult.annee,
      source: periodResult.source || 'none',
      confidence: periodResult.confidence || 'LOW',
      isReliable: periodResult.isReliable === true,
      isAmbiguous: periodResult.isAmbiguous === true,
      candidates: (periodResult.candidates || []).map((c) => ({
        month: c.mois,
        year: c.annee,
        source: c.source,
        confidence: c.confidence,
      })),
      warnings: periodResult.warnings || [],
    };
    return this;
  };

  // Accesseurs virtuels simulés
  Object.defineProperty(MockImportJob.prototype, 'isActive', {
    get: function () {
      return this.lifecycle === 'ACTIVE';
    },
  });
  Object.defineProperty(MockImportJob.prototype, 'isSuperseded', {
    get: function () {
      return this.lifecycle === 'SUPERSEDED';
    },
  });

  // Méthodes statiques mockées
  MockImportJob.findOne = jest.fn();
  MockImportJob.findById = jest.fn();
  MockImportJob.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  MockImportJob.countDocuments = jest.fn();
  MockImportJob.create = jest.fn();

  return MockImportJob;
});

// --- Mock ReportingMensuel ---
jest.mock('../src/models/ReportingMensuel', () => {
  const MockReportingMensuel = function (data) {
    Object.assign(this, data);
  };

  MockReportingMensuel.prototype.markSuperseded = function (supersededById) {
    this.lifecycle = 'SUPERSEDED';
    this.supersededBy = supersededById;
    return this;
  };

  MockReportingMensuel.findOne = jest.fn();
  MockReportingMensuel.findById = jest.fn();
  MockReportingMensuel.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  MockReportingMensuel.countDocuments = jest.fn();
  MockReportingMensuel.create = jest.fn();

  return MockReportingMensuel;
});

// --- Mock Adhesion ---
jest.mock('../src/models/Adhesion', () => ({
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
}));

// ============================================================
// IMPORTS APRÈS MOCKS
// ============================================================
const idempotencyService = require('../src/services/idempotencyService');
const { ErrorCodes } = idempotencyService;
const ImportJob = require('../src/models/ImportJob');
const ReportingMensuel = require('../src/models/ReportingMensuel');

// ============================================================
// HELPER : configure findOne pour retourner une chaîne de valeurs
// ============================================================
const setupFindOne = (values) => {
  // values : tableau de valeurs (dans l'ordre des appels findOne)
  let callIndex = 0;
  ImportJob.findOne.mockImplementation(() => {
    const value = values[callIndex] !== undefined ? values[callIndex] : null;
    callIndex++;
    return createQueryMock(value);
  });
};

// ============================================================
// TESTS — analyzeImport
// ============================================================
describe('PHASE 5.3 — analyzeImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('U1 — Détecte absence de fileHash → BLOCK + FILE_HASH_UNAVAILABLE', async () => {
    const result = await idempotencyService.analyzeImport({
      fileHash: null,
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: false,
    });

    expect(result.action).toBe('BLOCK');
    expect(result.errorCode).toBe(ErrorCodes.FILE_HASH_UNAVAILABLE);
    expect(result.reason).toContain('hash');
  });

  test('U2 — Aucun import existant → CREATE + version 1', async () => {
    // 4 appels findOne : duplicate, hashOnly, byPeriod, computeVersion
    setupFindOne([null, null, null, null]);

    const result = await idempotencyService.analyzeImport({
      fileHash: 'abc123',
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: false,
    });

    expect(result.action).toBe('CREATE');
    expect(result.versionNumber).toBe(1);
    expect(result.errorCode).toBeNull();
  });

  test('U3 — Doublon exact (hash+période) → BLOCK + DUPLICATE_FILE', async () => {
    setupFindOne([
      {
        _id: 'job1',
        fileHash: 'abc123',
        versionNumber: 1,
        detectedPeriod: { month: 3, year: 2025 },
        fileName: 'file.xlsx',
      },
    ]);

    const result = await idempotencyService.analyzeImport({
      fileHash: 'abc123',
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: false,
    });

    expect(result.action).toBe('BLOCK');
    expect(result.errorCode).toBe(ErrorCodes.DUPLICATE_FILE);
    expect(result.existingJob._id).toBe('job1');
  });

  test('U4 — Doublon exact + forceReplace → CREATE_WITH_REPLACE + version 2', async () => {
    setupFindOne([
      // findDuplicateByHash
      {
        _id: 'job1',
        versionNumber: 1,
        detectedPeriod: { month: 3, year: 2025 },
      },
      // computeVersionNumber (dans analyzeImport)
      { versionNumber: 1 },
    ]);

    const result = await idempotencyService.analyzeImport({
      fileHash: 'abc123',
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: true,
    });

    expect(result.action).toBe('CREATE_WITH_REPLACE');
    expect(result.versionNumber).toBe(2);
    expect(result.existingJob._id).toBe('job1');
  });

  test('U5 — Même hash, période différente → BLOCK + PERIOD_CONFLICT', async () => {
    setupFindOne([
      // findDuplicateByHash : null
      null,
      // findExistingByHashOnly : trouve un import en 03/2026
      {
        _id: 'oldJob',
        detectedPeriod: { month: 3, year: 2026 },
      },
    ]);

    const result = await idempotencyService.analyzeImport({
      fileHash: 'abc123',
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: false,
    });

    expect(result.action).toBe('BLOCK');
    expect(result.errorCode).toBe(ErrorCodes.PERIOD_CONFLICT);
    expect(result.reason).toContain('déjà été importé');
  });

  test('U6 — Fichier différent, même période, sans force → BLOCK + PERIOD_CONFLICT', async () => {
    setupFindOne([
      // findDuplicateByHash : null
      null,
      // findExistingByHashOnly : null
      null,
      // findExistingByPeriod : trouve
      {
        _id: 'oldJob',
        fileName: 'old.xlsx',
        versionNumber: 1,
      },
    ]);

    const result = await idempotencyService.analyzeImport({
      fileHash: 'different_hash',
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: false,
    });

    expect(result.action).toBe('BLOCK');
    expect(result.errorCode).toBe(ErrorCodes.PERIOD_CONFLICT);
    expect(result.conflictingJob._id).toBe('oldJob');
  });

  test('U7 — Fichier différent, même période, avec force → CREATE_WITH_REPLACE', async () => {
    setupFindOne([
      null, // duplicate
      null, // hashOnly
      { _id: 'oldJob', versionNumber: 1 }, // byPeriod
      { versionNumber: 1 }, // computeVersion
    ]);

    const result = await idempotencyService.analyzeImport({
      fileHash: 'different_hash',
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
      forceReplace: true,
    });

    expect(result.action).toBe('CREATE_WITH_REPLACE');
    expect(result.versionNumber).toBe(2);
  });
});

// ============================================================
// TESTS — computeVersionNumber
// ============================================================
describe('PHASE 5.3 — computeVersionNumber', () => {
  beforeEach(() => jest.clearAllMocks());

  test('U8 — Aucun import antérieur → version 1', async () => {
    setupFindOne([null]);

    const version = await idempotencyService.computeVersionNumber({
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
    });

    expect(version).toBe(1);
  });

  test('U9 — Import v1 existant → version 2', async () => {
    setupFindOne([{ versionNumber: 1 }]);

    const version = await idempotencyService.computeVersionNumber({
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
    });

    expect(version).toBe(2);
  });

  test('U10 — Import v2 existant → version 3', async () => {
    setupFindOne([{ versionNumber: 2 }]);

    const version = await idempotencyService.computeVersionNumber({
      institutionId: 'sfd1',
      month: 3,
      year: 2025,
    });

    expect(version).toBe(3);
  });
});

// ============================================================
// TESTS — linkImportJobs
// ============================================================
describe('PHASE 5.3 — linkImportJobs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('U11 — Chaînage symétrique correct', async () => {
    ImportJob.updateOne.mockResolvedValue({ modifiedCount: 1 });
    // findById est appelé pour vérification symétrie
    ImportJob.findById
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ supersedes: 'oldJob' }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ supersededBy: 'newJob' }),
        }),
      });

    await idempotencyService.linkImportJobs('newJob', 'oldJob');

    expect(ImportJob.updateOne).toHaveBeenCalledTimes(2);
    expect(ImportJob.updateOne).toHaveBeenCalledWith(
      { _id: 'oldJob' },
      expect.objectContaining({
        lifecycle: 'SUPERSEDED',
        supersededBy: 'newJob',
      }),
      expect.any(Object)
    );
    expect(ImportJob.updateOne).toHaveBeenCalledWith(
      { _id: 'newJob' },
      expect.objectContaining({
        supersedes: 'oldJob',
      }),
      expect.any(Object)
    );
  });

  test('U12 — Rejette si IDs manquants', async () => {
    await expect(idempotencyService.linkImportJobs(null, 'oldJob')).rejects.toThrow();
    await expect(idempotencyService.linkImportJobs('newJob', null)).rejects.toThrow();
  });
});

// ============================================================
// TESTS — buildErrorResponse
// ============================================================
describe('PHASE 5.3 — buildErrorResponse', () => {
  test('U13 — DUPLICATE_FILE → 409', () => {
    const res = idempotencyService.buildErrorResponse(
      ErrorCodes.DUPLICATE_FILE,
      { _id: 'job1', fileName: 'x.xlsx', versionNumber: 1 },
      'Doublon'
    );
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('DUPLICATE_FILE');
  });

  test('U14 — PERIOD_CONFLICT → 409', () => {
    const res = idempotencyService.buildErrorResponse(
      ErrorCodes.PERIOD_CONFLICT,
      { _id: 'job1' },
      'Conflit'
    );
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('PERIOD_CONFLICT');
  });

  test('U15 — FILE_HASH_UNAVAILABLE → 422', () => {
    const res = idempotencyService.buildErrorResponse(
      ErrorCodes.FILE_HASH_UNAVAILABLE,
      null,
      'Hash indisponible'
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('FILE_HASH_UNAVAILABLE');
  });

  test('U16 — IMPORT_IN_PROGRESS → 423', () => {
    const res = idempotencyService.buildErrorResponse(
      ErrorCodes.IMPORT_IN_PROGRESS,
      null,
      'En cours'
    );
    expect(res.statusCode).toBe(423);
    expect(res.body.error).toBe('IMPORT_IN_PROGRESS');
  });
});

// ============================================================
// TESTS — Cycle de vie sur ImportJob
// ============================================================
describe('PHASE 5.3 — ImportJob lifecycle', () => {
  test('U17 — markSuperseded positionne correctement', () => {
    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
    });

    doc.markSuperseded('newJobId');

    expect(doc.lifecycle).toBe('SUPERSEDED');
    expect(doc.supersededBy).toBe('newJobId');
  });

  test('U18 — markReplaced positionne correctement', () => {
    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
    });

    doc.markReplaced('oldJobId');

    expect(doc.lifecycle).toBe('REPLACED');
    expect(doc.supersedes).toBe('oldJobId');
  });

  test('U19 — markFailed positionne lifecycle=FAILED', () => {
    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
    });

    doc.markFailed('Erreur test');

    expect(doc.status).toBe('FAILED');
    expect(doc.lifecycle).toBe('FAILED');
    expect(doc.errorMessage).toBe('Erreur test');
  });

  test('U20 — isActive / isSuperseded cohérents', () => {
    const doc = new ImportJob({
      fileName: 'test.xlsx',
      uploadedBy: '507f1f77bcf86cd799439011',
      lifecycle: 'ACTIVE',
    });

    expect(doc.isActive).toBe(true);
    expect(doc.isSuperseded).toBe(false);

    doc.lifecycle = 'SUPERSEDED';
    expect(doc.isActive).toBe(false);
    expect(doc.isSuperseded).toBe(true);
  });
});

// ============================================================
// TESTS — ReportingMensuel lifecycle
// ============================================================
describe('PHASE 5.3 — ReportingMensuel lifecycle', () => {
  test('U21 — markSuperseded positionne correctement', () => {
    const doc = new ReportingMensuel({
      sfdId: 'sfd1',
      contratId: 'contrat1',
      mois: 3,
      annee: 2025,
      dateDebut: new Date(2025, 2, 1),
      dateFin: new Date(2025, 2, 31),
      creePar: 'user1',
      lifecycle: 'ACTIVE',
    });

    doc.markSuperseded('newReportingId');

    expect(doc.lifecycle).toBe('SUPERSEDED');
    expect(doc.supersededBy).toBe('newReportingId');
  });
});