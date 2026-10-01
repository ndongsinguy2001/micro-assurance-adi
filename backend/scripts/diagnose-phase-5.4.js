// backend/scripts/diagnose-phase-5.4.js
/**
 * 🔬 Script de diagnostic — Écart sourceRows vs somme des statuts
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ImportJob = require('../src/models/ImportJob');

const diagnose = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const lastJob = await ImportJob.findOne({ status: 'COMPLETED' })
    .sort({ createdAt: -1 })
    .lean();

  console.log('');
  console.log('='.repeat(70));
  console.log('🔬 DIAGNOSTIC PHASE 5.4');
  console.log('='.repeat(70));
  console.log('');

  console.log('📁 ImportJob :', lastJob._id);
  console.log('📄 Fichier   :', lastJob.fileName);
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

  const sumStatuses = c.validRows + c.excludedRows + c.ignoredRows + c.errorRows;
  const ecart = c.sourceRows - sumStatuses;

  console.log('🧮 Vérification :');
  console.log('   Sum des statuts :', sumStatuses);
  console.log('   Écart           :', ecart);
  console.log('');

  console.log('📋 ignoredLines (échantillon) :');
  console.log('   Total :', lastJob.ignoredLines.length);
  console.log('   Raisons :');

  const raisons = {};
  for (const l of lastJob.ignoredLines) {
    raisons[l.reason] = (raisons[l.reason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(raisons)) {
    console.log(`     - ${reason} : ${count}`);
  }
  console.log('');

  console.log('📐 sourceRowsRange :');
  console.log('   ', JSON.stringify(lastJob.sourceRowsRange, null, 2));
  console.log('');

  console.log('⚠️ Anomalies :');
  console.log('   Total :', lastJob.anomalies.length);
  for (const a of lastJob.anomalies) {
    console.log(`     - [${a.severity}] ${a.code}: ${a.message}`);
  }
  console.log('');

  console.log('🔍 Interprétation :');
  console.log(`   Lignes dans sourceRows (${c.sourceRows}) `);
  console.log(`   = valid (${c.validRows}) + excl (${c.excludedRows}) + ignored (${c.ignoredRows}) + error (${c.errorRows}) = ${sumStatuses}`);
  console.log(`   Écart = ${ecart}`);

  if (ecart !== 0) {
    console.log('');
    console.log('   ❌ INCOHÉRENCE DÉTECTÉE');
    console.log(`   → ${Math.abs(ecart)} ligne(s) ${ecart > 0 ? 'non classée(s)' : 'classée(s) en trop'}`);
  } else {
    console.log('   ✅ Cohérence parfaite');
  }

  await mongoose.disconnect();
  process.exit(0);
};

diagnose().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});