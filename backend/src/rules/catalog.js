// backend/src/rules/catalog.js
/**
 * 📖 Catalogue des règles métier
 *
 * Rôle (Phase 5.4) :
 *   - Centraliser les identifiants et métadonnées des règles
 *   - Définir l'ordre d'évaluation
 *   - Fournir les codes d'exclusion associés
 *
 * ⚠️ Les RuleIds RULE-001 à RULE-004 sont CONSERVÉS
 *    pour compatibilité Phase 5.1.
 *
 * ⚠️ L'ordre ORDER fixe est celui qui était utilisé
 *    dans le controller avant la Phase 5.4.
 *
 * ⚠️ L'ordre EXCLUSION_ORDER est DIFFÉRENT de ORDER
 *    pour reproduire exactement la construction actuelle
 *    de exclusionReasons[] (AGE, DATE, MONTANT, DUREE).
 */

// ============================================================
// MÉTADONNÉES DES RÈGLES
// ============================================================
const RULES = {
  DATE: {
    ruleId: 'RULE-001',
    field: 'datePret',
    code: 'DATE_PRET_INVALIDE',
    name: 'Date de prêt valide',
    description: 'La date de prêt doit être incluse dans la période du reporting',
  },
  AGE: {
    ruleId: 'RULE-002',
    field: 'age',
    code: 'AGE_INVALIDE',
    name: 'Âge conforme',
    description:
      'L\'âge doit être entre ageMin et ageMaxDebut, et age + durée/12 ne doit pas dépasser ageMaxFin',
  },
  MONTANT: {
    ruleId: 'RULE-003',
    field: 'montantPret',
    code: 'MONTANT_INVALIDE',
    name: 'Montant conforme',
    description: 'Le montant du prêt doit être entre montantMin et montantMax',
  },
  DUREE: {
    ruleId: 'RULE-004',
    field: 'dureePret',
    code: 'DUREE_INVALIDE',
    name: 'Durée conforme',
    description: 'La durée du prêt doit être supérieure ou égale à dureeMin',
  },
};

// ============================================================
// ORDRE D'ÉVALUATION
// ============================================================

/**
 * Ordre utilisé dans validationResults[]
 * ⚠️ Correspond à l'ordre actuel du controller : DATE, AGE, MONTANT, DUREE
 */
const ORDER = ['DATE', 'AGE', 'MONTANT', 'DUREE'];

/**
 * Ordre utilisé dans exclusionReasons[]
 * ⚠️ DIFFÉRENT de ORDER — reproduit exactement l'ordre actuel : AGE, DATE, MONTANT, DUREE
 */
const EXCLUSION_ORDER = ['AGE', 'DATE', 'MONTANT', 'DUREE'];

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  RULES,
  ORDER,
  EXCLUSION_ORDER,
};