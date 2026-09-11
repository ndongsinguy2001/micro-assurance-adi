// backend/src/models/SuiviIntermediation.js
const mongoose = require('mongoose');

/**
 * 📊 SuiviIntermediation - Journal des événements par SFD/mois
 */
const SuiviIntermediationSchema = new mongoose.Schema(
  {
    sfdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
      required: true,
    },
    mois: { type: Number, required: true, min: 1, max: 12 },
    annee: { type: Number, required: true },
    reportingMensuelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingMensuel',
    },

    // ============================================================
    // DATES CLÉS (journal)
    // ============================================================
    dateEnvoiTemplate: { type: Date, default: null },
    dateReceptionReporting: { type: Date, default: null },
    dateEnvoiExclusions: { type: Date, default: null },
    dateReceptionCorrection: { type: Date, default: null },
    dateClotureReporting: { type: Date, default: null },
    dateEnvoiDocuments: { type: Date, default: null },
    dateReceptionPreuvePaiement: { type: Date, default: null },
    dateEnvoiFacture: { type: Date, default: null },
    datePaiementFacture: { type: Date, default: null },
    dateEnvoiCR: { type: Date, default: null },
    datePaiementPB: { type: Date, default: null },

    // ============================================================
    // STATUT
    // ============================================================
    statut: {
      type: String,
      enum: ['EN_COURS', 'TERMINE', 'EN_RETARD'],
      default: 'EN_COURS',
    },

    // ============================================================
    // RELANCES (manuelles)
    // ============================================================
    relances: [
      {
        type: {
          type: String,
          enum: [
            'REPORTING_NON_RECU',
            'EXCLUSIONS_NON_CORRIGEES',
            'PREUVE_PAIEMENT_NON_RECUE',
            'FACTURE_NON_PAYEE',
            'AUTRE',
          ],
        },
        date: { type: Date, default: Date.now },
        destinataire: String,
        message: String,
        utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    notes: { type: String, trim: true },
    creePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SuiviIntermediationSchema.index({ sfdId: 1, mois: 1, annee: 1 }, { unique: true });
SuiviIntermediationSchema.index({ statut: 1 });

module.exports =
  mongoose.models.SuiviIntermediation ||
  mongoose.model('SuiviIntermediation', SuiviIntermediationSchema);