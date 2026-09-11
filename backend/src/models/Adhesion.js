// backend/src/models/Adhesion.js
const mongoose = require('mongoose');

/**
 * 👤 Adhesion - Adhésion individuelle d'un emprunteur
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
    dateNaissance: {
      type: Date,
      // ✅ Optionnel : certaines lignes d'import Excel n'ont pas la date
      // La validation métier est faite via controleAge dans le controller
    },
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
    motifExclusion: {
      type: String,
      trim: true,
    },

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
      type: {
        type: String,
        enum: ['DECES', 'INVALIDITE', 'AUTRE'],
      },
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
    // 9. TRACABILITÉ
    // ============================================================
    ligneOriginale: { type: Number },
    estExclue: { type: Boolean, default: false },
    dateImport: { type: Date, default: Date.now },
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur créateur est obligatoire'],
    },
    modifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

module.exports = mongoose.models.Adhesion || mongoose.model('Adhesion', AdhesionSchema);