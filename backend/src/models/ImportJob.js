// backend/src/models/ImportJob.js
const mongoose = require('mongoose');

/**
 * 📥 ImportJob — Journal d'import de fichier Excel
 *
 * Rôle (Phase 5.1 + 5.2 + 5.3) :
 *   - Tracer chaque import de fichier Excel
 *   - Conserver les compteurs réels du traitement
 *   - Identifier le fichier par son hash (SHA-256)
 *   - Stocker la période détectée AVEC traçabilité complète
 *   - Journaliser les anomalies sans masquer les erreurs
 *   - Tracer individuellement chaque ligne ignorée
 *   - ⚡ Phase 5.3 : gérer le cycle de vie ACTIVE/SUPERSEDED et le versioning
 */
const ImportJobSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. IDENTIFICATION DU FICHIER
    // ============================================================
    fileHash: {
      type: String,
      trim: true,
      default: null,
    },
    fileName: {
      type: String,
      trim: true,
      required: [true, 'Le nom du fichier est obligatoire'],
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // 2. RÉFÉRENCES MÉTIER
    // ============================================================
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
      default: null,
      index: true,
    },
    contratId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contrat',
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'utilisateur ayant lancé l'import est obligatoire"],
    },
    reportingMensuelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingMensuel',
      default: null,
    },

    // ============================================================
    // 3. PÉRIODE DÉTECTÉE
    // ============================================================
    detectedPeriod: {
      month: { type: Number, min: 1, max: 12, default: null },
      year: { type: Number, default: null },
      source: {
        type: String,
        enum: [
          'user-provided',
          'filename',
          'sheet-header',
          'content',
          'legacy',
          'none',
          'PENDING',
        ],
        default: 'PENDING',
      },
      confidence: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        default: 'LOW',
      },
      isReliable: { type: Boolean, default: false },
      isAmbiguous: { type: Boolean, default: false },
      candidates: [
        {
          month: Number,
          year: Number,
          source: String,
          confidence: String,
        },
      ],
      warnings: [
        {
          code: { type: String, trim: true },
          message: { type: String, trim: true },
          severity: {
            type: String,
            enum: ['INFO', 'WARNING', 'ERROR'],
            default: 'WARNING',
          },
          details: { type: mongoose.Schema.Types.Mixed, default: null },
          date: { type: Date, default: Date.now },
        },
      ],
    },

    // ============================================================
    // 4. STATUT GLOBAL
    // ============================================================
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0, min: 0 },

    // ============================================================
    // 5. COMPTEURS
    // ============================================================
    counters: {
      sourceRows: { type: Number, default: 0, min: 0 },
      processedRows: { type: Number, default: 0, min: 0 },
      validRows: { type: Number, default: 0, min: 0 },
      excludedRows: { type: Number, default: 0, min: 0 },
      ignoredRows: { type: Number, default: 0, min: 0 },
      errorRows: { type: Number, default: 0, min: 0 },
      duplicateRows: { type: Number, default: 0, min: 0 },
      invalidRows: { type: Number, default: 0, min: 0 },
    },

    notInstrumentedYet: {
      type: [String],
      default: [],
    },

    // ============================================================
    // 6. TRAÇABILITÉ DES LIGNES IGNORÉES
    // ============================================================
    ignoredLines: [
      {
        sourceRowNumber: { type: Number, required: true },
        sheetName: { type: String, trim: true, default: null },
        reason: {
          type: String,
          enum: ['EMPTY_ROW', 'MISSING_NAME', 'NO_VALUES', 'OUT_OF_RANGE', 'OTHER'],
          default: 'OTHER',
        },
        rawData: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    // ============================================================
    // 7. ANOMALIES
    // ============================================================
    anomalies: [
      {
        code: { type: String, trim: true },
        message: { type: String, trim: true },
        severity: {
          type: String,
          enum: ['INFO', 'WARNING', 'ERROR'],
          default: 'WARNING',
        },
        rowNumber: { type: Number, default: null },
        date: { type: Date, default: Date.now },
      },
    ],

    // ============================================================
    // 8. TRACABILITÉ TECHNIQUE
    // ============================================================
    sheetNames: { type: [String], default: [] },

    sourceRowsRange: {
      startRow: { type: Number, default: null },
      endRow: { type: Number, default: null },
      sheetUsed: { type: String, trim: true, default: null },
    },

    errorMessage: { type: String, trim: true, default: null },

    // ============================================================
    // 9. 🔹 PHASE 5.3 — CYCLE DE VIE ET VERSIONING
    // ============================================================

    // Cycle de vie du job
    //   ACTIVE     : import actif, non remplacé
    //   SUPERSEDED : remplacé par un import plus récent
    //   REPLACED   : a remplacé un import plus ancien (info symétrique)
    //   FAILED     : import échoué
    lifecycle: {
      type: String,
      enum: ['ACTIVE', 'SUPERSEDED', 'REPLACED', 'FAILED'],
      default: 'ACTIVE',
      index: true,
    },

    // Chaînage de remplacement
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportJob',
      default: null,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportJob',
      default: null,
    },

    // Numéro de version logique pour une période {institution, month, year}
    versionNumber: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Traçabilité de la demande de remplacement
    forceReplaceRequested: {
      type: Boolean,
      default: false,
    },
    replacementReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEX
// ============================================================

// ⚠️ Conservation de l'index unique existant (Phase 5.1)
ImportJobSchema.index(
  {
    fileHash: 1,
    institutionId: 1,
    'detectedPeriod.month': 1,
    'detectedPeriod.year': 1,
  },
  {
    unique: true,
    sparse: true,
    name: 'unique_import_by_file_period',
  }
);

ImportJobSchema.index({ status: 1, startedAt: -1 });
ImportJobSchema.index({ uploadedBy: 1, startedAt: -1 });

// 🔹 Phase 5.3 — Index de chaînage
ImportJobSchema.index({ supersedes: 1 }, { sparse: true, name: 'supersedes_idx' });
ImportJobSchema.index({ supersededBy: 1 }, { sparse: true, name: 'supersededBy_idx' });

// 🔹 Phase 5.3 — Index pour récupérer la dernière version d'une période
ImportJobSchema.index(
  {
    institutionId: 1,
    'detectedPeriod.month': 1,
    'detectedPeriod.year': 1,
    versionNumber: -1,
  },
  { name: 'version_by_period' }
);

// 🔹 Phase 5.3 — Listing des imports actifs par institution
ImportJobSchema.index({ institutionId: 1, lifecycle: 1, createdAt: -1 });

// ============================================================
// VIRTUALS
// ============================================================
ImportJobSchema.virtual('isCompleted').get(function () {
  return this.status === 'COMPLETED' || this.status === 'PARTIAL';
});

ImportJobSchema.virtual('isFailed').get(function () {
  return this.status === 'FAILED';
});

ImportJobSchema.virtual('hasAnomalies').get(function () {
  return Array.isArray(this.anomalies) && this.anomalies.length > 0;
});

ImportJobSchema.virtual('sumOfStatuses').get(function () {
  if (!this.counters) return 0;
  const c = this.counters;
  return (
    (c.validRows || 0) +
    (c.excludedRows || 0) +
    (c.ignoredRows || 0) +
    (c.errorRows || 0) +
    (c.duplicateRows || 0) +
    (c.invalidRows || 0)
  );
});

ImportJobSchema.virtual('isActive').get(function () {
  return this.lifecycle === 'ACTIVE';
});

ImportJobSchema.virtual('isSuperseded').get(function () {
  return this.lifecycle === 'SUPERSEDED';
});

// ============================================================
// MÉTHODES
// ============================================================
ImportJobSchema.methods.addAnomaly = function (
  code,
  message,
  severity = 'WARNING',
  rowNumber = null
) {
  this.anomalies.push({ code, message, severity, rowNumber, date: new Date() });
  return this;
};

ImportJobSchema.methods.addIgnoredLine = function (
  sourceRowNumber,
  sheetName,
  reason,
  rawData = null
) {
  this.ignoredLines.push({ sourceRowNumber, sheetName, reason, rawData });
  return this;
};

ImportJobSchema.methods.setDetectedPeriod = function (periodResult) {
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
    warnings: (periodResult.warnings || []).map((w) => ({
      code: w.code,
      message: w.message,
      severity: w.severity || 'WARNING',
      details: w.details || null,
      date: new Date(),
    })),
  };
  return this;
};

ImportJobSchema.methods.markRunning = function () {
  this.status = 'RUNNING';
  this.startedAt = new Date();
  return this;
};

ImportJobSchema.methods.markCompleted = function () {
  this.status = this.counters && this.counters.errorRows > 0 ? 'PARTIAL' : 'COMPLETED';
  this.completedAt = new Date();
  this.durationMs = this.startedAt ? this.completedAt - this.startedAt : 0;
  return this;
};

ImportJobSchema.methods.markFailed = function (errorMessage) {
  this.status = 'FAILED';
  this.lifecycle = 'FAILED';
  this.errorMessage = errorMessage || 'Erreur inconnue';
  this.completedAt = new Date();
  this.durationMs = this.startedAt ? this.completedAt - this.startedAt : 0;
  return this;
};

// 🔹 Phase 5.3
ImportJobSchema.methods.markSuperseded = function (supersededById) {
  this.lifecycle = 'SUPERSEDED';
  this.supersededBy = supersededById;
  return this;
};

ImportJobSchema.methods.markReplaced = function (supersedesId) {
  this.lifecycle = 'REPLACED';
  this.supersedes = supersedesId;
  return this;
};

module.exports =
  mongoose.models.ImportJob || mongoose.model('ImportJob', ImportJobSchema);