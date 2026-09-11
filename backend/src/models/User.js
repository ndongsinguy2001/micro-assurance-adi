const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  motDePasse: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['ADMIN', 'GESTIONNAIRE_IG', 'SFD', 'ASSUREUR'],
    default: 'GESTIONNAIRE_IG',
  },
  sfdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SFD',
  },
  assureurId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assureur',
  },
  permissions: [String],
  actif: {
    type: Boolean,
    default: true,
  },
  derniereConnexion: Date,
}, {
  timestamps: true,
});

// ✅ Supprimer pre('save') - on va hacher dans le contrôleur

// Comparer le mot de passe
UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.motDePasse);
};

module.exports = mongoose.model('User', UserSchema);