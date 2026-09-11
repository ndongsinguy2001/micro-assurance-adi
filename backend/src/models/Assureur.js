// backend/src/models/Assureur.js
const mongoose = require('mongoose');

const AssureurSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom de l\'assureur est obligatoire'],
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Le code de l\'assureur est obligatoire'],
    unique: true, // ✅ UNIQUE ici
    uppercase: true,
    trim: true,
  },
  contact: {
    nom: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    telephone: {
      type: String,
      trim: true,
    },
  },
  adresse: {
    type: String,
    trim: true,
  },
  pays: {
    type: String,
    default: 'Sénégal',
    trim: true,
  },
  statut: {
    type: String,
    enum: ['ACTIF', 'INACTIF'],
    default: 'ACTIF',
  },
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

// ✅ Index sans doublon
AssureurSchema.index({ statut: 1 });

module.exports = mongoose.models.Assureur || mongoose.model('Assureur', AssureurSchema);
