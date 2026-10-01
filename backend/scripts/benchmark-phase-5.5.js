// backend/scripts/benchmark-phase-5.5.js
/**
 * ⚡ Benchmark Phase 5.5 — Comparaison avant/après projection
 *
 * Objectif : mesurer le gain de performance sur le listing d'adhésions.
 *
 * ⚠️ Ce script utilise directement MongoDB (pas l'API HTTP).
 *    Pour mesurer les vraies latences HTTP, utiliser Postman/curl.
 *
 * USAGE :
 *   cd backend
 *   node scripts/benchmark-phase-5.5.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Adhesion = require('../src/models/Adhesion');
const ReportingMensuel = require('../src/models/ReportingMensuel');
const {
  ADHESION_LIGHT_PROJECTION,
} = require('../src/constants/projections');

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const formatMs = (ms) => `${ms.toFixed(0)} ms`;
const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} Ko`;

const benchmark = async () => {
  console.log('');
  console.log('='.repeat(70));
  console.log(`${c.bold}⚡ BENCHMARK PHASE 5.5 — Optimisation des listings${c.reset}`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`\n✅ Connecté à MongoDB : ${c.gray}${mongoose.connection.host}${c.reset}`);
    console.log(`✅ Base : ${c.gray}${mongoose.connection.name}${c.reset}`);

    // ============================================================
    // Trouver le dernier reporting
    // ============================================================
    const lastReporting = await ReportingMensuel.findOne({ lifecycle: 'ACTIVE' })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastReporting) {
      console.log(`\n${c.yellow}⚠️  Aucun reporting trouvé. Importez un fichier d'abord.${c.reset}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`\n📁 Reporting : ${c.gray}${lastReporting._id}${c.reset}`);
    console.log(`📅 Période   : ${c.gray}${lastReporting.mois}/${lastReporting.annee}${c.reset}`);
    console.log(`📊 Adhésions : ${c.gray}${lastReporting.nombreAdhesions}${c.reset}`);

    // ============================================================
    // Benchmark : Listing SANS projection (tous les champs)
    // ============================================================
    console.log('');
    console.log('='.repeat(70));
    console.log(`${c.bold}🔴 AVANT (tous les champs)${c.reset}`);
    console.log('='.repeat(70));

    const runsBefore = [];
    let totalBytesBefore = 0;

    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const docs = await Adhesion.find({ reportingMensuelId: lastReporting._id })
        .sort({ nomEmprunteur: 1 })
        .limit(500)
        .lean();
      const duration = Date.now() - start;
      const bytes = JSON.stringify(docs).length;
      runsBefore.push({ duration, bytes, count: docs.length });
      totalBytesBefore = bytes;
    }

    const avgBefore = runsBefore.reduce((sum, r) => sum + r.duration, 0) / runsBefore.length;
    console.log(`   Durée moyenne : ${c.yellow}${formatMs(avgBefore)}${c.reset}`);
    console.log(`   Taille moyenne: ${c.yellow}${formatKb(totalBytesBefore)}${c.reset}`);
    console.log(`   Documents     : ${c.gray}${runsBefore[0].count}${c.reset}`);
    console.log('   Détails       :');
    runsBefore.forEach((r, i) => {
      console.log(`     Run ${i + 1}: ${formatMs(r.duration)} — ${formatKb(r.bytes)}`);
    });

    // ============================================================
    // Benchmark : Listing AVEC projection (champs légers)
    // ============================================================
    console.log('');
    console.log('='.repeat(70));
    console.log(`${c.bold}🟢 APRÈS (projection légère — Phase 5.5)${c.reset}`);
    console.log('='.repeat(70));

    const runsAfter = [];
    let totalBytesAfter = 0;

    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const docs = await Adhesion.find(
        { reportingMensuelId: lastReporting._id },
        ADHESION_LIGHT_PROJECTION
      )
        .sort({ nomEmprunteur: 1 })
        .limit(500)
        .lean();
      const duration = Date.now() - start;
      const bytes = JSON.stringify(docs).length;
      runsAfter.push({ duration, bytes, count: docs.length });
      totalBytesAfter = bytes;
    }

    const avgAfter = runsAfter.reduce((sum, r) => sum + r.duration, 0) / runsAfter.length;
    console.log(`   Durée moyenne : ${c.green}${formatMs(avgAfter)}${c.reset}`);
    console.log(`   Taille moyenne: ${c.green}${formatKb(totalBytesAfter)}${c.reset}`);
    console.log(`   Documents     : ${c.gray}${runsAfter[0].count}${c.reset}`);
    console.log('   Détails       :');
    runsAfter.forEach((r, i) => {
      console.log(`     Run ${i + 1}: ${formatMs(r.duration)} — ${formatKb(r.bytes)}`);
    });

    // ============================================================
    // Comparaison
    // ============================================================
    console.log('');
    console.log('='.repeat(70));
    console.log(`${c.bold}📊 COMPARAISON${c.reset}`);
    console.log('='.repeat(70));

    const gainTime = ((avgBefore - avgAfter) / avgBefore * 100).toFixed(1);
    const gainBytes = ((totalBytesBefore - totalBytesAfter) / totalBytesBefore * 100).toFixed(1);
    const speedup = (avgBefore / avgAfter).toFixed(2);

    console.log(`   Temps        : ${formatMs(avgBefore)} → ${formatMs(avgAfter)}  (${c.green}${gainTime}%${c.reset} plus rapide)`);
    console.log(`   Taille       : ${formatKb(totalBytesBefore)} → ${formatKb(totalBytesAfter)}  (${c.green}${gainBytes}%${c.reset} plus léger)`);
    console.log(`   Speedup      : ${c.bold}${c.green}×${speedup}${c.reset}`);

    if (avgAfter < 500) {
      console.log('');
      console.log(`${c.bold}${c.green}✅ Objectif atteint : < 500 ms${c.reset}`);
    } else if (avgAfter < 1000) {
      console.log('');
      console.log(`${c.bold}${c.yellow}⚠️  Proche de l'objectif (< 500 ms) : ${formatMs(avgAfter)}${c.reset}`);
    } else {
      console.log('');
      console.log(`${c.bold}${c.red}❌ Objectif non atteint (< 500 ms) : ${formatMs(avgAfter)}${c.reset}`);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n${c.red}❌ ERREUR : ${error.message}${c.reset}`);
    console.error(error.stack);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

benchmark();