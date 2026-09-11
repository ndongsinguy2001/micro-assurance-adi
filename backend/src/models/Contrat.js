// backend/src/models/Contrat.js
const mongoose = require('mongoose');

/**
 * 📄 Contrat - Paramètres du contrat d'assurance ADI
 * Lie un SFD à un Assureur avec toutes les conditions de souscription
 */
const ContratSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. IDENTIFICATION
    // ============================================================
    nom: {
      type: String,
      required: [true, 'Le nom du contrat est obligatoire'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Le code du contrat est obligatoire'],
      unique: true, // ✅ UNIQUE ici
      uppercase: true,
      trim: true,
    },

    // ============================================================
    // 2. RÉFÉRENCES
    // ============================================================
    sfdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
      required: [true, 'Le SFD est obligatoire'],
    },
    assureurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assureur',
      required: [true, "L'assureur est obligatoire"],
    },

    // ============================================================
    // 3. CONDITIONS DE SOUSCRIPTION (Âge)
    // ============================================================
    ageMin: {
      type: Number,
      default: 18,
      min: [0, "L'âge minimum ne peut pas être négatif"],
    },
    ageMaxDebut: {
      type: Number,
      default: 64,
      min: [0, "L'âge maximum ne peut pas être négatif"],
    },
    ageMaxFin: {
      type: Number,
      default: 65,
      min: [0, "L'âge maximum de fin ne peut pas être négatif"],
    },

    // ============================================================
    // 4. CONDITIONS DE SOUSCRIPTION (Prêt)
    // ============================================================
    dureeMin: {
      type: Number,
      default: 1,
      min: [0, 'La durée minimum ne peut pas être négative'],
    },
    dureeMax: {
      type: Number,
      default: null,
    },
    montantMin: {
      type: Number,
      default: 0,
      min: [0, 'Le montant minimum ne peut pas être négatif'],
    },
    montantMax: {
      type: Number,
      default: 25000000,
      min: [0, 'Le montant maximum ne peut pas être négatif'],
    },

    // ============================================================
    // 5. TARIFICATION
    // ============================================================
    tauxPrime1: {
      type: Number,
      default: 0.0065,
      min: [0, 'Le taux de prime ne peut pas être négatif'],
    },
    tauxPrime2: {
      type: Number,
      default: 0.0163,
      min: [0, 'Le taux de prime 2 ne peut pas être négatif'],
    },
    seuilPrime2: {
      type: Number,
      default: 14000000,
      min: [0, 'Le seuil de prime 2 ne peut pas être négatif'],
    },

    // ============================================================
    // 6. FRAIS ET TAXES
    // ============================================================
    tauxFraisGestion: {
      type: Number,
      default: 0.08,
      min: [0, 'Le taux de frais de gestion ne peut pas être négatif'],
    },
    tauxTaxe: {
      type: Number,
      default: 0,
      min: [0, 'Le taux de taxe ne peut pas être négatif'],
    },

    // ============================================================
    // 7. COMMISSIONS
    // ============================================================
    tauxCommissionSFD: {
      type: Number,
      default: 0.07,
      min: [0, 'La commission SFD ne peut pas être négative'],
    },
    tauxCommissionAssureur: {
      type: Number,
      default: 0.05,
      min: [0, 'La commission Assureur ne peut pas être négative'],
    },
    tauxCommissionIG: {
      type: Number,
      default: 0.15,
      min: [0, 'La commission IG ne peut pas être négative'],
    },

    // ============================================================
    // 8. GESTION DES SINISTRES
    // ============================================================
    typeGestionSinistres: {
      type: String,
      enum: {
        values: ['COMPENSATION', 'DIRECT'],
        message: 'Le type de gestion doit être COMPENSATION ou DIRECT',
      },
      default: 'COMPENSATION',
      required: [true, 'Le type de gestion des sinistres est obligatoire'],
    },
    tauxRemboursementPret: {
      type: Number,
      default: 1,
      min: [0, 'Le taux de remboursement ne peut pas être négatif'],
      max: [1, 'Le taux de remboursement ne peut pas dépasser 1'],
    },

    // ============================================================
    // 9. DATES
    // ============================================================
    dateEffet: {
      type: Date,
      default: Date.now,
    },
    dateEffetAvenant: {
      type: Date,
    },

    // ============================================================
    // 10. STATUT
    // ============================================================
    statut: {
      type: String,
      enum: {
        values: ['ACTIF', 'INACTIF'],
        message: 'Le statut doit être ACTIF ou INACTIF',
      },
      default: 'ACTIF',
    },

    // ============================================================
    // 11. TRACABILITÉ
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
// INDEX - ✅ UNIQUEMENT ICI, PAS DE 'unique: true' DANS LE SCHÉMA
// ============================================================
// ✅ Ne pas utiliser unique:true dans le schéma ET ici
// ✅ Un seul endroit pour définir les index

ContratSchema.index({ sfdId: 1, statut: 1 });
ContratSchema.index({ assureurId: 1 });
// L'index sur code est déjà défini par 'unique: true' dans le schéma

// ============================================================
// VIRTUAL
// ============================================================
ContratSchema.virtual('estActif').get(function () {
  return this.statut === 'ACTIF';
});

ContratSchema.virtual('estValide').get(function () {
  const today = new Date();
  return this.statut === 'ACTIF' && this.dateEffet <= today;
});

// ============================================================
// MÉTHODES
// ============================================================
ContratSchema.methods.calculerPrime = function (montantPret) {
  if (!montantPret || montantPret <= 0) return 0;
  const taux = montantPret <= this.seuilPrime2 ? this.tauxPrime1 : this.tauxPrime2;
  return montantPret * taux;
};

ContratSchema.methods.calculerMontantDu = function (prime) {
  const fraisGestion = prime * this.tauxFraisGestion;
  const taxes = prime * this.tauxTaxe;
  return prime + fraisGestion + taxes;
};

ContratSchema.methods.verifierAge = function (age, dureePret) {
  if (!age || age < this.ageMin) return false;
  if (age > this.ageMaxDebut) return false;
  const ageFin = age + dureePret / 12;
  if (ageFin > this.ageMaxFin) return false;
  return true;
};

ContratSchema.methods.verifierMontant = function (montant) {
  if (!montant) return false;
  if (montant < this.montantMin) return false;
  if (montant > this.montantMax) return false;
  return true;
};

ContratSchema.methods.verifierDuree = function (duree) {
  if (!duree) return false;
  if (duree < this.dureeMin) return false;
  if (this.dureeMax && duree > this.dureeMax) return false;
  return true;
};

module.exports = mongoose.models.Contrat || mongoose.model('Contrat', ContratSchema);