// backend/src/models/SFD.js
const mongoose = require('mongoose');

/**
 * 🏦 SFD - Institution de Microfinance
 * Représente une institution financière partenaire
 */
const SFDSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. IDENTIFICATION
    // ============================================================
    nom: {
      type: String,
      required: [true, 'Le nom du SFD est obligatoire'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Le code du SFD est obligatoire'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    pays: {
      type: String,
      default: 'Sénégal',
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    ville: {
      type: String,
      trim: true,
    },
    adresse: {
      type: String,
      trim: true,
    },
    numeroAgrement: {
      type: String,
      trim: true,
    },
    dateAgrement: {
      type: Date,
    },

    // ============================================================
    // 2. CONTACT
    // ============================================================
    contact: {
      nom: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      telephone: { type: String, trim: true },
    },

    // ============================================================
    // 3. RÉFÉRENCES
    // ============================================================
    assureurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assureur',
    },

    // ============================================================
    // 4. PÉRIODE DU CONTRAT
    // ============================================================
    dateDebutContrat: { type: Date },
    dateFinContrat: { type: Date },

    // ============================================================
    // 5. STATUT
    // ============================================================
    statut: {
      type: String,
      enum: {
        values: ['ACTIF', 'INACTIF', 'EXPIRE'],
        message: 'Le statut doit être ACTIF, INACTIF ou EXPIRE',
      },
      default: 'ACTIF',
    },

    // ============================================================
    // 6. PARAMÈTRES SPÉCIFIQUES
    // ============================================================
    parametresSpecifiques: {
      tauxCommissionSFD: {
        type: Number,
        default: 0.07,
        min: [0, 'La commission SFD ne peut pas être négative'],
        max: [1, 'La commission SFD ne peut pas dépasser 100%'],
      },
      tauxCommissionIG: {
        type: Number,
        default: 0.15,
        min: [0, 'La commission IG ne peut pas être négative'],
        max: [1, 'La commission IG ne peut pas dépasser 100%'],
      },
      typeGestionSinistres: {
        type: String,
        enum: {
          values: ['COMPENSATION', 'DIRECT'],
          message: 'Le type de gestion doit être COMPENSATION ou DIRECT',
        },
        default: 'COMPENSATION',
      },
    },

    // ============================================================
    // 7. TRACABILITÉ
    // ============================================================
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
SFDSchema.index({ statut: 1 });
SFDSchema.index({ pays: 1 });

// ============================================================
// VIRTUAL
// ============================================================
SFDSchema.virtual('estActif').get(function () {
  if (this.statut !== 'ACTIF') return false;
  const today = new Date();
  if (this.dateDebutContrat && this.dateDebutContrat > today) return false;
  if (this.dateFinContrat && this.dateFinContrat < today) return false;
  return true;
});

SFDSchema.virtual('estExpire').get(function () {
  if (this.statut === 'EXPIRE') return true;
  if (this.dateFinContrat && this.dateFinContrat < new Date()) return true;
  return false;
});

SFDSchema.virtual('nomComplet').get(function () {
  return `${this.nom} (${this.code})`;
});

SFDSchema.virtual('contactEmail').get(function () {
  return this.contact?.email || null;
});

// ============================================================
// MÉTHODES
// ============================================================
SFDSchema.methods.obtenirContrats = async function () {
  const Contrat = mongoose.model('Contrat');
  return await Contrat.find({ sfdId: this._id });
};

SFDSchema.methods.obtenirContratActif = async function () {
  const Contrat = mongoose.model('Contrat');
  return await Contrat.findOne({ sfdId: this._id, statut: 'ACTIF' });
};

module.exports = mongoose.models.SFD || mongoose.model('SFD', SFDSchema);