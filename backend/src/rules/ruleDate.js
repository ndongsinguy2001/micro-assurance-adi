// backend/src/rules/ruleDate.js
/**
 * 📅 Règle RULE-001 — Date de prêt valide
 *
 * Comportement (identique à la Phase 5.1) :
 *   passed = datePret != null ET datePret ∈ [dateDebut, dateFin]
 *
 * ⚠️ Ne pas modifier cette règle sans validation métier explicite.
 */

const { RULES } = require('./catalog');

/**
 * Évalue la règle DATE.
 *
 * @param {Object} context
 * @param {Date|null} context.datePret
 * @param {Date} context.dateDebut
 * @param {Date} context.dateFin
 * @returns {{
 *   ruleId: string,
 *   field: string,
 *   passed: boolean,
 *   message: string,
 *   normalizedValue: any,
 *   expectedValue: any,
 *   exclusionCode: string,
 * }}
 */
const evaluate = ({ datePret, dateDebut, dateFin }) => {
  const passed = !!(datePret && datePret >= dateDebut && datePret <= dateFin);

  return {
    ruleId: RULES.DATE.ruleId,
    field: RULES.DATE.field,
    passed,
    message: passed ? '' : 'Date de prêt hors période',
    normalizedValue: datePret ? datePret.toISOString() : null,
    expectedValue: `${dateDebut.toISOString()} → ${dateFin.toISOString()}`,
    exclusionCode: RULES.DATE.code,
  };
};

module.exports = { evaluate };