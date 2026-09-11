// backend/src/models/CompteResultat.js
const mongoose = require('mongoose');

/**
 * 📈 CompteResultat - Compte de résultat annuel par SFD
 * Conforme à la procédure IG - Micro-Assurance ADI
 *
 * Types de clôture :
 *   - CIVILE  : 01/01/N → 31/12/N
 *   - ALLIANZ : 01/10/N-1 → 30/09/N
 */
const CompteResultatSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. IDENTIFICATION
    // ============================================================
    reference: {
      type: String,
      required: [true, 'La référence est obligatoire'],
      unique: true, // ✅ unique ici, PAS de .index() en bas
      uppercase: true,
      trim: true,
    },

    // ============================================================
    // 2. SFD (SNAPSHOT)
    // ============================================================
    sfd: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SFD',
        required: true,
      },
      nom: String,
      code: String,
    },

    // ============================================================
    // 3. CONTRAT (SNAPSHOT)
    // ============================================================
    contrat: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contrat',
      },
      nom: String,
      code: String,
      assureurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assureur',
      },
      assureurNom: String,
    },

    // ============================================================
    // 4. PÉRIODE
    // ============================================================
    periode: {
      annee: {
        type: Number,
        required: true,
      },
      type: {
        type: String,
        enum: ['CIVILE', 'ALLIANZ'],
        default: 'CIVILE',
      },
      debut: {
        type: Date,
        required: true,
      },
      fin: {
        type: Date,
        required: true,
      },
    },

    // ============================================================
    // 5. TAUX APPLIQUÉS (SNAPSHOT)
    // ============================================================
    taux: {
      commissionSFD: { type: Number, default: 0.07 },
      commissionIG: { type: Number, default: 0.15 },
      commissionAssureur: { type: Number, default: 0.05 },
      fraisManagement: { type: Number, default: 0.27 },
      fraisReassurance: { type: Number, default: 0.05 },
      pourcentagePB_SFD: { type: Number, default: 0.80 },
      pourcentagePB_Assureur: { type: Number, default: 0.20 },
    },

    // ============================================================
    // 6. CRÉDIT
    // ============================================================
    credit: {
      primesCollectees: { type: Number, default: 0, min: 0 },
      reprises: {
        pena: { type: Number, default: 0 },
        sinistresNonRegles: { type: Number, default: 0 },
        sinistresInconnus: { type: Number, default: 0 },
      },
      total: { type: Number, default: 0 },
    },

    // ============================================================
    // 7. DÉBIT
    // ============================================================
    debit: {
      sinistresPayes: { type: Number, default: 0, min: 0 },
      provisions: {
        sinistresNonRegles: { type: Number, default: 0 },
        sinistresInconnus: { type: Number, default: 0 },
        pena: { type: Number, default: 0 },
        primesImpacteesNPlus: { type: Number, default: 0 },
      },
      commissions: {
        sfd: { type: Number, default: 0 },
        ig: { type: Number, default: 0 },
        assureur: { type: Number, default: 0 },
        fraisManagement: { type: Number, default: 0 },
        fraisReassurance: { type: Number, default: 0 },
      },
      reportANouveau: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    // ============================================================
    // 8. RÉSULTAT
    // ============================================================
    resultat: {
      totalCredit: { type: Number, default: 0 },
      totalDebit: { type: Number, default: 0 },
      resultat: { type: Number, default: 0 },
      pb: {
        sfd: { type: Number, default: 0 },
        assureur: { type: Number, default: 0 },
      },
    },

    // ============================================================
    // 9. DÉTAILS / RÉFÉRENCES
    // ============================================================
    reportings: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportingMensuel' },
        mois: Number,
        annee: Number,
        totalPrime: Number,
        nombreAdhesions: Number,
      },
    ],
    sinistres: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sinistre',
      },
    ],
    crPrecedentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompteResultat',
      default: null,
    },

    // ============================================================
    // 10. STATUT / WORKFLOW
    // ============================================================
    statut: {
      type: String,
      enum: ['BROUILLON', 'SOUMIS_ASSUREUR', 'VALIDE', 'ENVOYE_SFD'],
      default: 'BROUILLON',
    },

    // ============================================================
    // 11. FICHIERS
    // ============================================================
    excelPath: { type: String },
    excelNom: { type: String },

    // ============================================================
    // 12. DATES CLÉS
    // ============================================================
    dateGeneration: { type: Date, default: Date.now },
    dateSoumission: { type: Date, default: null },
    dateValidation: { type: Date, default: null },
    dateEnvoiSFD: { type: Date, default: null },

    // ============================================================
    // 13. TRACABILITÉ
    // ============================================================
    validePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    envoyePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: { type: String, trim: true },

    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
// ⚠️ L'index unique sur `reference` est déjà défini dans le schéma (unique: true).
// Ne PAS le redéfinir ici pour éviter le warning Mongoose.
// ============================================================
CompteResultatSchema.index(
  { 'sfd._id': 1, 'periode.annee': 1, 'periode.type': 1 },
  { unique: true }
);
CompteResultatSchema.index({ statut: 1 });
CompteResultatSchema.index({ dateGeneration: -1 });

// ============================================================
// VIRTUAL
// ============================================================
CompteResultatSchema.virtual('estValide').get(function () {
  return this.statut === 'VALIDE' || this.statut === 'ENVOYE_SFD';
});

CompteResultatSchema.virtual('estBrouillon').get(function () {
  return this.statut === 'BROUILLON';
});

// ============================================================
// MÉTHODES
// ============================================================
CompteResultatSchema.methods.soumettre = function () {
  this.statut = 'SOUMIS_ASSUREUR';
  this.dateSoumission = new Date();
  return this;
};

CompteResultatSchema.methods.valider = function (userId) {
  this.statut = 'VALIDE';
  this.dateValidation = new Date();
  this.validePar = userId;
  return this;
};

CompteResultatSchema.methods.envoyerAuSFD = function (userId) {
  this.statut = 'ENVOYE_SFD';
  this.dateEnvoiSFD = new Date();
  this.envoyePar = userId;
  return this;
};

module.exports =
  mongoose.models.CompteResultat ||
  mongoose.model('CompteResultat', CompteResultatSchema);