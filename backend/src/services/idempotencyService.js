// backend/src/services/idempotencyService.js
/**
 * 🔒 Service d'idempotence et de gestion des réimports
 *
 * Rôle (Phase 5.3) :
 *   - Détecter les doublons de fichiers (fileHash)
 *   - Détecter les conflits de période (même institution + période)
 *   - Calculer le numéro de version d'un import
 *   - Gérer les chaînages supersedes / supersededBy
 *   - Détecter les race conditions
 *
 * ============================================================
 * CAS MÉTIER
 * ============================================================
 *
 *   CAS 1 — Même fichier (hash identique) + même période
 *           → HTTP 409 DUPLICATE_FILE
 *           → forceReplace=true crée une nouvelle version
 *
 *   CAS 2 — Fichier différent (hash différent) + même période
 *           → HTTP 409 PERIOD_CONFLICT
 *           → forceReplace=true crée une nouvelle version + SUPERSEDED
 *
 *   CAS 3 — Fichier corrigé (réimport volontaire)
 *           → Cas 1 ou 2 avec forceReplace=true
 *           → Nouvelle version + chaînage
 *
 *   CAS 4 — Même hash, période différente
 *           → HTTP 409 PERIOD_CONFLICT
 *
 *   CAS 5 — Ancien import erroné (périodes différentes)
 *           → Création normale
 *           → Aucun lien automatique
 *
 *   CAS 6 — Premier import
 *           → Création normale (versionNumber = 1)
 *
 *   CAS 7 — Import concurrent
 *           → Détection via contrainte unique MongoDB
 *
 * ============================================================
 * CODES D'ERREUR
 * ============================================================
 *
 *   DUPLICATE_FILE              Le même fichier (hash) + même période existe déjà
 *   PERIOD_CONFLICT             Un autre import existe pour la même période
 *   FILE_HASH_UNAVAILABLE       Impossible de calculer le hash du fichier
 *   IMPORT_IN_PROGRESS          Un import est en cours (verrou)
 *   CONCURRENT_MODIFICATION     Race condition détectée
 */

const ImportJob = require('../models/ImportJob');
const ReportingMensuel = require('../models/ReportingMensuel');

// ============================================================
// CODES D'ERREUR
// ============================================================

const ErrorCodes = {
  DUPLICATE_FILE: 'DUPLICATE_FILE',
  PERIOD_CONFLICT: 'PERIOD_CONFLICT',
  FILE_HASH_UNAVAILABLE: 'FILE_HASH_UNAVAILABLE',
  IMPORT_IN_PROGRESS: 'IMPORT_IN_PROGRESS',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
};

// ============================================================
// DÉTECTION DE DOUBLONS
// ============================================================

/**
 * Détecte un import existant par hash + période.
 *
 * ⚠️ Cas 1 : même fichier + même période
 *
 * @param {Object} params
 * @param {string} params.fileHash
 * @param {ObjectId} params.institutionId
 * @param {number} params.month
 * @param {number} params.year
 * @returns {Promise<ImportJob|null>}
 */
const findDuplicateByHash = async ({ fileHash, institutionId, month, year }) => {
  if (!fileHash) return null;

  return ImportJob.findOne({
    fileHash,
    institutionId,
    'detectedPeriod.month': month,
    'detectedPeriod.year': year,
    lifecycle: { $in: ['ACTIVE', 'SUPERSEDED'] }, // on conserve tout l'historique
  }).sort({ versionNumber: -1 }); // le plus récent
};

/**
 * Détecte un import existant par période (sans hash).
 *
 * ⚠️ Cas 2 : fichier différent + même période
 *
 * @param {Object} params
 * @param {ObjectId} params.institutionId
 * @param {number} params.month
 * @param {number} params.year
 * @returns {Promise<ImportJob|null>}
 */
const findExistingByPeriod = async ({ institutionId, month, year }) => {
  return ImportJob.findOne({
    institutionId,
    'detectedPeriod.month': month,
    'detectedPeriod.year': year,
    lifecycle: 'ACTIVE', // on cherche l'import ACTIF pour cette période
  }).sort({ versionNumber: -1 });
};

/**
 * Détecte un import existant par hash (peu importe la période).
 *
 * ⚠️ Cas 4 : même hash, période différente
 *
 * @param {Object} params
 * @param {string} params.fileHash
 * @param {ObjectId} params.institutionId
 * @returns {Promise<ImportJob|null>}
 */
const findExistingByHashOnly = async ({ fileHash, institutionId }) => {
  if (!fileHash) return null;

  return ImportJob.findOne({
    fileHash,
    institutionId,
    lifecycle: { $in: ['ACTIVE', 'SUPERSEDED'] },
  }).sort({ versionNumber: -1 });
};

// ============================================================
// CALCUL DE VERSION
// ============================================================

/**
 * Calcule le numéro de version pour un nouvel import.
 *
 * @param {Object} params
 * @param {ObjectId} params.institutionId
 * @param {number} params.month
 * @param {number} params.year
 * @returns {Promise<number>} 1 si aucun import antérieur, N+1 sinon
 */
const computeVersionNumber = async ({ institutionId, month, year }) => {
  const lastVersion = await ImportJob.findOne({
    institutionId,
    'detectedPeriod.month': month,
    'detectedPeriod.year': year,
  })
    .sort({ versionNumber: -1 })
    .select('versionNumber')
    .lean();

  return lastVersion ? (lastVersion.versionNumber || 1) + 1 : 1;
};

// ============================================================
// DÉCISION D'IMPORT
// ============================================================

/**
 * Analyse un nouvel import et retourne la décision.
 *
 * @param {Object} params
 * @param {string} params.fileHash
 * @param {ObjectId} params.institutionId
 * @param {number} params.month
 * @param {number} params.year
 * @param {boolean} params.forceReplace
 * @returns {Promise<{
 *   action: 'CREATE' | 'CREATE_WITH_REPLACE' | 'BLOCK',
 *   errorCode: string|null,
 *   existingJob: ImportJob|null,
 *   conflictingJob: ImportJob|null,
 *   versionNumber: number,
 *   reason: string,
 * }>}
 */
const analyzeImport = async ({
  fileHash,
  institutionId,
  month,
  year,
  forceReplace = false,
}) => {
  // Étape 1 : vérifier que le hash est disponible
  if (!fileHash) {
    return {
      action: 'BLOCK',
      errorCode: ErrorCodes.FILE_HASH_UNAVAILABLE,
      existingJob: null,
      conflictingJob: null,
      versionNumber: null,
      reason: 'Impossible de calculer le hash du fichier',
    };
  }

  // Étape 2 : détection doublon exact (hash + période)
  const duplicateByHash = await findDuplicateByHash({
    fileHash,
    institutionId,
    month,
    year,
  });

  if (duplicateByHash) {
    if (!forceReplace) {
      return {
        action: 'BLOCK',
        errorCode: ErrorCodes.DUPLICATE_FILE,
        existingJob: duplicateByHash,
        conflictingJob: null,
        versionNumber: null,
        reason: `Ce fichier a déjà été importé pour la période ${month}/${year} (version ${duplicateByHash.versionNumber})`,
      };
    }

    // forceReplace demandé → remplacement volontaire
    const versionNumber = await computeVersionNumber({ institutionId, month, year });
    return {
      action: 'CREATE_WITH_REPLACE',
      errorCode: null,
      existingJob: duplicateByHash,
      conflictingJob: null,
      versionNumber,
      reason: `Remplacement volontaire du fichier identique (v${duplicateByHash.versionNumber})`,
    };
  }

  // Étape 3 : détection même hash, autre période
  const sameHashOtherPeriod = await findExistingByHashOnly({ fileHash, institutionId });

  if (sameHashOtherPeriod) {
    const existingPeriod =
      sameHashOtherPeriod.detectedPeriod?.month != null
        ? `${sameHashOtherPeriod.detectedPeriod.month}/${sameHashOtherPeriod.detectedPeriod.year}`
        : 'inconnue';

    return {
      action: 'BLOCK',
      errorCode: ErrorCodes.PERIOD_CONFLICT,
      existingJob: sameHashOtherPeriod,
      conflictingJob: null,
      versionNumber: null,
      reason: `Ce fichier a déjà été importé pour la période ${existingPeriod}, mais il est maintenant détecté comme ${month}/${year}. Vérifiez la période.`,
    };
  }

  // Étape 4 : détection conflit de période (fichier différent)
  const existingSamePeriod = await findExistingByPeriod({ institutionId, month, year });

  if (existingSamePeriod) {
    if (!forceReplace) {
      return {
        action: 'BLOCK',
        errorCode: ErrorCodes.PERIOD_CONFLICT,
        existingJob: null,
        conflictingJob: existingSamePeriod,
        versionNumber: null,
        reason: `Un import existe déjà pour la période ${month}/${year} (fichier "${existingSamePeriod.fileName}", version ${existingSamePeriod.versionNumber})`,
      };
    }

    // forceReplace demandé → remplacement
    const versionNumber = await computeVersionNumber({ institutionId, month, year });
    return {
      action: 'CREATE_WITH_REPLACE',
      errorCode: null,
      existingJob: null,
      conflictingJob: existingSamePeriod,
      versionNumber,
      reason: `Remplacement volontaire du reporting de ${month}/${year}`,
    };
  }

  // Étape 5 : aucun conflit → création normale
  const versionNumber = await computeVersionNumber({ institutionId, month, year });
  return {
    action: 'CREATE',
    errorCode: null,
    existingJob: null,
    conflictingJob: null,
    versionNumber,
    reason: 'Premier import pour cette période',
  };
};

// ============================================================
// GESTION DES CHAÎNAGES
// ============================================================

/**
 * Établit le chaînage entre un nouvel import et l'ancien remplacé.
 *
 * ⚠️ Vérifie la symétrie : supersedes ↔ supersededBy
 *
 * @param {ObjectId} newImportJobId
 * @param {ObjectId} oldImportJobId
 * @param {Object} [session] - session de transaction optionnelle
 */
const linkImportJobs = async (newImportJobId, oldImportJobId, session = null) => {
  if (!newImportJobId || !oldImportJobId) {
    throw new Error('linkImportJobs: IDs manquants');
  }

  const opts = session ? { session } : {};

  // 1. Marquer l'ancien comme SUPERSEDED
  await ImportJob.updateOne(
    { _id: oldImportJobId },
    {
      lifecycle: 'SUPERSEDED',
      supersededBy: newImportJobId,
    },
    opts
  );

  // 2. Chaîner le nouveau vers l'ancien
  await ImportJob.updateOne(
    { _id: newImportJobId },
    {
      supersedes: oldImportJobId,
    },
    opts
  );

  // 3. Vérification de symétrie (best-effort, non bloquant)
  const [newJob, oldJob] = await Promise.all([
    ImportJob.findById(newImportJobId).select('supersedes').lean(),
    ImportJob.findById(oldImportJobId).select('supersededBy').lean(),
  ]);

  if (
    !newJob ||
    !oldJob ||
    String(newJob.supersedes) !== String(oldImportJobId) ||
    String(oldJob.supersededBy) !== String(newImportJobId)
  ) {
    console.warn(
      `⚠️ linkImportJobs: symétrie non respectée entre ${newImportJobId} et ${oldImportJobId}`
    );
  }
};

/**
 * Établit le chaînage entre deux ReportingMensuels.
 *
 * @param {ObjectId} newReportingId
 * @param {ObjectId} oldReportingId
 * @param {Object} [session]
 */
const linkReportings = async (newReportingId, oldReportingId, session = null) => {
  if (!newReportingId || !oldReportingId) return;

  const opts = session ? { session } : {};

  // 1. Marquer l'ancien comme SUPERSEDED
  await ReportingMensuel.updateOne(
    { _id: oldReportingId },
    {
      lifecycle: 'SUPERSEDED',
      supersededBy: newReportingId,
    },
    opts
  );

  // 2. Chaîner le nouveau vers l'ancien
  await ReportingMensuel.updateOne(
    { _id: newReportingId },
    {
      supersedes: oldReportingId,
    },
    opts
  );
};

/**
 * Marque les adhésions d'un ancien reporting comme SUPERSEDED.
 *
 * ⚠️ NE SUPPRIME AUCUNE ADHÉSION
 *
 * @param {ObjectId} oldReportingId
 * @param {Object} [session]
 */
const markAdhesionsAsSuperseded = async (oldReportingId, session = null) => {
  if (!oldReportingId) return;

  const Adhesion = require('../models/Adhesion');
  const opts = session ? { session } : {};

  await Adhesion.updateMany(
    { reportingMensuelId: oldReportingId },
    { reportingLifecycle: 'SUPERSEDED' },
    opts
  );
};

// ============================================================
// GESTION DES ERREURS MÉTIER
// ============================================================

/**
 * Construit une réponse HTTP standardisée pour une erreur d'import.
 *
 * @param {string} errorCode
 * @param {ImportJob} job
 * @param {string} message
 * @returns {{ statusCode: number, body: object }}
 */
const buildErrorResponse = (errorCode, job, message) => {
  switch (errorCode) {
    case ErrorCodes.DUPLICATE_FILE:
      return {
        statusCode: 409,
        body: {
          success: false,
          error: errorCode,
          message,
          data: job
            ? {
                existingJobId: job._id,
                fileName: job.fileName,
                versionNumber: job.versionNumber,
                detectedPeriod: job.detectedPeriod,
                createdAt: job.createdAt,
                uploadedBy: job.uploadedBy,
                status: job.status,
                counters: job.counters,
              }
            : null,
        },
      };

    case ErrorCodes.PERIOD_CONFLICT:
      return {
        statusCode: 409,
        body: {
          success: false,
          error: errorCode,
          message,
          data: job
            ? {
                existingJobId: job._id,
                fileName: job.fileName,
                versionNumber: job.versionNumber,
                detectedPeriod: job.detectedPeriod,
                createdAt: job.createdAt,
                uploadedBy: job.uploadedBy,
                status: job.status,
              }
            : null,
        },
      };

    case ErrorCodes.FILE_HASH_UNAVAILABLE:
      return {
        statusCode: 422,
        body: {
          success: false,
          error: errorCode,
          message,
        },
      };

    case ErrorCodes.IMPORT_IN_PROGRESS:
      return {
        statusCode: 423,
        body: {
          success: false,
          error: errorCode,
          message,
        },
      };

    default:
      return {
        statusCode: 400,
        body: {
          success: false,
          error: errorCode || 'UNKNOWN_ERROR',
          message,
        },
      };
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  ErrorCodes,
  findDuplicateByHash,
  findExistingByPeriod,
  findExistingByHashOnly,
  computeVersionNumber,
  analyzeImport,
  linkImportJobs,
  linkReportings,
  markAdhesionsAsSuperseded,
  buildErrorResponse,
};