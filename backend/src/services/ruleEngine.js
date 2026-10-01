// backend/src/services/ruleEngine.js
/**
 * 🧠 Moteur de règles métier
 *
 * Rôle (Phase 5.4) :
 *   - Orchestrer l'évaluation des 4 règles (DATE, AGE, MONTANT, DUREE)
 *   - Produire les résultats dans un format compatible avec
 *     validationResults[], exclusionReasons[], controleXxx
 *   - Calculer controleGlobal
 *
 * ⚠️ Aucune modification du comportement métier :
 *   - Mêmes règles
 *   - Même ordre d'évaluation (validationResults)
 *   - Même ordre d'exclusion (exclusionReasons)
 *   - Même critère de décision (ET logique)
 *
 * ============================================================
 * FORMAT DE RETOUR
 * ============================================================
 *
 *   {
 *     controleDate: 'ok'|'no',
 *     controleAge: 'ok'|'no',
 *     controleMontant: 'ok'|'no',
 *     controleDuree: 'ok'|'no',
 *     controleGlobal: 'ok'|'no',
 *     validationResults: Array,
 *     exclusionReasons: Array,
 *   }
 *
 * ============================================================
 */

const ruleDate = require('../rules/ruleDate');
const ruleAge = require('../rules/ruleAge');
const ruleMontant = require('../rules/ruleMontant');
const ruleDuree = require('../rules/ruleDuree');
const { ORDER, EXCLUSION_ORDER } = require('../rules/catalog');

// ============================================================
// MAP DES RÈGLES
// ============================================================
const RULES_MAP = {
  DATE: ruleDate,
  AGE: ruleAge,
  MONTANT: ruleMontant,
  DUREE: ruleDuree,
};

// ============================================================
// ÉVALUATION
// ============================================================

/**
 * Évalue toutes les règles pour une adhésion.
 *
 * @param {Object} context
 * @param {Date|null} context.datePret
 * @param {Date} context.dateDebut
 * @param {Date} context.dateFin
 * @param {number} context.age
 * @param {number} context.dureePret
 * @param {number} context.montantPret
 * @param {Object} context.contrat - { ageMin, ageMaxDebut, ageMaxFin, montantMin, montantMax, dureeMin }
 * @returns {{
 *   controleDate: 'ok'|'no',
 *   controleAge: 'ok'|'no',
 *   controleMontant: 'ok'|'no',
 *   controleDuree: 'ok'|'no',
 *   controleGlobal: 'ok'|'no',
 *   validationResults: Array,
 *   exclusionReasons: Array,
 * }}
 */
const evaluateAll = (context) => {
  // Validation défensive du contexte
  if (!context || !context.contrat) {
    throw new Error('ruleEngine.evaluateAll: contexte ou contrat manquant');
  }

  // ============================================================
  // 1. ÉVALUATION DE CHAQUE RÈGLE
  // ============================================================
  const results = {};
  for (const key of ORDER) {
    results[key] = RULES_MAP[key].evaluate(context);
  }

  // ============================================================
  // 2. CONTRÔLES LEGACY (compatibilité Phase 5.1)
  // ============================================================
  const controleDate = results.DATE.passed ? 'ok' : 'no';
  const controleAge = results.AGE.passed ? 'ok' : 'no';
  const controleMontant = results.MONTANT.passed ? 'ok' : 'no';
  const controleDuree = results.DUREE.passed ? 'ok' : 'no';

  // ⚠️ ET logique strict (identique au code actuel)
  const controleGlobal =
    controleDate === 'ok' &&
    controleAge === 'ok' &&
    controleMontant === 'ok' &&
    controleDuree === 'ok'
      ? 'ok'
      : 'no';

  // ============================================================
  // 3. VALIDATION RESULTS (ordre DATE, AGE, MONTANT, DUREE)
  // ============================================================
  const validationResults = ORDER.map((key) => {
    const r = results[key];
    return {
      ruleId: r.ruleId,
      field: r.field,
      passed: r.passed,
      message: r.message,
      normalizedValue: r.normalizedValue,
      expectedValue: r.expectedValue,
    };
  });

  // ============================================================
  // 4. EXCLUSION REASONS (ordre AGE, DATE, MONTANT, DUREE)
  // ============================================================
  const exclusionReasons = [];
  for (const key of EXCLUSION_ORDER) {
    const r = results[key];
    if (!r.passed) {
      exclusionReasons.push({
        ruleId: r.ruleId,
        field: r.field,
        code: r.exclusionCode,
        message: r.message,
        normalizedValue: r.normalizedValue,
      });
    }
  }

  // ============================================================
  // 5. RETOUR
  // ============================================================
  return {
    controleDate,
    controleAge,
    controleMontant,
    controleDuree,
    controleGlobal,
    validationResults,
    exclusionReasons,
  };
};

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  evaluateAll,
};