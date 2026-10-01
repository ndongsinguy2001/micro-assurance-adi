// backend/scripts/migrate-phase-5.3.js
/**
 * 🔄 Script de migration MongoDB — Phase 5.3
 *
 * Objectif :
 *   1. Sauvegarder les index actuels (backup)
 *   2. Migrer l'index de ReportingMensuel :
 *      AVANT : { sfdId, mois, annee } unique
 *      APRÈS : { sfdId, mois, annee, versionNumber } unique
 *   3. Initialiser versionNumber=1 sur tous les ReportingMensuel existants
 *   4. Initialiser lifecycle='ACTIVE' sur tous les ReportingMensuel existants
 *   5. Initialiser versionNumber=1 sur tous les ImportJob existants
 *   6. Initialiser lifecycle='ACTIVE' sur tous les ImportJob existants
 *   7. Initialiser reportingLifecycle='ACTIVE' sur toutes les Adhesion
 *
 * ⚠️ Cette migration est IDEMPOTENTE (peut être relancée sans risque).
 *
 * USAGE :
 *   cd backend
 *   node scripts/migrate-phase-5.3.js --confirm
 *
 * ROLLBACK :
 *   node scripts/migrate-phase-5.3.js --rollback --confirm
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================
// VÉRIFICATION DES FLAGS
// ============================================================
const args = process.argv.slice(2);
const hasConfirm = args.includes('--confirm');
const isRollback = args.includes('--rollback');

if (!hasConfirm) {
  console.error('');
  console.error('❌ ERREUR : Le flag --confirm est obligatoire.');
  console.error('');
  console.error('Utilisation :');
  console.error('  node scripts/migrate-phase-5.3.js --confirm');
  console.error('  node scripts/migrate-phase-5.3.js --rollback --confirm  (rollback)');
  console.error('');
  process.exit(1);
}

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

const BACKUP_DIR = path.join(__dirname, '..', 'migration-backups');

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

// ============================================================
// SAUVEGARDE DES INDEX
// ============================================================
const backupIndexes = async (db) => {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `indexes-backup-${timestamp}.json`);

  const collections = ['reportingmensuels', 'importjobs', 'adhesions'];
  const backup = {};

  for (const collName of collections) {
    try {
      const indexes = await db.collection(collName).indexes();
      backup[collName] = indexes;
    } catch (err) {
      backup[collName] = { error: err.message };
    }
  }

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`📦 Backup des index créé : ${backupPath}`);
  return backupPath;
};

// ============================================================
// MIGRATION PRINCIPALE
// ============================================================
const runMigration = async () => {
  console.log('');
  console.log('='.repeat(70));
  console.log('🔄 MIGRATION PHASE 5.3');
  console.log('='.repeat(70));
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`✅ Connecté à MongoDB : ${mongoose.connection.host}`);
  console.log(`📁 Base de données   : ${mongoose.connection.name}`);
  console.log('');

  const db = mongoose.connection.db;

  // --- Sauvegarde des index AVANT modification ---
  await backupIndexes(db);
  console.log('');

  // --- État AVANT ---
  console.log('📊 État AVANT migration :');
  console.log('─'.repeat(70));

  const reportingCount = await db.collection('reportingmensuels').countDocuments();
  const importJobCount = await db.collection('importjobs').countDocuments();
  const adhesionCount = await db.collection('adhesions').countDocuments();

  const reportingWithoutVersion = await db
    .collection('reportingmensuels')
    .countDocuments({ versionNumber: { $exists: false } });

  const reportingWithoutLifecycle = await db
    .collection('reportingmensuels')
    .countDocuments({ lifecycle: { $exists: false } });

  const importJobsWithoutVersion = await db
    .collection('importjobs')
    .countDocuments({ versionNumber: { $exists: false } });

  const importJobsWithoutLifecycle = await db
    .collection('importjobs')
    .countDocuments({ lifecycle: { $exists: false } });

  const adhesionsWithoutLifecycle = await db
    .collection('adhesions')
    .countDocuments({ reportingLifecycle: { $exists: false } });

  console.log(`   ReportingMensuels                 : ${formatNumber(reportingCount)}`);
  console.log(`     └─ sans versionNumber           : ${formatNumber(reportingWithoutVersion)}`);
  console.log(`     └─ sans lifecycle               : ${formatNumber(reportingWithoutLifecycle)}`);
  console.log(`   ImportJobs                        : ${formatNumber(importJobCount)}`);
  console.log(`     └─ sans versionNumber           : ${formatNumber(importJobsWithoutVersion)}`);
  console.log(`     └─ sans lifecycle               : ${formatNumber(importJobsWithoutLifecycle)}`);
  console.log(`   Adhésions                         : ${formatNumber(adhesionCount)}`);
  console.log(`     └─ sans reportingLifecycle      : ${formatNumber(adhesionsWithoutLifecycle)}`);
  console.log('');

  // --- Confirmation ---
  console.log('⚠️  CONFIRMATION REQUISE');
  console.log('─'.repeat(70));
  console.log('Cette migration va :');
  console.log('  1. Modifier l\'index unique de ReportingMensuel');
  console.log('  2. Initialiser versionNumber=1 et lifecycle="ACTIVE"');
  console.log('  3. Initialiser les champs Phase 5.3 sur ImportJob');
  console.log('  4. Initialiser reportingLifecycle="ACTIVE" sur Adhesion');
  console.log('');
  console.log('Backup des index déjà effectué. Aucune donnée ne sera supprimée.');
  console.log('');

  const answer = await askQuestion(
    'Tapez exactement "MIGRER" pour confirmer, autre chose pour annuler : '
  );

  if (answer !== 'migrer') {
    console.log('');
    console.log('❌ Annulé.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('');
  console.log('🚀 Migration en cours...');
  console.log('─'.repeat(70));

  // ============================================================
  // ÉTAPE 1 — Drop index unique actuel
  // ============================================================
  try {
    const indexName = 'sfdId_1_mois_1_annee_1';
    await db.collection('reportingmensuels').dropIndex(indexName);
    console.log(`   ✅ Index "${indexName}" supprimé`);
  } catch (err) {
    if (err.code === 27 || err.codeName === 'IndexNotFound') {
      console.log(`   ℹ️  Index "sfdId_1_mois_1_annee_1" déjà absent`);
    } else {
      console.error(`   ⚠️  Erreur dropIndex : ${err.message}`);
    }
  }

  // ============================================================
  // ÉTAPE 2 — Initialiser versionNumber + lifecycle sur ReportingMensuel
  // ============================================================
  const reportingUpdate = await db.collection('reportingmensuels').updateMany(
    {
      $or: [
        { versionNumber: { $exists: false } },
        { lifecycle: { $exists: false } },
      ],
    },
    {
      $set: {
        versionNumber: 1,
        lifecycle: 'ACTIVE',
      },
    }
  );
  console.log(
    `   ✅ ReportingMensuels mis à jour : ${formatNumber(reportingUpdate.modifiedCount)}`
  );

  // ============================================================
  // ÉTAPE 3 — Créer le nouvel index unique
  // ============================================================
  try {
    await db.collection('reportingmensuels').createIndex(
      { sfdId: 1, mois: 1, annee: 1, versionNumber: 1 },
      { unique: true, name: 'unique_reporting_by_period_version' }
    );
    console.log(`   ✅ Nouvel index unique créé`);
  } catch (err) {
    console.error(`   ❌ Erreur createIndex : ${err.message}`);
    throw err;
  }

  // ============================================================
  // ÉTAPE 4 — Initialiser versionNumber + lifecycle sur ImportJob
  // ============================================================
  const importJobUpdate = await db.collection('importjobs').updateMany(
    {
      $or: [
        { versionNumber: { $exists: false } },
        { lifecycle: { $exists: false } },
      ],
    },
    {
      $set: {
        versionNumber: 1,
        lifecycle: 'ACTIVE',
      },
    }
  );
  console.log(
    `   ✅ ImportJobs mis à jour : ${formatNumber(importJobUpdate.modifiedCount)}`
  );

  // ============================================================
  // ÉTAPE 5 — Initialiser reportingLifecycle sur Adhesion
  // ============================================================
  const adhesionUpdate = await db.collection('adhesions').updateMany(
    { reportingLifecycle: { $exists: false } },
    { $set: { reportingLifecycle: 'ACTIVE' } }
  );
  console.log(
    `   ✅ Adhésions mises à jour : ${formatNumber(adhesionUpdate.modifiedCount)}`
  );

  // ============================================================
  // ÉTAPE 6 — Créer les index Phase 5.3 sur ImportJob
  // ============================================================
  try {
    await db.collection('importjobs').createIndex(
      { supersedes: 1 },
      { sparse: true, name: 'supersedes_idx' }
    );
    await db.collection('importjobs').createIndex(
      { supersededBy: 1 },
      { sparse: true, name: 'supersededBy_idx' }
    );
    await db.collection('importjobs').createIndex(
      { institutionId: 1, 'detectedPeriod.month': 1, 'detectedPeriod.year': 1, versionNumber: -1 },
      { name: 'version_by_period' }
    );
    await db.collection('importjobs').createIndex(
      { institutionId: 1, lifecycle: 1, createdAt: -1 },
      { name: 'lifecycle_by_institution' }
    );
    console.log(`   ✅ Index ImportJob créés (4)`);
  } catch (err) {
    console.error(`   ⚠️  Erreur createIndex ImportJob : ${err.message}`);
  }

  // ============================================================
  // ÉTAPE 7 — Créer l'index Phase 5.3 sur Adhesion
  // ============================================================
  try {
    await db.collection('adhesions').createIndex(
      { reportingLifecycle: 1 },
      { name: 'reportingLifecycle_idx' }
    );
    console.log(`   ✅ Index Adhesion créé (1)`);
  } catch (err) {
    console.error(`   ⚠️  Erreur createIndex Adhesion : ${err.message}`);
  }

  // ============================================================
  // VÉRIFICATION FINALE
  // ============================================================
  console.log('');
  console.log('📊 État APRÈS migration :');
  console.log('─'.repeat(70));

  const stillWithoutVersion = await db
    .collection('reportingmensuels')
    .countDocuments({ versionNumber: { $exists: false } });

  const stillWithoutLifecycle = await db
    .collection('reportingmensuels')
    .countDocuments({ lifecycle: { $exists: false } });

  const adhesionsStillWithoutLifecycle = await db
    .collection('adhesions')
    .countDocuments({ reportingLifecycle: { $exists: false } });

  console.log(`   ReportingMensuels sans versionNumber   : ${formatNumber(stillWithoutVersion)}`);
  console.log(`   ReportingMensuels sans lifecycle       : ${formatNumber(stillWithoutLifecycle)}`);
  console.log(`   Adhésions sans reportingLifecycle      : ${formatNumber(adhesionsStillWithoutLifecycle)}`);
  console.log('');

  if (
    stillWithoutVersion === 0 &&
    stillWithoutLifecycle === 0 &&
    adhesionsStillWithoutLifecycle === 0
  ) {
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
  } else {
    console.log('⚠️  Il reste des documents non migrés. Vérifiez.');
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('💡 Rollback possible via :');
  console.log('   node scripts/migrate-phase-5.3.js --rollback --confirm');
  console.log('='.repeat(70));
  console.log('');

  await mongoose.disconnect();
  console.log('🔴 Déconnecté de MongoDB');
  process.exit(0);
};

// ============================================================
// ROLLBACK
// ============================================================
const runRollback = async () => {
  console.log('');
  console.log('='.repeat(70));
  console.log('🔄 ROLLBACK PHASE 5.3');
  console.log('='.repeat(70));
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`✅ Connecté à MongoDB : ${mongoose.connection.host}`);

  const db = mongoose.connection.db;

  console.log('');
  console.log('⚠️  ATTENTION :');
  console.log('   Ce rollback va restaurer l\'index UNIQUE original');
  console.log('   { sfdId, mois, annee } sur ReportingMensuel.');
  console.log('');
  console.log('   ⚠️  Si plusieurs versions existent pour une même période,');
  console.log('      la création de l\'index échouera (contrainte unique).');
  console.log('');

  const answer = await askQuestion('Tapez "ROLLBACK" pour confirmer : ');
  if (answer !== 'rollback') {
    console.log('❌ Annulé.');
    await mongoose.disconnect();
    process.exit(0);
  }

  try {
    await db.collection('reportingmensuels').dropIndex('unique_reporting_by_period_version');
    console.log('   ✅ Index 5.3 supprimé');

    await db.collection('reportingmensuels').createIndex(
      { sfdId: 1, mois: 1, annee: 1 },
      { unique: true, name: 'sfdId_1_mois_1_annee_1' }
    );
    console.log('   ✅ Index original restauré');
  } catch (err) {
    console.error(`   ❌ Erreur rollback : ${err.message}`);
  }

  await mongoose.disconnect();
  console.log('🔴 Déconnecté');
  process.exit(0);
};

// ============================================================
// LANCEMENT
// ============================================================
if (isRollback) {
  runRollback().catch((err) => {
    console.error('❌ Erreur fatale :', err.message);
    process.exit(1);
  });
} else {
  runMigration().catch(async (err) => {
    console.error('❌ Erreur fatale :', err.message);
    console.error(err.stack);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
}