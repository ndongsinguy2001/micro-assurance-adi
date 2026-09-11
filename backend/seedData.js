// backend/seedData.js
require('dotenv').config();
const mongoose = require('mongoose');

// Importer les modèles
const Assureur = require('./src/models/Assureur');
const SFD = require('./src/models/SFD');
const Contrat = require('./src/models/Contrat');

const seedData = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connexion établie');

    // 1. Récupérer l'assureur existant
    const assureur = await Assureur.findOne({ code: 'ALLIANZ' });
    if (!assureur) {
      console.log('❌ Assureur non trouvé. Exécutez d\'abord node seed.js');
      process.exit(1);
    }
    console.log('✅ Assureur trouvé:', assureur.nom);

    // 2. Créer un SFD
    const sfd = await SFD.create({
      nom: 'IMCEC MBOUR',
      code: 'IMCEC001',
      pays: 'Sénégal',
      region: 'Thiès',
      contact: {
        nom: 'Directeur IMCEC',
        email: 'contact@imcec.sn',
        telephone: '+221 33 123 4567'
      },
      assureurId: assureur._id,
      dateDebutContrat: new Date('2024-01-01'),
      dateFinContrat: new Date('2025-12-31'),
      statut: 'ACTIF',
      parametresSpecifiques: {
        tauxCommissionSFD: 0.07,
        tauxCommissionIG: 0.15,
        typeGestionSinistres: 'COMPENSATION'
      }
    });
    console.log('✅ SFD créé:', sfd.nom);

    // 3. Créer un contrat lié au SFD
    const contrat = await Contrat.create({
      nom: 'Contrat U-IMCEC MBOUR',
      code: 'CTR-IMCEC-001',
      sfdId: sfd._id,
      assureurId: assureur._id,
      ageMin: 18,
      ageMaxDebut: 64,
      ageMaxFin: 65,
      dureeMin: 1,
      dureeMax: null,
      montantMin: 0,
      montantMax: 25000000,
      tauxPrime1: 0.0065,
      tauxPrime2: 0.0163,
      seuilPrime2: 14000000,
      tauxFraisGestion: 0.08,
      tauxTaxe: 0,
      tauxCommissionSFD: 0.07,
      tauxCommissionAssureur: 0.05,
      tauxCommissionIG: 0.15,
      typeGestionSinistres: 'COMPENSATION',
      tauxRemboursementPret: 1,
      dateEffet: new Date('2024-01-01'),
      statut: 'ACTIF'
    });
    console.log('✅ Contrat créé:', contrat.nom);

    // Mettre à jour le SFD avec l'ID du contrat
    sfd.contratId = contrat._id;
    await sfd.save();
    console.log('✅ SFD mis à jour avec le contrat');

    console.log('\n📊 Données créées avec succès !');
    console.log(`   - Assureur: ${assureur.nom}`);
    console.log(`   - SFD: ${sfd.nom}`);
    console.log(`   - Contrat: ${contrat.nom}`);

    // Fermer la connexion
    await mongoose.disconnect();
    console.log('✅ Déconnexion réussie');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
};

seedData();