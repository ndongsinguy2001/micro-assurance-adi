// backend/scripts/clean-test-data.js
/**
 * 🧹 Script de nettoyage des données de test
 *
 * Objectif :
 *   Supprimer TOUTES les données créées pendant les tests
 *   (imports, adhésions, sinistres, reportings) pour
 *   pouvoir refaire un import propre et tester le frontend.
 *
 * ⚠️ SUPPRESSION DÉFINITIVE
 *    - importjobs
 *    - jobs (type IMPORT_REPORTING uniquement)
 *    - adhesions
 *    - sinistres
 *    - reportingmensuels
 *    - suiviintermediations
 *
 * ✅ NE SUPPRIME PAS :
 *    - users, sfds, contrats, assureurs
 *    - comptesresultats, factures, preuvespaiements, statistiques
 *
 * USAGE :
 *   cd backend
 *   node scripts/clean-test-data.js --confirm
 *
 * Le flag --confirm est OBLIGATOIRE.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// ============================================================
// VÉRIFICATION DU FLAG
// ============================================================
const args = process.argv.slice(2);
const hasConfirm = args.includes('--confirm');

if (!hasConfirm) {
  console.error('');
  console.error('❌ ERREUR : Le flag --confirm est obligatoire.');
  console.error('');
  console.error('Utilisation :');
  console.error('  node scripts/clean-test-data.js --confirm');
  console.error('');
  console.error('⚠️ Cette commande SUPPRIMERA DÉFINITIVEMENT :');
  console.error('  - Tous les ImportJobs');
  console.error('  - Tous les Jobs IMPORT_REPORTING');
  console.error('  - Toutes les Adhésions');
  console.error('  - Tous les Sinistres');
  console.error('  - Tous les ReportingMensuels');
  console.error('  - Tous les SuiviIntermediation');
  console.error('');
  console.error('✅ Elle NE supprime PAS :');
  console.error('  - users, sfds, contrats, assureurs');
  console.error('  - comptesresultats, factures, preuves, statistiques');
  console.error('');
  process.exit(1);
}

// ============================================================
// IMPORTS DES MODÈLES
// ============================================================
const ImportJob = require('../src/models/ImportJob');
const Job = require('../src/models/Job');
const Adhesion = require('../src/models/Adhesion');
const Sinistre = require('../src/models/Sinistre');
const ReportingMensuel = require('../src/models/ReportingMensuel');
const SuiviIntermediation = require('../src/models/SuiviIntermediation');

// ============================================================
// UTILITAIRES
// ============================================================
const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

const formatNumber = (n) => new Intl.NumberFormat('fr-FR').format(n);

// ============================================================
// COMPTAGE
// ============================================================
const countAll = async () => {
  const [
    importJobsCount,
    jobsCount,
    adhesionsCount,
    sinistresCount,
    reportingsCount,
    suiviCount,
  ] = await Promise.all([
    ImportJob.countDocuments({}),
    Job.countDocuments({ type: 'IMPORT_REPORTING' }),
    Adhesion.countDocuments({}),
    Sinistre.countDocuments({}),
    ReportingMensuel.countDocuments({}),
    SuiviIntermediation.countDocuments({}),
  ]);

  return {
    importJobs: importJobsCount,
    jobs: jobsCount,
    adhesions: adhesionsCount,
    sinistres: sinistresCount,
    reportings: reportingsCount,
    suiviIntermediations: suiviCount,
  };
};

// ============================================================
// PROGRAMME PRINCIPAL
// ============================================================
const cleanTestData = async () => {
  console.log('');
  console.log('='.repeat(70));
  console.log('🧹 NETTOYAGE DES DONNÉES DE TEST');
  console.log('='.repeat(70));
  console.log('');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ Connecté à MongoDB : ${mongoose.connection.host}`);
    console.log(`📁 Base de données   : ${mongoose.connection.name}`);
    console.log('');

    // --- Comptage AVANT ---
    console.log('📊 État AVANT nettoyage :');
    console.log('─'.repeat(70));
    const before = await countAll();
    console.log(`   ImportJobs            : ${formatNumber(before.importJobs)}`);
    console.log(`   Jobs (IMPORT_REPORTING): ${formatNumber(before.jobs)}`);
    console.log(`   Adhésions             : ${formatNumber(before.adhesions)}`);
    console.log(`   Sinistres             : ${formatNumber(before.sinistres)}`);
    console.log(`   ReportingMensuels     : ${formatNumber(before.reportings)}`);
    console.log(`   SuiviIntermediation   : ${formatNumber(before.suiviIntermediations)}`);
    console.log('');

    const totalToDelete =
      before.importJobs +
      before.jobs +
      before.adhesions +
      before.sinistres +
      before.reportings +
      before.suiviIntermediations;

    if (totalToDelete === 0) {
      console.log('✅ Rien à supprimer — la base est déjà propre.');
      console.log('');
      await mongoose.disconnect();
      process.exit(0);
    }

    // --- Confirmation ---
    console.log('⚠️  CONFIRMATION REQUISE');
    console.log('─'.repeat(70));
    console.log(
      `Vous êtes sur le point de SUPPRIMER ${formatNumber(
        totalToDelete
      )} documents.`
    );
    console.log('Cette action est IRRÉVERSIBLE.');
    console.log('');

    const answer = await askQuestion(
      'Tapez exactement "SUPPRIMER" pour confirmer, autre chose pour annuler : '
    );

    if (answer !== 'supprimer') {
      console.log('');
      console.log('❌ Annulé. Aucune suppression effectuée.');
      console.log('');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('');
    console.log('🚀 Suppression en cours...');
    console.log('─'.repeat(70));

    // ============================================================
    // SUPPRESSION (ordre des dépendances)
    // ============================================================
    const results = {};

    // 1. SuiviIntermediation (dépend de ReportingMensuel)
    try {
      const r = await SuiviIntermediation.deleteMany({});
      results.suiviIntermediations = r.deletedCount || 0;
      console.log(
        `   ✅ SuiviIntermediation   : ${formatNumber(
          results.suiviIntermediations
        )} supprimés`
      );
    } catch (err) {
      console.error(`   ❌ SuiviIntermediation   : ${err.message}`);
      results.suiviIntermediations = -1;
    }

    // 2. Sinistres (dépendent de Adhesion + ReportingMensuel)
    try {
      const r = await Sinistre.deleteMany({});
      results.sinistres = r.deletedCount || 0;
      console.log(`   ✅ Sinistres             : ${formatNumber(results.sinistres)} supprimés`);
    } catch (err) {
      console.error(`   ❌ Sinistres             : ${err.message}`);
      results.sinistres = -1;
    }

    // 3. Adhésions (dépendent de ReportingMensuel)
    try {
      const r = await Adhesion.deleteMany({});
      results.adhesions = r.deletedCount || 0;
      console.log(`   ✅ Adhésions             : ${formatNumber(results.adhesions)} supprimées`);
    } catch (err) {
      console.error(`   ❌ Adhésions             : ${err.message}`);
      results.adhesions = -1;
    }

    // 4. ReportingMensuels
    try {
      const r = await ReportingMensuel.deleteMany({});
      results.reportings = r.deletedCount || 0;
      console.log(
        `   ✅ ReportingMensuels     : ${formatNumber(results.reportings)} supprimés`
      );
    } catch (err) {
      console.error(`   ❌ ReportingMensuels     : ${err.message}`);
      results.reportings = -1;
    }

    // 5. ImportJobs
    try {
      const r = await ImportJob.deleteMany({});
      results.importJobs = r.deletedCount || 0;
      console.log(
        `   ✅ ImportJobs            : ${formatNumber(results.importJobs)} supprimés`
      );
    } catch (err) {
      console.error(`   ❌ ImportJobs            : ${err.message}`);
      results.importJobs = -1;
    }

    // 6. Jobs (type IMPORT_REPORTING uniquement)
    try {
      const r = await Job.deleteMany({ type: 'IMPORT_REPORTING' });
      results.jobs = r.deletedCount || 0;
      console.log(
        `   ✅ Jobs IMPORT_REPORTING : ${formatNumber(results.jobs)} supprimés`
      );
    } catch (err) {
      console.error(`   ❌ Jobs                  : ${err.message}`);
      results.jobs = -1;
    }

    // ============================================================
    // VÉRIFICATION APRÈS
    // ============================================================
    console.log('');
    console.log('📊 État APRÈS nettoyage :');
    console.log('─'.repeat(70));
    const after = await countAll();
    console.log(`   ImportJobs            : ${formatNumber(after.importJobs)}`);
    console.log(`   Jobs (IMPORT_REPORTING): ${formatNumber(after.jobs)}`);
    console.log(`   Adhésions             : ${formatNumber(after.adhesions)}`);
    console.log(`   Sinistres             : ${formatNumber(after.sinistres)}`);
    console.log(`   ReportingMensuels     : ${formatNumber(after.reportings)}`);
    console.log(`   SuiviIntermediation   : ${formatNumber(after.suiviIntermediations)}`);
    console.log('');

    const remaining =
      after.importJobs +
      after.jobs +
      after.adhesions +
      after.sinistres +
      after.reportings +
      after.suiviIntermediations;

    if (remaining === 0) {
      console.log('✅ NETTOYAGE TERMINÉ AVEC SUCCÈS.');
      console.log('   Toutes les données de test ont été supprimées.');
    } else {
      console.log(
        `⚠️  Il reste ${formatNumber(remaining)} documents. Vérifiez les collections.`
      );
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('🎯 Vous pouvez maintenant :');
    console.log('   1. Redémarrer le serveur backend');
    console.log('   2. Redémarrer le frontend');
    console.log('   3. Tester un import propre via l\'interface');
    console.log('='.repeat(70));
    console.log('');

    await mongoose.disconnect();
    console.log('🔴 Déconnecté de MongoDB');
    process.exit(remaining === 0 ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('❌ ERREUR FATALE :', error.message);
    console.error(error.stack);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

cleanTestData();