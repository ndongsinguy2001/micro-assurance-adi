// backend/src/models/PreuvePaiement.js
const mongoose = require('mongoose');

/**
 * 💰 PreuvePaiement - Traçabilité des paiements entre parties
 * Types : SFD→Assureur, Assureur→IG, Assureur→SFD
 */
const PreuvePaiementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['SFD_VERS_ASSUREUR', 'ASSUREUR_VERS_IG', 'ASSUREUR_VERS_SFD'],
      required: [true, 'Le type de paiement est obligatoire'],
    },

    sfdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SFD',
    },
    assureurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assureur',
    },
    factureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facture',
    },
    reportingMensuelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingMensuel',
    },

    montant: {
      type: Number,
      required: [true, 'Le montant est obligatoire'],
      min: 0,
    },
    devise: { type: String, default: 'XOF' },
    datePaiement: {
      type: Date,
      required: [true, 'La date de paiement est obligatoire'],
    },
    referencePaiement: { type: String, trim: true },

    periodeConcernee: {
      mois: [{ type: Number, min: 1, max: 12 }],
      annee: Number,
      trimestre: { type: Number, min: 1, max: 4 },
    },

    fichier: {
      nom: String,
      chemin: String,
      taille: Number,
      dateUpload: { type: Date, default: Date.now },
    },

    statut: {
      type: String,
      enum: ['RECUE', 'VERIFIEE', 'REJETEE'],
      default: 'RECUE',
    },

    verifiePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dateVerification: Date,
    commentaire: String,

    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    modifiePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PreuvePaiementSchema.index({ type: 1, statut: 1 });
PreuvePaiementSchema.index({ sfdId: 1, datePaiement: -1 });
PreuvePaiementSchema.index({ assureurId: 1 });
PreuvePaiementSchema.index({ factureId: 1 });

PreuvePaiementSchema.methods.verifier = function (userId, commentaire) {
  this.statut = 'VERIFIEE';
  this.verifiePar = userId;
  this.dateVerification = new Date();
  if (commentaire) this.commentaire = commentaire;
  return this;
};

PreuvePaiementSchema.methods.rejeter = function (userId, motif) {
  this.statut = 'REJETEE';
  this.verifiePar = userId;
  this.dateVerification = new Date();
  this.commentaire = motif;
  return this;
};

module.exports =
  mongoose.models.PreuvePaiement || mongoose.model('PreuvePaiement', PreuvePaiementSchema);