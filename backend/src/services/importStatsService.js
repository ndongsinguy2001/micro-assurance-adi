// backend/src/services/importStatsService.js
/**
 * 📊 Service de comptage d'import
 *
 * Rôle (Phase 5.4.2) :
 *   - Centraliser les compteurs d'import
 *   - Détecter les incohérences mathématiques
 *   - Ne jamais masquer une anomalie de comptage
 *   - Définir explicitement chaque compteur
 *
 * ============================================================
 * DÉFINITION DES COMPTEURS (référence unique)
 * ============================================================
 *
 * sourceRows (⚠️ sémantique révisée en Phase 5.4.1)
 *   = Nombre TOTAL de lignes ITÉRÉES dans la zone de données Excel
 *     (entre headerRowIndex+1 et totalRows inclus).
 *     Y compris les lignes vides intermédiaires.
 *     Incrémenté DANS la boucle principale, une fois par itération.
 *
 * processedRows (⚠️ sémantique révisée en Phase 5.4.2)
 *   = Nombre de lignes ayant atteint la logique métier ET traitées avec succès
 *     (VALID, EXCLUDED ou ERROR).
 *
 *     ⚠️ AVANT (Phase 5.1) : incrémenté à chaque ligne avec un nom non vide
 *                           (pouvait inclure des lignes non classifiées)
 *     ⚠️ APRÈS (Phase 5.4.2) : CALCULÉ en fin de traitement :
 *                              processedRows = validRows + excludedRows + errorRows
 *
 *     Cette approche garantit la cohérence mathématique par construction.
 *
 * validRows
 *   = Lignes effectivement enregistrées comme conformes
 *     (Adhesion.estExclue = false).
 *
 * excludedRows
 *   = Lignes effectivement enregistrées comme exclusions
 *     (Adhesion.estExclue = true).
 *
 * ignoredRows
 *   = Lignes volontairement ignorées AVANT traitement métier
 *     (vides, sans nom, sans valeurs).
 *
 * errorRows
 *   = Lignes qui n'ont pas pu être traitées/enregistrées à cause
 *     d'une erreur runtime (exception, échec insertMany).
 *
 * duplicateRows
 *   = ⚠️ NON INSTRUMENTÉ EN PHASE 5.4.
 *
 * invalidRows
 *   = ⚠️ NON INSTRUMENTÉ EN PHASE 5.4.
 *
 * ============================================================
 * INVARIANT DE COHÉRENCE
 * ============================================================
 *
 *   sourceRows === validRows + excludedRows + ignoredRows + errorRows
 *                 (+ duplicateRows + invalidRows si instrumentés)
 *
 *   processedRows === validRows + excludedRows + errorRows
 *
 * ============================================================
 * HISTORIQUE
 * ============================================================
 *   5.1.0 — Version initiale
 *   5.4.1 — sourceRows = lignes itérées (au lieu de lignes non vides)
 *   5.4.2 — processedRows = validRows + excludedRows + errorRows
 *           (calculé en fin de traitement)
 */

/**
 * Crée un objet compteurs initialisé à 0.
 * @returns {Object}
 */
const createCounters = () => ({
  sourceRows: 0,
  processedRows: 0,
  validRows: 0,
  excludedRows: 0,
  ignoredRows: 0,
  errorRows: 0,
  duplicateRows: 0,
  invalidRows: 0,
});

/**
 * Incrémente un compteur.
 *
 * @param {Object} counters
 * @param {string} key
 * @param {number} [amount=1]
 * @throws {Error} si la clé n'existe pas ou si amount invalide
 */
const incrementCounter = (counters, key, amount = 1) => {
  if (!counters || typeof counters !== 'object') {
    throw new Error('incrementCounter: counters invalide');
  }
  if (!(key in counters)) {
    throw new Error(`incrementCounter: clé inconnue "${key}"`);
  }
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error(`incrementCounter: montant invalide (${amount})`);
  }
  counters[key] += amount;
};

/**
 * Définit explicitement sourceRows.
 *
 * ⚠️ Deprecated depuis Phase 5.4.1.
 *    Conservée pour compatibilité.
 */
const setSourceRows = (counters, value) => {
  if (!counters) throw new Error('setSourceRows: counters invalide');
  if (typeof value !== 'number' || value < 0) {
    throw new Error(`setSourceRows: valeur invalide (${value})`);
  }
  counters.sourceRows = value;
};

/**
 * 🔹 NOUVEAU (Phase 5.4.2) — Calcule processedRows en fin de traitement.
 *
 * @param {Object} counters
 */
const computeProcessedRows = (counters) => {
  if (!counters) throw new Error('computeProcessedRows: counters invalide');
  counters.processedRows =
    (counters.validRows || 0) +
    (counters.excludedRows || 0) +
    (counters.errorRows || 0);
};

/**
 * Vérifie la cohérence mathématique des compteurs.
 *
 * @param {Object} counters
 * @returns {{ coherent: boolean, delta: number, message: string }}
 */
const assertCoherence = (counters) => {
  if (!counters) {
    return { coherent: false, delta: 0, message: 'Compteurs absents' };
  }

  const totalStatuses =
    (counters.validRows || 0) +
    (counters.excludedRows || 0) +
    (counters.ignoredRows || 0) +
    (counters.errorRows || 0) +
    (counters.duplicateRows || 0) +
    (counters.invalidRows || 0);

  if (counters.sourceRows === 0 && totalStatuses === 0) {
    return { coherent: true, delta: 0, message: 'Compteurs vides cohérents' };
  }

  const deltaSource = counters.sourceRows - totalStatuses;
  if (deltaSource !== 0) {
    return {
      coherent: false,
      delta: deltaSource,
      message:
        `Incohérence compteurs: sourceRows(${counters.sourceRows}) ≠ ` +
        `valid(${counters.validRows}) + excluded(${counters.excludedRows}) + ` +
        `ignored(${counters.ignoredRows}) + error(${counters.errorRows}) + ` +
        `duplicate(${counters.duplicateRows}) + invalid(${counters.invalidRows}) ` +
        `[delta=${deltaSource}]`,
    };
  }

  const expectedProcessed =
    (counters.validRows || 0) +
    (counters.excludedRows || 0) +
    (counters.errorRows || 0);

  const deltaProcessed = counters.processedRows - expectedProcessed;
  if (deltaProcessed !== 0) {
    return {
      coherent: false,
      delta: deltaProcessed,
      message:
        `Incohérence compteurs: processedRows(${counters.processedRows}) ≠ ` +
        `valid(${counters.validRows}) + excluded(${counters.excludedRows}) + ` +
        `error(${counters.errorRows}) [delta=${deltaProcessed}]`,
    };
  }

  return { coherent: true, delta: 0, message: 'Compteurs cohérents' };
};

/**
 * Construit un résumé lisible pour les logs.
 */
const buildSummary = (counters) => {
  if (!counters) return 'aucun compteur';
  return [
    `source=${counters.sourceRows}`,
    `processed=${counters.processedRows}`,
    `valid=${counters.validRows}`,
    `excluded=${counters.excludedRows}`,
    `ignored=${counters.ignoredRows}`,
    `error=${counters.errorRows}`,
    `(duplicate=${counters.duplicateRows}, invalid=${counters.invalidRows} — non instrumentés)`,
  ].join(' ');
};

/**
 * Liste explicite des compteurs non instrumentés à cette phase.
 */
const getNotInstrumentedCounters = () => ['duplicateRows', 'invalidRows'];

/**
 * Analyse une erreur Mongoose `insertMany({ordered: false})`.
 */
const analyzeInsertManyError = (err, batchLength) => {
  if (Array.isArray(err.insertedDocs)) {
    return {
      insertedCount: err.insertedDocs.length,
      errorCount: batchLength - err.insertedDocs.length,
      isExact: true,
      details: { method: 'insertedDocs', writeErrors: err.writeErrors?.length || 0 },
    };
  }

  if (Array.isArray(err.writeErrors)) {
    const errorsCount = err.writeErrors.length;
    return {
      insertedCount: batchLength - errorsCount,
      errorCount: errorsCount,
      isExact: true,
      details: { method: 'writeErrors', count: errorsCount },
    };
  }

  if (err.result && typeof err.result.nInserted === 'number') {
    return {
      insertedCount: err.result.nInserted,
      errorCount: batchLength - err.result.nInserted,
      isExact: true,
      details: { method: 'nInserted' },
    };
  }

  return {
    insertedCount: 0,
    errorCount: batchLength,
    isExact: false,
    details: {
      method: 'fallback',
      warning:
        'Impossible de distinguer les insertions réussies des échecs sur ce batch.',
    },
  };
};

module.exports = {
  createCounters,
  incrementCounter,
  setSourceRows,
  computeProcessedRows,       // 🔹 Phase 5.4.2
  assertCoherence,
  buildSummary,
  getNotInstrumentedCounters,
  analyzeInsertManyError,
};