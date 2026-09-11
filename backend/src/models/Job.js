const mongoose = require('mongoose');

/**
 * ⚙️ Job - Suivi des traitements asynchrones
 */
const JobSchema = new mongoose.Schema(
  {
    // ============================================================
    // 1. IDENTIFICATION
    // ============================================================
    type: {
      type: String,
      enum: [
        'IMPORT_REPORTING',
        'GENERATION_CLOTURE',
        'CALCUL_COMMISSIONS',
        'GENERATION_CR',
        'EXPORT_DONNEES',
        'GENERATION_FACTURES',
      ],
      required: [true, 'Le type de job est obligatoire'],
    },
    code: {
      type: String,
      trim: true,
      // ✅ Supprimer unique: true ici pour éviter le doublon
    },

    // ============================================================
    // 2. STATUT
    // ============================================================
    statut: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
    },
    progression: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    message: {
      type: String,
      trim: true,
      default: 'En attente de traitement',
    },

    // ============================================================
    // 3. DONNÉES DU JOB
    // ============================================================
    donnees: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resultat: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ============================================================
    // 4. ERREURS
    // ============================================================
    erreurs: [
      {
        ligne: {
          type: Number,
          default: 0,
        },
        champ: {
          type: String,
          trim: true,
        },
        message: {
          type: String,
          required: true,
        },
        donnees: {
          type: mongoose.Schema.Types.Mixed,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ============================================================
    // 5. TEMPORISATION
    // ============================================================
    dateDebut: {
      type: Date,
      default: null,
    },
    dateFin: {
      type: Date,
      default: null,
    },
    dureeExecution: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // 6. RÉFÉRENCES
    // ============================================================
    reportingMensuelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingMensuel',
    },
    sfdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
    },
    utilisateurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ============================================================
    // 7. PRIORITÉ
    // ============================================================
    priorite: {
      type: String,
      enum: ['BASSE', 'NORMALE', 'HAUTE', 'URGENTE'],
      default: 'NORMALE',
    },

    // ============================================================
    // 8. LOGS
    // ============================================================
    logs: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        niveau: {
          type: String,
          enum: ['INFO', 'WARNING', 'ERROR'],
          default: 'INFO',
        },
        message: {
          type: String,
          required: true,
        },
        details: {
          type: mongoose.Schema.Types.Mixed,
        },
      },
    ],

    // ============================================================
    // 9. TRACABILITÉ
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
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEX (uniques, sans doublons)
// ============================================================

// ✅ Index unique sur le code (défini ici seulement)
JobSchema.index({ code: 1 }, { unique: true });

JobSchema.index({ statut: 1, type: 1 });

// TTL pour nettoyer les jobs terminés après 30 jours
JobSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 30,
    partialFilterExpression: {
      statut: { $in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
    },
  }
);

// ============================================================
// MÉTHODES
// ============================================================

JobSchema.methods.demarrer = function() {
  this.statut = 'PROCESSING';
  this.dateDebut = new Date();
  this.message = 'Traitement en cours...';
  return this;
};

JobSchema.methods.terminer = function(resultat, message) {
  this.statut = 'COMPLETED';
  this.dateFin = new Date();
  this.dureeExecution = this.dateFin - this.dateDebut;
  this.progression = 100;
  this.message = message || 'Traitement terminé avec succès';
  if (resultat) this.resultat = resultat;
  return this;
};

JobSchema.methods.echouer = function(message, erreurs) {
  this.statut = 'FAILED';
  this.dateFin = new Date();
  this.dureeExecution = this.dateFin - this.dateDebut;
  this.message = message || 'Le traitement a échoué';
  if (erreurs) {
    if (Array.isArray(erreurs)) {
      this.erreurs = this.erreurs.concat(erreurs);
    } else {
      this.erreurs.push(erreurs);
    }
  }
  return this;
};

JobSchema.methods.annuler = function(message) {
  this.statut = 'CANCELLED';
  this.message = message || 'Job annulé par l\'utilisateur';
  return this;
};

JobSchema.methods.ajouterLog = function(niveau, message, details) {
  this.logs.push({
    date: new Date(),
    niveau,
    message,
    details,
  });
  return this;
};

JobSchema.methods.mettreAJourProgression = function(valeur, message) {
  this.progression = Math.min(100, Math.max(0, valeur));
  if (message) this.message = message;
  return this;
};

JobSchema.methods.estTermine = function() {
  return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(this.statut);
};

JobSchema.methods.estEnCours = function() {
  return this.statut === 'PROCESSING';
};

module.exports = mongoose.model('Job', JobSchema);