// backend/src/models/Facture.js
const mongoose = require('mongoose');

/**
 * 📄 Facture - Facture trimestrielle des commissions IG
 * Émise par IG à destination de l'assureur
 */
const FactureSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      default: Date.now,
    },

    // ============================================================
    // 2. DESTINATAIRE (SNAPSHOT)
    // ============================================================
    sfd: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SFD',
        required: true,
      },
      nom: String,
      code: String,
      contact: {
        nom: String,
        email: String,
        telephone: String,
      },
      adresse: String,
      pays: { type: String, default: 'Sénégal' },
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
      trimestre: {
        type: Number,
        required: true,
        min: 1,
        max: 4,
      },
      annee: {
        type: Number,
        required: true,
      },
      mois: [{ type: Number, min: 1, max: 12 }],
      debut: Date,
      fin: Date,
      tauxChange: {
        type: Number,
        default: 1,
      },
    },

    // ============================================================
    // 5. REPORTINGS INCLUS
    // ============================================================
    reportings: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportingMensuel' },
        mois: Number,
        annee: Number,
        totalPrime: Number,
        nombreAdhesions: Number,
        nombreExclusions: Number,
      },
    ],

    // ============================================================
    // 6. MONTANTS
    // ============================================================
    montants: {
      totalPrimes: { type: Number, default: 0, min: 0 },
      tauxCommission: { type: Number, default: 0.15 },
      commissionIG: { type: Number, default: 0, min: 0 },
      tauxTVA: { type: Number, default: 0.18 },
      tva: { type: Number, default: 0, min: 0 },
      totalTTC: { type: Number, default: 0, min: 0 },
      totalTTCDevise: { type: Number, default: 0 },
    },

    // ============================================================
    // 7. DÉTAILS
    // ============================================================
    details: {
      nombreReportings: { type: Number, default: 0 },
      nombreAdhesions: { type: Number, default: 0 },
      nombreExclusions: { type: Number, default: 0 },
    },

    // ============================================================
    // 8. STATUT
    // ============================================================
    statut: {
      type: String,
      enum: ['GENEREE', 'ENVOYEE', 'PAYEE', 'ANNULEE'],
      default: 'GENEREE',
    },

    // ============================================================
    // 9. FICHIERS
    // ============================================================
    pdfPath: { type: String },
    pdfNom: { type: String },

    // ============================================================
    // 10. DATES CLÉS
    // ============================================================
    dateGeneration: { type: Date, default: Date.now },
    dateEnvoi: { type: Date, default: null },
    datePaiement: { type: Date, default: null },

    // ============================================================
    // 11. PAIEMENT
    // ============================================================
    referencePaiement: { type: String, trim: true },
    montantPaye: { type: Number, default: 0, min: 0 },
    motifAnnulation: { type: String, trim: true },

    // ============================================================
    // 12. NOTES
    // ============================================================
    notes: { type: String, trim: true },

    // ============================================================
    // 13. TRACABILITÉ
    // ============================================================
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
FactureSchema.index({ 'sfd._id': 1, statut: 1 });
FactureSchema.index({ 'periode.annee': 1, 'periode.trimestre': 1 });
FactureSchema.index({ statut: 1 });
FactureSchema.index({ dateGeneration: -1 });

// ============================================================
// VIRTUAL
// ============================================================
FactureSchema.virtual('estPayee').get(function () {
  return this.statut === 'PAYEE';
});

FactureSchema.virtual('estAnnulee').get(function () {
  return this.statut === 'ANNULEE';
});

FactureSchema.virtual('periodeLabel').get(function () {
  return `T${this.periode.trimestre} ${this.periode.annee}`;
});

// ============================================================
// MÉTHODES
// ============================================================
FactureSchema.methods.marquerEnvoyee = function () {
  this.statut = 'ENVOYEE';
  this.dateEnvoi = new Date();
  return this;
};

FactureSchema.methods.marquerPayee = function (montant, reference, commentaire) {
  this.statut = 'PAYEE';
  this.datePaiement = new Date();
  this.montantPaye = montant || this.montants.totalTTC;
  this.referencePaiement = reference;
  if (commentaire) {
    this.notes = this.notes
      ? `${this.notes}\nPaiement: ${commentaire}`
      : `Paiement: ${commentaire}`;
  }
  return this;
};

FactureSchema.methods.annuler = function (motif) {
  this.statut = 'ANNULEE';
  this.motifAnnulation = motif;
  return this;
};

module.exports = mongoose.models.Facture || mongoose.model('Facture', FactureSchema);