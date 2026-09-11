const mongoose = require('mongoose');

/**
 * 🚨 Sinistre - Gestion des sinistres ADI
 */
const SinistreSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. RÉFÉRENCES
    // ============================================================
    adhesionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Adhesion',
      required: [true, 'L\'adhésion est obligatoire'],
    },
    sfdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
      required: [true, 'Le SFD est obligatoire'],
    },
    reportingMensuelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingMensuel',
      required: [true, 'Le reporting mensuel est obligatoire'],
    },
    contratId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contrat',
      required: [true, 'Le contrat est obligatoire'],
    },

    // ============================================================
    // 2. INFORMATIONS DU SINISTRE
    // ============================================================
    dateSinistre: {
      type: Date,
      required: [true, 'La date du sinistre est obligatoire'],
    },
    typeSinistre: {
      type: String,
      enum: ['DECES', 'INVALIDITE', 'AUTRE'],
      required: [true, 'Le type de sinistre est obligatoire'],
    },
    description: {
      type: String,
      trim: true,
    },

    // ============================================================
    // 3. INFORMATIONS FINANCIÈRES
    // ============================================================
    montantPret: {
      type: Number,
      required: [true, 'Le montant du prêt est obligatoire'],
      min: 0,
    },
    capitalRestantDu: {
      type: Number,
      required: [true, 'Le capital restant dû est obligatoire'],
      min: 0,
    },
    capitalRembourse: {
      type: Number,
      required: [true, 'Le capital remboursé est obligatoire'],
      min: 0,
      default: 0,
    },
    montantSinistre: {
      type: Number,
      required: [true, 'Le montant du sinistre est obligatoire'],
      min: 0,
    },
    montantPartSFD: {
      type: Number,
      required: [true, 'La part du SFD est obligatoire'],
      min: 0,
    },
    montantPartAssure: {
      type: Number,
      required: [true, 'La part de l\'assuré est obligatoire'],
      min: 0,
    },

    // ============================================================
    // 4. PIÈCES JUSTIFICATIVES
    // ============================================================
    justificatifs: [
      {
        nom: {
          type: String,
          required: true,
        },
        chemin: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: [
            'ACTE_DECES',
            'CERTIFICAT_MEDICAL',
            'RAPPORT_AUTOPSIE',
            'PIECE_IDENTITE',
            'CERTIFICAT_RESIDENCE',
            'AUTRE',
          ],
          default: 'AUTRE',
        },
        dateUpload: {
          type: Date,
          default: Date.now,
        },
        taille: Number,
        uploadedPar: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],

    // ============================================================
    // 5. VÉRIFICATIONS
    // ============================================================
    verifications: {
      existenceEmprunteur: {
        type: Boolean,
        default: false,
      },
      piecesRecues: {
        type: Boolean,
        default: false,
      },
      conditionsContrat: {
        type: Boolean,
        default: false,
      },
      commentaire: {
        type: String,
        trim: true,
      },
    },

    // ============================================================
    // 6. STATUT DU WORKFLOW
    // ============================================================
    statut: {
      type: String,
      enum: ['A_VERIFIER', 'VALIDE', 'REFUSE', 'PAYE'],
      default: 'A_VERIFIER',
    },

    // ============================================================
    // 7. DATES CLÉS
    // ============================================================
    dateDeclaration: {
      type: Date,
      default: Date.now,
    },
    dateValidation: {
      type: Date,
      default: null,
    },
    datePaiement: {
      type: Date,
      default: null,
    },
    dateLimiteTraitement: {
      type: Date,
      default: function() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
    },

    // ============================================================
    // 8. TRACABILITÉ
    // ============================================================
    notes: {
      type: String,
      trim: true,
    },
    historique: [
      {
        action: {
          type: String,
          enum: [
            'DECLARATION',
            'AJOUT_JUSTIFICATIF',
            'VERIFICATION',
            'VALIDATION',
            'REFUS',
            'PAIEMENT',
          ],
        },
        commentaire: String,
        date: {
          type: Date,
          default: Date.now,
        },
        utilisateur: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],

    // ============================================================
    // 9. UTILISATEURS
    // ============================================================
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur créateur est obligatoire'],
    },
    validePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    modifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ============================================================
    // 10. MÉTADONNÉES
    // ============================================================
    estActif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEX (uniques, sans doublons)
// ============================================================

SinistreSchema.index({ statut: 1 });
SinistreSchema.index({ sfdId: 1 });
SinistreSchema.index({ dateSinistre: -1 });
SinistreSchema.index({ dateDeclaration: -1 });
SinistreSchema.index({ adhesionId: 1 });

// ============================================================
// VIRTUAL
// ============================================================

SinistreSchema.virtual('dureeTraitement').get(function() {
  if (!this.dateValidation) return null;
  const diff = this.dateValidation - this.dateDeclaration;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ============================================================
// MÉTHODES
// ============================================================

SinistreSchema.methods.toutesPiecesRecues = function() {
  const typesRequis = ['ACTE_DECES', 'PIECE_IDENTITE'];
  const typesRecus = this.justificatifs.map(j => j.type);
  return typesRequis.every(type => typesRecus.includes(type));
};

SinistreSchema.methods.estValide = function() {
  return this.statut === 'VALIDE';
};

SinistreSchema.methods.estEnAttente = function() {
  return this.statut === 'A_VERIFIER';
};

SinistreSchema.methods.ajouterHistorique = function(action, commentaire, utilisateurId) {
  this.historique.push({
    action,
    commentaire,
    utilisateur: utilisateurId,
    date: new Date(),
  });
};

SinistreSchema.methods.estEnRetard = function() {
  if (this.statut === 'PAYE' || this.statut === 'REFUSE') return false;
  return new Date() > this.dateLimiteTraitement;
};

module.exports = mongoose.model('Sinistre', SinistreSchema);