// backend/src/models/Adhesion.js
const mongoose = require('mongoose');

/**
 * 👤 Adhesion - Adhésion individuelle d'un emprunteur
 *
 * ⚠️ Phase 5.1 — Champs de traçabilité ajoutés :
 *    - importJobId, sheetName, sourceRowNumber
 *    - rawData, normalizedData
 *    - validationResults[], exclusionReasons[]
 *    - status (limité à VALID / EXCLUDED en 5.1)
 *
 * ⚠️ Phase 5.3 — Ajout de `reportingLifecycle` :
 *    - Dénormalisation du cycle de vie du reporting parent
 *    - Permet de filtrer les adhésions ACTIVE / SUPERSEDED
 *      SANS faire de $lookup coûteux
 *    - Mis à jour automatiquement par idempotencyService
 *      lors d'un remplacement de reporting
 *
 * ============================================================
 * 📌 DOCUMENTATION DES CHAMPS DE TRAÇABILITÉ
 * ============================================================
 *
 * ── rawData ──
 *   Objet brut extrait de la ligne Excel via `cell.text` d'ExcelJS.
 *   Format : { col_0: '...', col_1: '...', ..., col_N: '...' }
 *   ⚠️ LIMITE CONNUE : ExcelJS `cell.text` renvoie une REPRÉSENTATION
 *      TEXTE de la cellule, PAS la valeur native (Date, Number, Boolean).
 *      Ainsi, une cellule contenant la date 27/01/2020 sera
 *      potentiellement stockée comme '27/01/2020' ou '44192' selon
 *      le format d'affichage.
 *      Cela signifie que rawData n'est PAS un clone fidèle du classeur
 *      Excel, mais une lecture texte ligne par ligne.
 *
 * ── normalizedData ──
 *   Valeurs après application des conversions du pipeline :
 *     - trim + suppression espaces superflus
 *     - conversion de dates (toDate)
 *     - conversion de nombres (toNumber)
 *     - mise en majuscules du sexe
 *   Format : objet plat documenté (nom, prenom, identifiant, etc.)
 *
 * ── validationResults[] ──
 *   Un élément par contrôle métier appliqué à la ligne.
 *   ⚠️ En Phase 5.1/5.4 : 4 éléments correspondant aux 4 contrôles actuels
 *      (RULE-001 à RULE-004).
 *      Le nombre d'éléments évoluera avec le ruleEngine.
 *
 * ── exclusionReasons[] ──
 *   Un élément par règle métier échouée.
 *   ⚠️ En Phase 5.1/5.4 : dérivé des 4 contrôles actuels.
 *
 * ── status ──
 *   ⚠️ En Phase 5.1 : uniquement 'VALID' ou 'EXCLUDED'.
 *
 * ── reportingLifecycle (Phase 5.3) ──
 *   Dénormalisation du statut du reporting parent :
 *     - 'ACTIVE'     : reporting actif
 *     - 'SUPERSEDED' : reporting remplacé par un import plus récent
 *
 * ============================================================
 * 📌 PIPELINE DE TRANSFORMATION D'UNE LIGNE
 * ============================================================
 *
 *   RAW (rawData : cell.text brut)
 *     ↓
 *   NORMALIZED (normalizedData : conversions appliquées)
 *     ↓
 *   VALIDATED (validationResults[] : contrôles évalués)
 *     ↓
 *   PERSISTED (document Adhesion avec status final)
 */
const AdhesionSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. RÉFÉRENCES
    // ============================================================
    reportingMensuelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingMensuel',
      required: [true, 'Le reporting mensuel est obligatoire'],
    },
    sfdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
      required: [true, 'Le SFD est obligatoire'],
    },
    contratId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contrat',
      required: [true, 'Le contrat est obligatoire'],
    },

    // ============================================================
    // 2. DONNÉES DE L'EMPRUNTEUR
    // ============================================================
    guichet: { type: String, trim: true },
    localite: { type: String, trim: true },
    identifiantEmprunteur: { type: String, trim: true },
    nomEmprunteur: {
      type: String,
      required: [true, 'Le nom de l\'emprunteur est obligatoire'],
      trim: true,
    },
    prenomEmprunteur: { type: String, trim: true },
    adresse: { type: String, trim: true },
    dateNaissance: { type: Date },
    profession: { type: String, trim: true },
    sexe: {
      type: String,
      enum: ['M', 'F'],
      required: [true, 'Le sexe est obligatoire'],
    },

    // ============================================================
    // 3. DONNÉES DU PRÊT
    // ============================================================
    dateFinPret: {
      type: Date,
      required: [true, 'La date de fin du prêt est obligatoire'],
    },
    moisReporting: {
      type: String,
      required: [true, 'Le mois du reporting est obligatoire'],
      trim: true,
    },
    datePret: {
      type: Date,
      required: [true, 'La date du prêt est obligatoire'],
    },
    dureePret: {
      type: Number,
      required: [true, 'La durée du prêt est obligatoire'],
      min: 0,
    },
    montantPret: {
      type: Number,
      required: [true, 'Le montant du prêt est obligatoire'],
      min: 0,
    },
    typeCredit: { type: String, trim: true },
    typePret: { type: String, trim: true },
    tauxInteretPret: { type: Number, default: 0 },

    // ============================================================
    // 4. CALCULS DÉRIVÉS
    // ============================================================
    prime: { type: Number, default: 0, min: 0 },
    fraisGestion: { type: Number, default: 0, min: 0 },
    taxes: { type: Number, default: 0, min: 0 },
    montantDu: { type: Number, default: 0, min: 0 },
    age: { type: Number, default: 0 },

    // ============================================================
    // 5. CONTRÔLES DE VALIDATION
    // ============================================================
    controleAge: {
      type: String,
      enum: ['ok', 'no'],
      default: 'ok',
    },
    controleDate: {
      type: String,
      enum: ['ok', 'no'],
      default: 'ok',
    },
    controleMontant: {
      type: String,
      enum: ['ok', 'no'],
      default: 'ok',
    },
    controleDuree: {
      type: String,
      enum: ['ok', 'no'],
      default: 'ok',
    },
    controleGlobal: {
      type: String,
      enum: ['ok', 'no'],
      default: 'ok',
    },
    motifExclusion: { type: String, trim: true },

    // ============================================================
    // 6. STATISTIQUES
    // ============================================================
    nbMale: { type: Number, default: 0, min: 0, max: 1 },
    nbFemale: { type: Number, default: 0, min: 0, max: 1 },
    moisPret: { type: Number, min: 1, max: 12 },

    // ============================================================
    // 7. SINISTRE
    // ============================================================
    sinistre: {
      estSinistre: { type: Boolean, default: false },
      type: { type: String, enum: ['DECES', 'INVALIDITE', 'AUTRE'] },
      date: Date,
      montant: Number,
      statut: {
        type: String,
        enum: ['A_VERIFIER', 'VALIDE', 'REFUSE', 'PAYE'],
        default: 'A_VERIFIER',
      },
    },

    // ============================================================
    // 8. STATUT
    // ============================================================
    statut: {
      type: String,
      enum: ['ACTIVE', 'EXCLUE', 'SINISTRE'],
      default: 'ACTIVE',
    },

    // ============================================================
    // 9. TRACABILITÉ (existant)
    // ============================================================
    ligneOriginale: { type: Number },
    estExclue: { type: Boolean, default: false },
    dateImport: { type: Date, default: Date.now },
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur créateur est obligatoire'],
    },
    modifiePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ============================================================
    // 10. TRACABILITÉ PHASE 5.1 — CHAMPS OPTIONNELS
    // ============================================================
    importJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportJob',
      default: null,
      index: true,
    },
    sheetName: { type: String, trim: true, default: null },
    sourceRowNumber: { type: Number, default: null },

    rawData: { type: mongoose.Schema.Types.Mixed, default: null },
    normalizedData: { type: mongoose.Schema.Types.Mixed, default: null },

    validationResults: [
      {
        ruleId: { type: String, trim: true },
        field: { type: String, trim: true },
        passed: { type: Boolean, default: false },
        message: { type: String, trim: true, default: '' },
        originalValue: { type: mongoose.Schema.Types.Mixed, default: null },
        normalizedValue: { type: mongoose.Schema.Types.Mixed, default: null },
        expectedValue: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    exclusionReasons: [
      {
        ruleId: { type: String, trim: true },
        field: { type: String, trim: true },
        code: { type: String, trim: true },
        message: { type: String, trim: true },
        originalValue: { type: mongoose.Schema.Types.Mixed, default: null },
        normalizedValue: { type: mongoose.Schema.Types.Mixed, default: null },
        expectedValue: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    status: {
      type: String,
      enum: ['VALID', 'EXCLUDED'],
      default: 'VALID',
      index: true,
    },

    // ============================================================
    // 11. PHASE 5.3 — CYCLE DE VIE DU REPORTING PARENT
    // ============================================================
    // ⚠️ L'index est déclaré plus bas (AdhesionSchema.index)
    //    NE PAS ajouter `index: true` ici (warning Mongoose).
    reportingLifecycle: {
      type: String,
      enum: ['ACTIVE', 'SUPERSEDED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEX
// ============================================================
AdhesionSchema.index({ identifiantEmprunteur: 1 });
AdhesionSchema.index({ nomEmprunteur: 1, prenomEmprunteur: 1 });
AdhesionSchema.index({ sfdId: 1, moisReporting: 1 });
AdhesionSchema.index({ 'sinistre.estSinistre': 1 });
AdhesionSchema.index({ estExclue: 1 });
AdhesionSchema.index({ reportingMensuelId: 1 });

// 🔹 Phase 5.3 — Index dédié (évite $lookup pour filtrer par lifecycle)
AdhesionSchema.index({ reportingLifecycle: 1 });

// ============================================================
// VIRTUAL
// ============================================================
AdhesionSchema.virtual('nomComplet').get(function () {
  return [this.prenomEmprunteur, this.nomEmprunteur].filter(Boolean).join(' ');
});

// ============================================================
// MÉTHODES
// ============================================================
AdhesionSchema.methods.estValide = function () {
  return this.controleGlobal === 'ok' && this.statut === 'ACTIVE';
};

AdhesionSchema.methods.estSinistre = function () {
  return this.sinistre.estSinistre;
};

AdhesionSchema.methods.markSuperseded = function () {
  this.reportingLifecycle = 'SUPERSEDED';
  return this;
};

module.exports =
  mongoose.models.Adhesion || mongoose.model('Adhesion', AdhesionSchema);