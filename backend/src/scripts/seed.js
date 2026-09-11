// backend/src/scripts/seed.js
/**
 * Script de seed initial
 * Usage : node src/scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');
const User = require('../models/User');
const SFD = require('../models/SFD');
const Assureur = require('../models/Assureur');
const Contrat = require('../models/Contrat');

const seed = async () => {
  try {
    await connectDB();

    console.log('🌱 Seed en cours...\n');

    // --- 1. ADMIN ---
    let admin = await User.findOne({ email: 'admin@ig.sn' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('AdminIG2026!', 10);
      admin = await User.create({
        nom: 'Administrateur IG',
        email: 'admin@ig.sn',
        motDePasse: hashedPassword,
        role: 'ADMIN',
        actif: true,
      });
      console.log('✅ Admin créé : admin@ig.sn / AdminIG2026!');
    } else {
      console.log('ℹ️  Admin déjà existant');
    }

    // --- 2. GESTIONNAIRE IG ---
    let gestionnaire = await User.findOne({ email: 'gestion@ig.sn' });
    if (!gestionnaire) {
      const hashedPassword = await bcrypt.hash('GestionIG2026!', 10);
      gestionnaire = await User.create({
        nom: 'Gestionnaire IG',
        email: 'gestion@ig.sn',
        motDePasse: hashedPassword,
        role: 'GESTIONNAIRE_IG',
        actif: true,
      });
      console.log('✅ Gestionnaire créé : gestion@ig.sn / GestionIG2026!');
    } else {
      console.log('ℹ️  Gestionnaire déjà existant');
    }

    // --- 3. ASSUREUR ---
    let assureur = await Assureur.findOne({ code: 'ALLIANZ' });
    if (!assureur) {
      assureur = await Assureur.create({
        nom: 'Allianz Africa',
        code: 'ALLIANZ',
        contact: {
          nom: 'Service Micro-Assurance',
          email: 'contact@allianz.sn',
          telephone: '+221 33 000 00 00',
        },
        adresse: 'Dakar, Sénégal',
        pays: 'Sénégal',
        statut: 'ACTIF',
        creePar: admin._id,
      });
      console.log('✅ Assureur créé : Allianz Africa');
    } else {
      console.log('ℹ️  Assureur déjà existant');
    }

    // --- 4. UTILISATEUR ASSUREUR ---
    let userAssureur = await User.findOne({ email: 'assureur@ig.sn' });
    if (!userAssureur) {
      const hashedPassword = await bcrypt.hash('Assureur2026!', 10);
      userAssureur = await User.create({
        nom: 'Représentant Allianz',
        email: 'assureur@ig.sn',
        motDePasse: hashedPassword,
        role: 'ASSUREUR',
        assureurId: assureur._id,
        actif: true,
      });
      console.log('✅ Utilisateur assureur créé : assureur@ig.sn / Assureur2026!');
    } else {
      console.log('ℹ️  Utilisateur assureur déjà existant');
    }

    // --- 5. SFD TEST ---
    let sfd = await SFD.findOne({ code: 'TEST_SFD' });
    if (!sfd) {
      sfd = await SFD.create({
        nom: 'SFD de test',
        code: 'TEST_SFD',
        pays: 'Sénégal',
        region: 'Dakar',
        ville: 'Dakar',
        adresse: 'Plateau, Dakar',
        contact: {
          nom: 'Contact Test',
          email: 'contact@testsfd.sn',
          telephone: '+221 77 000 00 00',
        },
        assureurId: assureur._id,
        dateDebutContrat: new Date(),
        statut: 'ACTIF',
        creePar: admin._id,
      });
      console.log('✅ SFD créé : SFD de test (TEST_SFD)');
    } else {
      console.log('ℹ️  SFD déjà existant');
    }

    // --- 6. CONTRAT TEST ---
    let contrat = await Contrat.findOne({ code: 'CTR-TEST-001' });
    if (!contrat) {
      contrat = await Contrat.create({
        nom: 'Contrat Test Allianz',
        code: 'CTR-TEST-001',
        sfdId: sfd._id,
        assureurId: assureur._id,
        statut: 'ACTIF',
        creePar: admin._id,
      });
      console.log('✅ Contrat créé : CTR-TEST-001');
    } else {
      console.log('ℹ️  Contrat déjà existant');
    }

    // --- 7. UTILISATEUR SFD ---
    let userSFD = await User.findOne({ email: 'sfd@ig.sn' });
    if (!userSFD) {
      const hashedPassword = await bcrypt.hash('SFD2026!', 10);
      userSFD = await User.create({
        nom: 'Représentant SFD Test',
        email: 'sfd@ig.sn',
        motDePasse: hashedPassword,
        role: 'SFD',
        sfdId: sfd._id,
        actif: true,
      });
      console.log('✅ Utilisateur SFD créé : sfd@ig.sn / SFD2026!');
    } else {
      console.log('ℹ️  Utilisateur SFD déjà existant');
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 Seed terminé avec succès !');
    console.log('═══════════════════════════════════════════════');
    console.log('\n📋 Comptes créés :');
    console.log('  👑 ADMIN          : admin@ig.sn / AdminIG2026!');
    console.log('  📊 GESTIONNAIRE   : gestion@ig.sn / GestionIG2026!');
    console.log('  🏦 SFD            : sfd@ig.sn / SFD2026!');
    console.log('  🏢 ASSUREUR       : assureur@ig.sn / Assureur2026!');
    console.log('\n⚠️  Changez ces mots de passe en production !\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur seed:', error);
    process.exit(1);
  }
};

seed();