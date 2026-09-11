// backend/src/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ============================================================
// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
// @access  Public
// ============================================================
const register = async (req, res) => {
  try {
    const { nom, email, motDePasse, role, sfdId, assureurId } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(motDePasse, salt);

    // Créer l'utilisateur
    const user = await User.create({
      nom,
      email,
      motDePasse: hashedPassword,
      role: role || 'GESTIONNAIRE_IG',
      sfdId,
      assureurId,
      actif: true
    });

    // Générer le token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        user: {
          _id: user._id,
          nom: user.nom,
          email: user.email,
          role: user.role,
          actif: user.actif
        },
        token
      }
    });
  } catch (error) {
    console.error('❌ Erreur register:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'utilisateur',
      error: error.message
    });
  }
};

// ============================================================
// @desc    Connexion utilisateur
// @route   POST /api/auth/login
// @access  Public
// ============================================================
const login = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const user = await User.findOne({ email }).select('+motDePasse');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(motDePasse);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si le compte est actif
    if (!user.actif) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur'
      });
    }

    // Mettre à jour la dernière connexion
    user.derniereConnexion = new Date();
    await user.save({ validateBeforeSave: false });

    // Générer le token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          _id: user._id,
          nom: user.nom,
          email: user.email,
          role: user.role,
          actif: user.actif,
          sfdId: user.sfdId,
          assureurId: user.assureurId
        },
        token
      }
    });
  } catch (error) {
    console.error('❌ Erreur login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
};

// ============================================================
// @desc    Récupérer le profil utilisateur
// @route   GET /api/auth/me
// @access  Private
// ============================================================
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-motDePasse')
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur getMe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe
};