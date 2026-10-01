// backend/src/rules/ruleDuree.js
/**
 * ⏱️ Règle RULE-004 — Durée conforme
 *
 * Comportement (identique à la Phase 5.1) :
 *   passed = dureePret >= dureeMin
 *
 * ⚠️ Ne pas modifier cette règle sans validation métier explicite.
 */

const { RULES } = require('./catalog');

/**
 * Évalue la règle DUREE.
 *
 * @param {Object} context
 * @param {number} context.dureePret
 * @param {Object} context.contrat - { dureeMin }
 * @returns {Object} résultat normalisé
 */
const evaluate = ({ dureePret, contrat }) => {
  const passed = dureePret >= contrat.dureeMin;

  return {
    ruleId: RULES.DUREE.ruleId,
    field: RULES.DUREE.field,
    passed,
    message: passed ? '' : `Durée invalide (${dureePret} mois)`,
    normalizedValue: dureePret,
    expectedValue: `≥ ${contrat.dureeMin} mois`,
    exclusionCode: RULES.DUREE.code,
  };
};

module.exports = { evaluate };