// backend/src/rules/ruleAge.js
/**
 * 👤 Règle RULE-002 — Âge conforme
 *
 * Comportement (identique à la Phase 5.1) :
 *   passed = age >= ageMin
 *         ET age <= ageMaxDebut
 *         ET (age + dureePret / 12) <= ageMaxFin
 *
 * ⚠️ Ne pas modifier cette règle sans validation métier explicite.
 */

const { RULES } = require('./catalog');

/**
 * Évalue la règle AGE.
 *
 * @param {Object} context
 * @param {number} context.age
 * @param {number} context.dureePret
 * @param {Object} context.contrat - { ageMin, ageMaxDebut, ageMaxFin }
 * @returns {Object} résultat normalisé
 */
const evaluate = ({ age, dureePret, contrat }) => {
  const passed = !!(
    age >= contrat.ageMin &&
    age <= contrat.ageMaxDebut &&
    age + dureePret / 12 <= contrat.ageMaxFin
  );

  return {
    ruleId: RULES.AGE.ruleId,
    field: RULES.AGE.field,
    passed,
    message: passed ? '' : `Âge invalide (${age} ans)`,
    normalizedValue: age,
    expectedValue: `${contrat.ageMin}–${contrat.ageMaxDebut} (fin ≤ ${contrat.ageMaxFin})`,
    exclusionCode: RULES.AGE.code,
  };
};

module.exports = { evaluate };