// backend/src/controllers/assureurController.js
const Assureur = require('../models/Assureur');
const Contrat = require('../models/Contrat');
const SFD = require('../models/SFD');

// ============================================================
// 1. CRÉER UN ASSUREUR
// ============================================================

/**
 * @route   POST /api/assureurs
 * @desc    Créer un nouvel assureur
 * @access  Private (ADMIN)
 */
const createAssureur = async (req, res) => {
  try {
    const { nom, code, contact, adresse, pays } = req.body;

    // Vérifier si l'assureur existe déjà
    const existingAssureur = await Assureur.findOne({ code });
    if (existingAssureur) {
      return res.status(400).json({
        success: false,
        message: 'Un assureur avec ce code existe déjà'
      });
    }

    const assureur = await Assureur.create({
      nom,
      code: code.toUpperCase(),
      contact,
      adresse,
      pays: pays || 'Sénégal',
      statut: 'ACTIF',
      creePar: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Assureur créé avec succès',
      data: assureur
    });
  } catch (error) {
    console.error('❌ Erreur createAssureur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'assureur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================================
// 2. LISTE DES ASSUREURS
// ============================================================

/**
 * @route   GET /api/assureurs
 * @desc    Liste des assureurs avec filtres
 * @access  Private
 */
const getAssureurs = async (req, res) => {
  try {
    const { statut, pays, search, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (statut) filter.statut = statut;
    if (pays) filter.pays = pays;
    
    if (search) {
      filter.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'contact.nom': { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const assureurs = await Assureur.find(filter)
      .sort({ nom: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Assureur.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: assureurs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Erreur getAssureurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des assureurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================================
// 3. DÉTAILS D'UN ASSUREUR
// ============================================================

/**
 * @route   GET /api/assureurs/:id
 * @desc    Détails d'un assureur
 * @access  Private
 */
const getAssureurById = async (req, res) => {
  try {
    const assureur = await Assureur.findById(req.params.id);
    
    if (!assureur) {
      return res.status(404).json({
        success: false,
        message: 'Assureur non trouvé'
      });
    }
    
    // Récupérer les contrats associés
    const contrats = await Contrat.find({ assureurId: assureur._id })
      .populate('sfdId', 'nom code')
      .select('nom code sfdId statut dateEffet');
    
    res.status(200).json({
      success: true,
      data: {
        ...assureur.toObject(),
        contrats,
        nombreContrats: contrats.length
      }
    });
  } catch (error) {
    console.error('❌ Erreur getAssureurById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement de l\'assureur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================================
// 4. MODIFIER UN ASSUREUR
// ============================================================

/**
 * @route   PUT /api/assureurs/:id
 * @desc    Modifier un assureur
 * @access  Private (ADMIN)
 */
const updateAssureur = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const assureur = await Assureur.findById(id);
    if (!assureur) {
      return res.status(404).json({
        success: false,
        message: 'Assureur non trouvé'
      });
    }
    
    // Si le code est modifié, vérifier qu'il n'est pas déjà utilisé
    if (updates.code && updates.code !== assureur.code) {
      const existing = await Assureur.findOne({ code: updates.code.toUpperCase() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Ce code est déjà utilisé par un autre assureur'
        });
      }
    }
    
    updates.modifiePar = req.user._id;
    const updatedAssureur = await Assureur.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Assureur modifié avec succès',
      data: updatedAssureur
    });
  } catch (error) {
    console.error('❌ Erreur updateAssureur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification de l\'assureur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================================
// 5. SUPPRIMER UN ASSUREUR
// ============================================================

/**
 * @route   DELETE /api/assureurs/:id
 * @desc    Supprimer un assureur
 * @access  Private (ADMIN)
 */
const deleteAssureur = async (req, res) => {
  try {
    const { id } = req.params;
    
    const assureur = await Assureur.findById(id);
    if (!assureur) {
      return res.status(404).json({
        success: false,
        message: 'Assureur non trouvé'
      });
    }
    
    // Vérifier si des contrats sont associés
    const contrats = await Contrat.countDocuments({ assureurId: id });
    if (contrats > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer: ${contrats} contrat(s) sont associés à cet assureur`
      });
    }
    
    await Assureur.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Assureur supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteAssureur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'assureur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createAssureur,
  getAssureurs,
  getAssureurById,
  updateAssureur,
  deleteAssureur
};