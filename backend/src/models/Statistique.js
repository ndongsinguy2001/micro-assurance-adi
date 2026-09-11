// backend/src/models/Statistique.js
const mongoose = require('mongoose');

const StatistiqueSchema = new mongoose.Schema({
  pays: {
    type: String,
    required: true,
    default: 'Sénégal',
    trim: true,
  },
  annee: {
    type: Number,
    required: true,
  },
  mois: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  // Indicateurs
  nbHommes: {
    type: Number,
    default: 0,
  },
  nbFemmes: {
    type: Number,
    default: 0,
  },
  nbPM: {
    type: Number,
    default: 0,
  },
  capitalAssure: {
    type: Number,
    default: 0,
  },
  primeTotale: {
    type: Number,
    default: 0,
  },
  nbSinistres: {
    type: Number,
    default: 0,
  },
  montantSinistres: {
    type: Number,
    default: 0,
  },
  commissionGestionIMF: {
    type: Number,
    default: 0,
  },
  montantDuAssureur: {
    type: Number,
    default: 0,
  },
  montantPayeSFD: {
    type: Number,
    default: 0,
  },
  commissionsFacturees: {
    type: Number,
    default: 0,
  },
  commissionsEncaissees: {
    type: Number,
    default: 0,
  },
  montantPayeAllianz: {
    type: Number,
    default: 0,
  },
  // Métadonnées
  creePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  modifiePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Index unique par pays, année, mois
StatistiqueSchema.index({ pays: 1, annee: 1, mois: 1 }, { unique: true });

module.exports = mongoose.model('Statistique', StatistiqueSchema);