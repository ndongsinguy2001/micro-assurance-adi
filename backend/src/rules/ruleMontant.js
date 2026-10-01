// backend/src/rules/ruleMontant.js
/**
 * 💰 Règle RULE-003 — Montant conforme
 *
 * Comportement (identique à la Phase 5.1) :
 *   passed = montantPret >= montantMin
 *         ET montantPret <= montantMax
 *
 * ⚠️ Ne pas modifier cette règle sans validation métier explicite.
 */

const { RULES } = require('./catalog');

/**
 * Évalue la règle MONTANT.
 *
 * @param {Object} context
 * @param {number} context.montantPret
 * @param {Object} context.contrat - { montantMin, montantMax }
 * @returns {Object} résultat normalisé
 */
const evaluate = ({ montantPret, contrat }) => {
  const passed = !!(
    montantPret >= contrat.montantMin &&
    montantPret <= contrat.montantMax
  );

  return {
    ruleId: RULES.MONTANT.ruleId,
    field: RULES.MONTANT.field,
    passed,
    message: passed ? '' : `Montant invalide (${montantPret} FCFA)`,
    normalizedValue: montantPret,
    expectedValue: `${contrat.montantMin}–${contrat.montantMax}`,
    exclusionCode: RULES.MONTANT.code,
  };
};

module.exports = { evaluate };