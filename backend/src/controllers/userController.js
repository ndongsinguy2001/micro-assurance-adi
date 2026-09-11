// backend/src/controllers/userController.js
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SFD = require('../models/SFD');
const Assureur = require('../models/Assureur');

// ============================================================
// 1. LISTE DES UTILISATEURS
// ============================================================
const getUsers = async (req, res) => {
  try {
    const { role, actif, search, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (actif !== undefined && actif !== '') filter.actif = actif === 'true';

    if (search) {
      filter.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-motDePasse')
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Erreur getUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des utilisateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 2. DÉTAILS D'UN UTILISATEUR
// ============================================================
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-motDePasse')
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('❌ Erreur getUserById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 3. CRÉER UN UTILISATEUR
// ============================================================
const createUser = async (req, res) => {
  try {
    const { nom, email, motDePasse, role, sfdId, assureurId, actif } = req.body;

    // Validation
    if (!nom || !email || !motDePasse || !role) {
      return res.status(400).json({
        success: false,
        message: 'nom, email, motDePasse et role sont obligatoires',
      });
    }

    if (motDePasse.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères',
      });
    }

    const validRoles = ['ADMIN', 'GESTIONNAIRE_IG', 'SFD', 'ASSUREUR'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Rôle invalide. Valeurs possibles : ${validRoles.join(', ')}`,
      });
    }

    // Vérifier email unique
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé',
      });
    }

    // Validation des rattachements
    if (role === 'SFD' && !sfdId) {
      return res.status(400).json({
        success: false,
        message: 'Un SFD doit être rattaché pour ce rôle',
      });
    }
    if (role === 'ASSUREUR' && !assureurId) {
      return res.status(400).json({
        success: false,
        message: 'Un assureur doit être rattaché pour ce rôle',
      });
    }

    // Vérifier que le SFD/assureur existe
    if (sfdId) {
      const sfd = await SFD.findById(sfdId);
      if (!sfd) {
        return res.status(400).json({ success: false, message: 'SFD non trouvé' });
      }
    }
    if (assureurId) {
      const assureur = await Assureur.findById(assureurId);
      if (!assureur) {
        return res.status(400).json({ success: false, message: 'Assureur non trouvé' });
      }
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(motDePasse, 10);

    const user = await User.create({
      nom,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      role,
      sfdId: role === 'SFD' ? sfdId : undefined,
      assureurId: role === 'ASSUREUR' ? assureurId : undefined,
      actif: actif !== undefined ? actif : true,
    });

    // Recharger sans mot de passe
    const userSafe = await User.findById(user._id)
      .select('-motDePasse')
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code');

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: userSafe,
    });
  } catch (error) {
    console.error('❌ Erreur createUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 4. MODIFIER UN UTILISATEUR (sans mot de passe)
// ============================================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, email, role, sfdId, assureurId, actif } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    // Empêcher l'auto-désactivation
    if (req.user._id.toString() === id && actif === false) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas désactiver votre propre compte',
      });
    }

    // Empêcher l'auto-changement de rôle (pour ne pas se retirer ADMIN par erreur)
    if (req.user._id.toString() === id && role && role !== user.role) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre rôle',
      });
    }

    // Vérifier email unique si modifié
    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        });
      }
    }

    // Construire les updates
    const updates = {};
    if (nom) updates.nom = nom;
    if (email) updates.email = email.toLowerCase();
    if (role) {
      const validRoles = ['ADMIN', 'GESTIONNAIRE_IG', 'SFD', 'ASSUREUR'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Rôle invalide. Valeurs possibles : ${validRoles.join(', ')}`,
        });
      }
      updates.role = role;
    }
    if (actif !== undefined) updates.actif = actif;

    // Gérer les rattachements selon le rôle final
    const finalRole = updates.role || user.role;
    if (finalRole === 'SFD') {
      if (sfdId) {
        const sfd = await SFD.findById(sfdId);
        if (!sfd) return res.status(400).json({ success: false, message: 'SFD non trouvé' });
        updates.sfdId = sfdId;
      }
      updates.assureurId = undefined;
    } else if (finalRole === 'ASSUREUR') {
      if (assureurId) {
        const assureur = await Assureur.findById(assureurId);
        if (!assureur)
          return res.status(400).json({ success: false, message: 'Assureur non trouvé' });
        updates.assureurId = assureurId;
      }
      updates.sfdId = undefined;
    } else {
      // ADMIN ou GESTIONNAIRE_IG → pas de rattachement
      updates.sfdId = undefined;
      updates.assureurId = undefined;
    }

    const updated = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .select('-motDePasse')
      .populate('sfdId', 'nom code')
      .populate('assureurId', 'nom code');

    res.status(200).json({
      success: true,
      message: 'Utilisateur modifié avec succès',
      data: updated,
    });
  } catch (error) {
    console.error('❌ Erreur updateUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 5. CHANGER LE MOT DE PASSE
// ============================================================
const changerMotDePasse = async (req, res) => {
  try {
    const { id } = req.params;
    const { nouveauMotDePasse } = req.body;

    if (!nouveauMotDePasse || nouveauMotDePasse.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
    user.motDePasse = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur changerMotDePasse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 6. ACTIVER / DÉSACTIVER
// ============================================================
const toggleActif = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier l\'état de votre propre compte',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    user.actif = !user.actif;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Utilisateur ${user.actif ? 'activé' : 'désactivé'}`,
      data: { actif: user.actif },
    });
  } catch (error) {
    console.error('❌ Erreur toggleActif:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ============================================================
// 7. SUPPRIMER UN UTILISATEUR
// ============================================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    // Empêcher la suppression du dernier ADMIN
    if (user.role === 'ADMIN') {
      const nbAdmins = await User.countDocuments({ role: 'ADMIN', actif: true });
      if (nbAdmins <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer le dernier administrateur actif',
        });
      }
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Utilisateur supprimé avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur deleteUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  changerMotDePasse,
  toggleActif,
  deleteUser,
};