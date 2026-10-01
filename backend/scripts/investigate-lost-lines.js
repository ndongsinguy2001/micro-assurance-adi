// backend/scripts/investigate-lost-lines.js
/**
 * 🔬 Script d'investigation — Lignes perdues entre processedRows et valid+excl+err
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ImportJob = require('../src/models/ImportJob');
const Adhesion = require('../src/models/Adhesion');

const investigate = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const lastJob = await ImportJob.findOne({ status: 'COMPLETED' })
    .sort({ createdAt: -1 })
    .lean();

  console.log('');
  console.log('='.repeat(70));
  console.log('🔬 INVESTIGATION — Lignes perdues');
  console.log('='.repeat(70));
  console.log('');

  const c = lastJob.counters;

  console.log('📊 Compteurs :');
  console.log('   sourceRows    :', c.sourceRows);
  console.log('   processedRows :', c.processedRows);
  console.log('   validRows     :', c.validRows);
  console.log('   excludedRows  :', c.excludedRows);
  console.log('   ignoredRows   :', c.ignoredRows);
  console.log('   errorRows     :', c.errorRows);
  console.log('');

  // Combien d'adhésions sont réellement en base pour cet import ?
  const actualAdhesionCount = await Adhesion.countDocuments({
    importJobId: lastJob._id,
  });

  console.log('🗄️  Adhésions RÉELLES en base :', actualAdhesionCount);
  console.log('   counters.validRows + excludedRows :', c.validRows + c.excludedRows);
  console.log('');

  if (actualAdhesionCount !== c.validRows + c.excludedRows) {
    console.log('   ❌ ÉCART :', actualAdhesionCount - (c.validRows + c.excludedRows));
    console.log('   → Des documents ont échoué à l\'insertion');
  } else {
    console.log('   ✅ Correspondance parfaite');
  }
  console.log('');

  // Combien par status ?
  const validCount = await Adhesion.countDocuments({
    importJobId: lastJob._id,
    status: 'VALID',
  });
  const excludedCount = await Adhesion.countDocuments({
    importJobId: lastJob._id,
    status: 'EXCLUDED',
  });

  console.log('📊 Par status (requête MongoDB) :');
  console.log('   VALID     :', validCount);
  console.log('   EXCLUDED  :', excludedCount);
  console.log('   counters.validRows    :', c.validRows);
  console.log('   counters.excludedRows :', c.excludedRows);
  console.log('');

  console.log('📋 ignoredLines par raison :');
  const raisons = {};
  for (const l of lastJob.ignoredLines) {
    raisons[l.reason] = (raisons[l.reason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(raisons)) {
    console.log(`     - ${reason} : ${count}`);
  }
  console.log('   Total ignoredLines :', lastJob.ignoredLines.length);
  console.log('   counters.ignoredRows :', c.ignoredRows);
  console.log('');

  console.log('📐 sourceRowsRange :');
  console.log(JSON.stringify(lastJob.sourceRowsRange, null, 2));
  console.log('');

  console.log('⚠️  Anomalies :');
  for (const a of lastJob.anomalies) {
    console.log(`     - [${a.severity}] ${a.code}: ${a.message}`);
  }
  console.log('');

  // ANALYSE FINALE
  console.log('='.repeat(70));
  console.log('🔍 INTERPRÉTATION');
  console.log('='.repeat(70));
  console.log('');

  const processed = c.processedRows;
  const classified = c.validRows + c.excludedRows + c.errorRows;
  const delta = processed - classified;

  console.log(`processedRows (${processed}) vs valid+excl+err (${classified})`);
  console.log(`→ Delta = ${delta}`);
  console.log('');

  if (delta > 0) {
    console.log(`❌ ${delta} ligne(s) ont atteint le traitement métier MAIS`);
    console.log(`   n'ont pas été classées (ni VALID, ni EXCLUDED, ni ERROR).`);
    console.log('');
    console.log('   Hypothèses :');
    console.log('   H1. Documents échoués silencieusement dans insertMany');
    console.log('   H2. Exception entre processedRows++ et batch.push()');
    console.log('   H3. Bug dans la logique d\'incrémentation');
    console.log('');
    console.log(`   Vérification H1 : Adhésions en base = ${actualAdhesionCount}`);
    console.log(`                      attendu = ${c.validRows + c.excludedRows}`);
    if (actualAdhesionCount === c.validRows + c.excludedRows) {
      console.log(`   → H1 REJETÉE : le nombre en base correspond aux compteurs.`);
      console.log(`     Le problème est dans l'incrément des compteurs.`);
    } else if (actualAdhesionCount < c.validRows + c.excludedRows) {
      console.log(`   → H1 CONFIRMÉE : ${(c.validRows + c.excludedRows) - actualAdhesionCount} document(s) manquant(s) en base.`);
    } else {
      console.log(`   → Anomalie inattendue : plus de documents en base qu'attendu.`);
    }
  } else {
    console.log('✅ Cohérence parfaite');
  }

  await mongoose.disconnect();
  process.exit(0);
};

investigate().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});