// backend/src/constants/projections.js
/**
 * 📐 Projections MongoDB centralisées
 *
 * Rôle (Phase 5.5 + 5.7) :
 *   - Centraliser les projections réutilisables
 *   - Optimiser les listings en excluant les champs lourds
 *   - Permettre le retour aux champs complets via includeDetails=true
 *
 * ⚠️ Convention :
 *   - LIGHT_PROJECTION : utilisée par défaut dans les listings
 *   - FULL_PROJECTION  : utilisée quand includeDetails=true
 *                        ou dans les routes de détail
 */

// ============================================================
// ADHESION
// ============================================================

const ADHESION_HEAVY_FIELDS =
  '-rawData -normalizedData -validationResults -exclusionReasons';

const ADHESION_LIGHT_PROJECTION = ADHESION_HEAVY_FIELDS;
const ADHESION_FULL_PROJECTION = null;

// ============================================================
// IMPORTJOB
// ============================================================

/**
 * ⚠️ Phase 5.7 — IMPORT_JOB_HEAVY_FIELDS exclut aussi `ignoredLines`
 *    par défaut (peut contenir des milliers d'entrées).
 *
 *    Pour récupérer les ignoredLines, utiliser :
 *      - includeIgnored=true dans GET /jobs/:id
 *      - OU la route dédiée GET /jobs/:id/ignored-lines (paginée)
 */
const IMPORT_JOB_HEAVY_FIELDS =
  '-ignoredLines -anomalies -detectedPeriod.candidates -detectedPeriod.warnings';

/**
 * 🔹 Phase 5.7 — Projection pour `getImportJobById`
 *    Exclut uniquement `ignoredLines` par défaut (peut être énorme).
 *    Conserve les autres champs (anomalies, warnings, etc.).
 */
const IMPORT_JOB_DETAIL_PROJECTION = '-ignoredLines';

const IMPORT_JOB_LIGHT_PROJECTION = IMPORT_JOB_HEAVY_FIELDS;
const IMPORT_JOB_FULL_PROJECTION = null;

// ============================================================
// REPORTINGMENSUEL
// ============================================================

const REPORTING_HEAVY_FIELDS =
  '-sourceTotals -adhesions -exclusions.ids -documents -erreursImport';

const REPORTING_LIGHT_PROJECTION = REPORTING_HEAVY_FIELDS;
const REPORTING_FULL_PROJECTION = null;

// ============================================================
// HELPER
// ============================================================

const getProjection = (includeDetails, lightProjection) => {
  const wantsFull = includeDetails === 'true' || includeDetails === true;
  return wantsFull ? null : lightProjection;
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Adhesion
  ADHESION_LIGHT_PROJECTION,
  ADHESION_FULL_PROJECTION,

  // ImportJob
  IMPORT_JOB_LIGHT_PROJECTION,
  IMPORT_JOB_FULL_PROJECTION,
  IMPORT_JOB_DETAIL_PROJECTION,   // 🔹 Phase 5.7

  // ReportingMensuel
  REPORTING_LIGHT_PROJECTION,
  REPORTING_FULL_PROJECTION,

  // Helper
  getProjection,
};