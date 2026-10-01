// backend/scripts/cleanImportData.js
/**
 * 🧹 Script de nettoyage des données d'import de test
 *
 * OBJECTIF :
 *   Supprimer TOUTES les données liées aux imports de reporting
 *   pour repartir sur une base propre avant un test réel.
 *
 * ⚠️ ATTENTION :
 *   - Ce script supprime DÉFINITIVEMENT les données des collections :
 *       - importjobs
 *       - jobs (type IMPORT_REPORTING)
 *       - adhesions
 *       - sinistres
 *       - reportingmensuels
 *       - suiviintermediations
 *
 *   - Ce script NE supprime PAS :
 *       - users, sfds, contrats, assureurs
 *       - comptesresultats, factures, preuvespaiements
 *       - statistiques
 *
 * USAGE :
 *   cd backend
 *   node scripts/cleanImportData.js --confirm
 *
 * Le flag --confirm est OBLIGATOIRE pour éviter les suppressions
 * accidentelles.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// ============================================================
// 1. VÉRIFICATION DU FLAG --confirm
// ============================================================
const args = process.argv.slice(2);
const hasConfirmFlag = args.includes('--confirm');

if (!hasConfirmFlag) {
  console.error('');
  console.error('❌ ERREUR : Le flag --confirm est obligatoire.');
  console.error('');
  console.error('Utilisation :');
  console.error('  node scripts/cleanImportData.js --confirm');
  console.error('');
  console.error('⚠️ Cette commande SUPPRIMERA DÉFINITIVEMENT :');
  console.error('  - Tous les ImportJobs');
  console.error('  - Tous les Jobs de type IMPORT_REPORTING');
  console.error('  - Toutes les Adhésions');
  console.error('  - Tous les Sinistres');
  console.error('  - Tous les ReportingMensuels');
  console.error('  - Tous les SuiviIntermediation');
  console.error('');
  process.exit(1);
}

// ============================================================
// 2. IMPORTS DES MODÈLES
// ============================================================
const ImportJob = require('../src/models/ImportJob');
const Job = require('../src/models/Job');
const Adhesion = require('../src/models/Adhesion');
const Sinistre = require('../src/models/Sinistre');
const ReportingMensuel = require('../src/models/ReportingMensuel');
const SuiviIntermediation = require('../src/models/SuiviIntermediation');

// ============================================================
// 3. UTILITAIRES
// ============================================================

/**
 * Pose une question à l'utilisateur et attend sa réponse.
 */
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

/**
 * Formate un nombre avec séparateurs de milliers.
 */
const formatNumber = (n) => new Intl.NumberFormat('fr-FR').format(n);

/**
 * Affiche un compte avant suppression.
 */
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
// 4. FONCTION PRINCIPALE
// ============================================================
const cleanImportData = async () => {
  console.log('');
  console.log('='.repeat(70));
  console.log('🧹 NETTOYAGE DES DONNÉES D\'IMPORT DE TEST');
  console.log('='.repeat(70));
  console.log('');

  // --- Connexion MongoDB ---
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ Connecté à MongoDB : ${mongoose.connection.host}`);
    console.log(`📁 Base de données   : ${mongoose.connection.name}`);
    console.log('');
  } catch (err) {
    console.error('❌ Erreur de connexion MongoDB :', err.message);
    process.exit(1);
  }

  // --- Comptage AVANT ---
  console.log('📊 État AVANT nettoyage :');
  console.log('─'.repeat(70));
  const before = await countAll();
  console.log(`   ImportJobs           : ${formatNumber(before.importJobs)}`);
  console.log(`   Jobs (IMPORT_REPORTING): ${formatNumber(before.jobs)}`);
  console.log(`   Adhésions            : ${formatNumber(before.adhesions)}`);
  console.log(`   Sinistres            : ${formatNumber(before.sinistres)}`);
  console.log(`   ReportingMensuels    : ${formatNumber(before.reportings)}`);
  console.log(`   SuiviIntermediation  : ${formatNumber(before.suiviIntermediations)}`);
  console.log('');

  // --- Vérification : y a-t-il quelque chose à supprimer ? ---
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

  // --- Demande de confirmation explicite ---
  console.log('⚠️  CONFIRMATION REQUISE');
  console.log('─'.repeat(70));
  console.log(
    `Vous êtes sur le point de SUPPRIMER ${formatNumber(
      totalToDelete
    )} documents au total.`
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
  // 5. SUPPRESSION DANS L'ORDRE (dépendances d'abord)
  // ============================================================

  // --- Ordre important : partir des feuilles vers les racines ---
  // SuiviIntermediation → dépend de ReportingMensuel
  // Sinistre            → dépend de Adhesion + ReportingMensuel
  // Adhesion            → dépend de ReportingMensuel
  // ReportingMensuel    → dépend de SFD + Contrat
  // ImportJob           → référence ReportingMensuel
  // Job                 → indépendant (mais on filtre sur type)

  const results = {};

  // 5.1 — SuiviIntermediation
  try {
    const r = await SuiviIntermediation.deleteMany({});
    results.suiviIntermediations = r.deletedCount || 0;
    console.log(
      `   ✅ SuiviIntermediation  : ${formatNumber(results.suiviIntermediations)} supprimés`
    );
  } catch (err) {
    console.error(`   ❌ SuiviIntermediation  : ${err.message}`);
    results.suiviIntermediations = -1;
  }

  // 5.2 — Sinistres
  try {
    const r = await Sinistre.deleteMany({});
    results.sinistres = r.deletedCount || 0;
    console.log(`   ✅ Sinistres            : ${formatNumber(results.sinistres)} supprimés`);
  } catch (err) {
    console.error(`   ❌ Sinistres            : ${err.message}`);
    results.sinistres = -1;
  }

  // 5.3 — Adhésions
  try {
    const r = await Adhesion.deleteMany({});
    results.adhesions = r.deletedCount || 0;
    console.log(`   ✅ Adhésions            : ${formatNumber(results.adhesions)} supprimées`);
  } catch (err) {
    console.error(`   ❌ Adhésions            : ${err.message}`);
    results.adhesions = -1;
  }

  // 5.4 — ReportingMensuels
  try {
    const r = await ReportingMensuel.deleteMany({});
    results.reportings = r.deletedCount || 0;
    console.log(
      `   ✅ ReportingMensuels    : ${formatNumber(results.reportings)} supprimés`
    );
  } catch (err) {
    console.error(`   ❌ ReportingMensuels    : ${err.message}`);
    results.reportings = -1;
  }

  // 5.5 — ImportJobs
  try {
    const r = await ImportJob.deleteMany({});
    results.importJobs = r.deletedCount || 0;
    console.log(`   ✅ ImportJobs           : ${formatNumber(results.importJobs)} supprimés`);
  } catch (err) {
    console.error(`   ❌ ImportJobs           : ${err.message}`);
    results.importJobs = -1;
  }

  // 5.6 — Jobs de type IMPORT_REPORTING
  try {
    const r = await Job.deleteMany({ type: 'IMPORT_REPORTING' });
    results.jobs = r.deletedCount || 0;
    console.log(
      `   ✅ Jobs IMPORT_REPORTING: ${formatNumber(results.jobs)} supprimés`
    );
  } catch (err) {
    console.error(`   ❌ Jobs                 : ${err.message}`);
    results.jobs = -1;
  }

  // ============================================================
  // 6. VÉRIFICATION APRÈS
  // ============================================================
  console.log('');
  console.log('📊 État APRÈS nettoyage :');
  console.log('─'.repeat(70));
  const after = await countAll();
  console.log(`   ImportJobs           : ${formatNumber(after.importJobs)}`);
  console.log(`   Jobs (IMPORT_REPORTING): ${formatNumber(after.jobs)}`);
  console.log(`   Adhésions            : ${formatNumber(after.adhesions)}`);
  console.log(`   Sinistres            : ${formatNumber(after.sinistres)}`);
  console.log(`   ReportingMensuels    : ${formatNumber(after.reportings)}`);
  console.log(`   SuiviIntermediation  : ${formatNumber(after.suiviIntermediations)}`);
  console.log('');

  // ============================================================
  // 7. VÉRIFICATION FINALE
  // ============================================================
  const remaining =
    after.importJobs +
    after.jobs +
    after.adhesions +
    after.sinistres +
    after.reportings +
    after.suiviIntermediations;

  if (remaining === 0) {
    console.log('✅ NETTOYAGE TERMINÉ AVEC SUCCÈS.');
    console.log('   Toutes les données d\'import ont été supprimées.');
  } else {
    console.log(
      `⚠️  Il reste ${formatNumber(remaining)} documents. Vérifiez les collections.`
    );
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('🎯 Vous pouvez maintenant lancer un test d\'import réel.');
  console.log('='.repeat(70));
  console.log('');

  // --- Déconnexion ---
  await mongoose.disconnect();
  console.log('🔴 Déconnecté de MongoDB');
  process.exit(remaining === 0 ? 0 : 1);
};

// ============================================================
// 8. LANCEMENT AVEC GESTION D'ERREURS
// ============================================================
cleanImportData().catch(async (err) => {
  console.error('');
  console.error('❌ ERREUR FATALE :', err.message);
  console.error(err.stack);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});