const mongoose = require('mongoose');

/**
 * 📊 Reporting Mensuel - Suivi des reportings des SFD
 */
const ReportingMensuelSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. RÉFÉRENCES
    // ============================================================
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
    // 2. PÉRIODE
    // ============================================================
    mois: {
      type: Number,
      required: [true, 'Le mois est obligatoire'],
      min: 1,
      max: 12,
    },
    annee: {
      type: Number,
      required: [true, 'L\'année est obligatoire'],
    },
    trimestre: {
      type: Number,
      min: 1,
      max: 4,
      default: function() {
        return Math.ceil(this.mois / 3);
      },
    },
    dateDebut: {
      type: Date,
      required: [true, 'La date de début est obligatoire'],
    },
    dateFin: {
      type: Date,
      required: [true, 'La date de fin est obligatoire'],
    },

    // ============================================================
    // 3. STATISTIQUES
    // ============================================================
    nombreAdhesions: {
      type: Number,
      default: 0,
      min: 0,
    },
    nombreExclusions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPrime: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalFraisGestion: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTaxes: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMontantDu: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // 4. COMMISSIONS
    // ============================================================
    commissionSFD: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionIG: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionAssureur: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // 5. FICHIERS
    // ============================================================
    fichierOriginal: {
      nom: {
        type: String,
        required: [true, 'Le nom du fichier original est obligatoire'],
      },
      chemin: {
        type: String,
        required: [true, 'Le chemin du fichier est obligatoire'],
      },
      taille: {
        type: Number,
        default: 0,
      },
      dateUpload: {
        type: Date,
        default: Date.now,
      },
    },
    fichierCloture: {
      nom: String,
      chemin: String,
      taille: Number,
      dateGeneration: Date,
    },

    // ============================================================
    // 6. DOCUMENTS GÉNÉRÉS
    // ============================================================
    documents: {
      appelCotisation: {
        nom: String,
        chemin: String,
        dateGeneration: Date,
      },
      appelReglementSinistres: {
        nom: String,
        chemin: String,
        dateGeneration: Date,
      },
      rapportSinistres: {
        nom: String,
        chemin: String,
        dateGeneration: Date,
      },
    },

    // ============================================================
    // 7. WORKFLOW - STATUT
    // ============================================================
    statut: {
      type: String,
      enum: [
        'RECU',
        'EN_VALIDATION',
        'EXCLUSIONS_A_CORRIGER',
        'CORRIGE',
        'CLOTURE',
      ],
      default: 'RECU',
    },

    // ============================================================
    // 8. EXCLUSIONS
    // ============================================================
    exclusions: {
      ids: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Adhesion',
        },
      ],
      fichierCorrection: {
        nom: String,
        chemin: String,
        taille: Number,
        dateUpload: Date,
      },
      dateLimiteCorrection: Date,
      dateReceptionCorrection: Date,
    },

    // ============================================================
    // 9. ERREURS D'IMPORT
    // ============================================================
    erreursImport: [
      {
        ligne: Number,
        colonne: String,
        message: String,
        donnees: mongoose.Schema.Types.Mixed,
      },
    ],

    // ============================================================
    // 10. RÉFÉRENCES AUX ADHÉSIONS
    // ============================================================
    adhesions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Adhesion',
      },
    ],

    // ============================================================
    // 11. DATES CLÉS
    // ============================================================
    dateReception: {
      type: Date,
      default: Date.now,
    },
    dateCloture: {
      type: Date,
      default: null,
    },
    dateDerniereModification: {
      type: Date,
      default: Date.now,
    },

    // ============================================================
    // 12. UTILISATEURS
    // ============================================================
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur créateur est obligatoire'],
    },
    modifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cloturePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ============================================================
    // 13. MÉTADONNÉES
    // ============================================================
    estActif: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEX (uniques, sans doublons)
// ============================================================

// Index unique par SFD et période
ReportingMensuelSchema.index({ sfdId: 1, mois: 1, annee: 1 }, { unique: true });

// Index pour les recherches fréquentes
ReportingMensuelSchema.index({ statut: 1 });
ReportingMensuelSchema.index({ dateReception: -1 });

// ============================================================
// VIRTUAL
// ============================================================

ReportingMensuelSchema.virtual('nomComplet').get(function() {
  const moisNoms = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return `${moisNoms[this.mois - 1]} ${this.annee}`;
});

ReportingMensuelSchema.virtual('tauxValidation').get(function() {
  const total = this.nombreAdhesions + this.nombreExclusions;
  if (total === 0) return 0;
  return (this.nombreAdhesions / total) * 100;
});

// ============================================================
// MÉTHODES
// ============================================================

ReportingMensuelSchema.methods.estCloture = function() {
  return this.statut === 'CLOTURE';
};

ReportingMensuelSchema.methods.estEnAttenteCorrection = function() {
  return this.statut === 'EXCLUSIONS_A_CORRIGER';
};

ReportingMensuelSchema.methods.estValide = function() {
  return this.statut === 'EN_VALIDATION' || this.statut === 'CORRIGE';
};

ReportingMensuelSchema.methods.calculerTauxValidation = function() {
  const total = this.nombreAdhesions + this.nombreExclusions;
  if (total === 0) return 0;
  return (this.nombreAdhesions / total) * 100;
};

module.exports = mongoose.model('ReportingMensuel', ReportingMensuelSchema);