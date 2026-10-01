// backend/scripts/verify-phase-5.4.js
/**
 * 🔍 Script de vérification Phase 5.4 (v2 — Phase 5.4.2)
 *
 * ⚠️ READ-ONLY : aucune écriture MongoDB.
 *
 * USAGE :
 *   cd backend
 *   node scripts/verify-phase-5.4.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ImportJob = require('../src/models/ImportJob');
const Adhesion = require('../src/models/Adhesion');

// ============================================================
// COULEURS TERMINAL
// ============================================================
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const OK = `${c.green}✅${c.reset}`;
const FAIL = `${c.red}❌${c.reset}`;
const WARN = `${c.yellow}⚠️${c.reset}`;
const INFO = `${c.cyan}ℹ️${c.reset}`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warningTests = 0;

const assert = (condition, label, details = null) => {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`   ${OK} ${label}`);
  } else {
    failedTests++;
    console.log(`   ${FAIL} ${label}`);
    if (details) console.log(`      ${c.gray}${details}${c.reset}`);
  }
  return condition;
};

const warn = (condition, label, details = null) => {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`   ${OK} ${label}`);
  } else {
    warningTests++;
    console.log(`   ${WARN} ${label}`);
    if (details) console.log(`      ${c.gray}${details}${c.reset}`);
  }
  return condition;
};

const section = (title) => {
  console.log('');
  console.log(`${c.bold}${c.cyan}━━━ ${title} ━━━${c.reset}`);
};

// ============================================================
// PROGRAMME PRINCIPAL
// ============================================================
const verifyPhase54 = async () => {
  console.log('');
  console.log('='.repeat(70));
  console.log(`${c.bold}🔍 VÉRIFICATION PHASE 5.4.2 — Moteur de règles${c.reset}`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`\n${OK} Connecté à MongoDB : ${c.gray}${mongoose.connection.host}${c.reset}`);
    console.log(`${OK} Base de données   : ${c.gray}${mongoose.connection.name}${c.reset}`);

    // ============================================================
    // ÉTAPE 1 — Récupérer le dernier ImportJob réussi
    // ============================================================
    section('1. Dernier import réussi');

    const lastJob = await ImportJob.findOne({ status: 'COMPLETED' })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastJob) {
      console.log(`   ${FAIL} Aucun ImportJob COMPLETED trouvé`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`   ${OK} ImportJob trouvé : ${c.gray}${lastJob._id}${c.reset}`);
    console.log(`   ${INFO} Fichier    : ${c.gray}${lastJob.fileName}${c.reset}`);
    console.log(`   ${INFO} Période    : ${c.gray}${lastJob.detectedPeriod?.month}/${lastJob.detectedPeriod?.year}${c.reset}`);
    console.log(`   ${INFO} Statut     : ${c.gray}${lastJob.status}${c.reset}`);
    console.log(`   ${INFO} Durée      : ${c.gray}${(lastJob.durationMs / 1000).toFixed(2)} s${c.reset}`);

    // ============================================================
    // ÉTAPE 2 — Vérifier les compteurs de l'ImportJob
    // ============================================================
    section('2. Compteurs ImportJob (Phase 5.4.2)');

    const counters = lastJob.counters || {};
    const sumOfStatuses =
      (counters.validRows || 0) +
      (counters.excludedRows || 0) +
      (counters.ignoredRows || 0) +
      (counters.errorRows || 0) +
      (counters.duplicateRows || 0) +
      (counters.invalidRows || 0);

    console.log(`   ${INFO} sourceRows    : ${c.gray}${counters.sourceRows}${c.reset}`);
    console.log(`   ${INFO} processedRows : ${c.gray}${counters.processedRows}${c.reset}`);
    console.log(`   ${INFO} validRows     : ${c.gray}${counters.validRows}${c.reset}`);
    console.log(`   ${INFO} excludedRows  : ${c.gray}${counters.excludedRows}${c.reset}`);
    console.log(`   ${INFO} ignoredRows   : ${c.gray}${counters.ignoredRows}${c.reset}`);
    console.log(`   ${INFO} errorRows     : ${c.gray}${counters.errorRows}${c.reset}`);

    assert(
      counters.sourceRows === sumOfStatuses,
      `Cohérence : sourceRows = sum of statuses`,
      `sourceRows=${counters.sourceRows}, sum=${sumOfStatuses}, delta=${counters.sourceRows - sumOfStatuses}`
    );

    const expectedProcessed =
      (counters.validRows || 0) + (counters.excludedRows || 0) + (counters.errorRows || 0);

    assert(
      counters.processedRows === expectedProcessed,
      `Cohérence : processedRows = validRows + excludedRows + errorRows`,
      `processedRows=${counters.processedRows}, expected=${expectedProcessed}, delta=${counters.processedRows - expectedProcessed}`
    );

    // ============================================================
    // ÉTAPE 3 — Vérifier les adhésions en base
    // ============================================================
    section('3. Adhésions en base');

    const actualValidCount = await Adhesion.countDocuments({
      importJobId: lastJob._id,
      status: 'VALID',
    });
    const actualExcludedCount = await Adhesion.countDocuments({
      importJobId: lastJob._id,
      status: 'EXCLUDED',
    });

    console.log(`   ${INFO} VALID en base    : ${c.gray}${actualValidCount}${c.reset}`);
    console.log(`   ${INFO} EXCLUDED en base : ${c.gray}${actualExcludedCount}${c.reset}`);

    assert(
      actualValidCount === counters.validRows,
      `VALID en base = counters.validRows`,
      `base=${actualValidCount}, counters=${counters.validRows}`
    );

    assert(
      actualExcludedCount === counters.excludedRows,
      `EXCLUDED en base = counters.excludedRows`,
      `base=${actualExcludedCount}, counters=${counters.excludedRows}`
    );

    // ============================================================
    // ÉTAPE 4 — Échantillon VALID
    // ============================================================
    section('4. Structure des adhésions VALID');

    const validSample = await Adhesion.find({
      importJobId: lastJob._id,
      status: 'VALID',
    })
      .limit(10)
      .lean();

    if (validSample.length === 0) {
      console.log(`   ${WARN} Aucune adhésion VALID`);
    } else {
      let checksPassed = 0;
      let checksTotal = 0;

      for (const adh of validSample) {
        checksTotal += 5;
        if (Array.isArray(adh.validationResults) && adh.validationResults.length === 4) checksPassed++;
        if (
          Array.isArray(adh.validationResults) &&
          adh.validationResults[0]?.ruleId === 'RULE-001' &&
          adh.validationResults[1]?.ruleId === 'RULE-002' &&
          adh.validationResults[2]?.ruleId === 'RULE-003' &&
          adh.validationResults[3]?.ruleId === 'RULE-004'
        ) checksPassed++;
        if (Array.isArray(adh.exclusionReasons) && adh.exclusionReasons.length === 0) checksPassed++;
        if (adh.controleGlobal === 'ok') checksPassed++;
        if (adh.estExclue === false && adh.status === 'VALID') checksPassed++;
      }

      assert(
        checksPassed === checksTotal,
        `Structure VALID : ${checksPassed}/${checksTotal} vérifications OK`,
        `Attendu : ${checksTotal}`
      );
    }

    // ============================================================
    // ÉTAPE 5 — Échantillon EXCLUDED
    // ============================================================
    section('5. Structure des adhésions EXCLUDED');

    const excludedSample = await Adhesion.find({
      importJobId: lastJob._id,
      status: 'EXCLUDED',
    })
      .limit(10)
      .lean();

    if (excludedSample.length === 0) {
      console.log(`   ${INFO} Aucune exclusion`);
    } else {
      let checksPassed = 0;
      let checksTotal = 0;

      const validCodes = new Set([
        'AGE_INVALIDE',
        'DATE_PRET_INVALIDE',
        'MONTANT_INVALIDE',
        'DUREE_INVALIDE',
      ]);

      for (const adh of excludedSample) {
        checksTotal += 4;
        if (Array.isArray(adh.validationResults) && adh.validationResults.length === 4) checksPassed++;
        if (Array.isArray(adh.exclusionReasons) && adh.exclusionReasons.length > 0) checksPassed++;
        if (adh.controleGlobal === 'no') checksPassed++;
        if (adh.estExclue === true && adh.status === 'EXCLUDED') checksPassed++;
      }

      assert(
        checksPassed === checksTotal,
        `Structure EXCLUDED : ${checksPassed}/${checksTotal} vérifications OK`,
        `Attendu : ${checksTotal}`
      );
    }

    // ============================================================
    // ÉTAPE 6 — Ordre des résultats
    // ============================================================
    section('6. Ordre des résultats');

    if (validSample.length > 0) {
      const order = validSample[0].validationResults.map((r) => r.ruleId).join(' → ');
      console.log(`   ${INFO} validationResults : ${c.gray}${order}${c.reset}`);
      assert(
        order === 'RULE-001 → RULE-002 → RULE-003 → RULE-004',
        `Ordre correct`,
        `Observé : ${order}`
      );
    }

    // ============================================================
    // ÉTAPE 7 — ReportingMensuel
    // ============================================================
    section('7. ReportingMensuel lié');

    if (lastJob.reportingMensuelId) {
      const ReportingMensuel = require('../src/models/ReportingMensuel');
      const reporting = await ReportingMensuel.findById(lastJob.reportingMensuelId).lean();

      if (reporting) {
        console.log(`   ${OK} ReportingMensuel trouvé`);
        console.log(`   ${INFO} Mois/Année : ${c.gray}${reporting.mois}/${reporting.annee}${c.reset}`);
        console.log(`   ${INFO} lifecycle  : ${c.gray}${reporting.lifecycle}${c.reset}`);
        console.log(`   ${INFO} version    : ${c.gray}${reporting.versionNumber}${c.reset}`);

        assert(reporting.lifecycle === 'ACTIVE', `lifecycle = ACTIVE`);
        assert(
          reporting.versionNumber === lastJob.versionNumber,
          `versionNumber cohérent`
        );
        assert(
          reporting.nombreAdhesions === counters.validRows,
          `nombreAdhesions = counters.validRows`
        );
        assert(
          reporting.nombreExclusions === counters.excludedRows,
          `nombreExclusions = counters.excludedRows`
        );
      } else {
        console.log(`   ${FAIL} ReportingMensuel introuvable`);
        totalTests++;
        failedTests++;
      }
    }

    // ============================================================
    // RAPPORT FINAL
    // ============================================================
    console.log('');
    console.log('='.repeat(70));
    console.log(`${c.bold}📊 RAPPORT FINAL${c.reset}`);
    console.log('='.repeat(70));
    console.log(`   ${c.cyan}Total tests     :${c.reset} ${totalTests}`);
    console.log(`   ${c.green}Passés          :${c.reset} ${passedTests}`);
    console.log(`   ${c.yellow}Warnings        :${c.reset} ${warningTests}`);
    console.log(`   ${c.red}Échecs          :${c.reset} ${failedTests}`);
    console.log('');

    if (failedTests === 0) {
      console.log(`${c.bold}${c.green}✅ PHASE 5.4 VALIDÉE${c.reset}`);
    } else {
      console.log(`${c.bold}${c.red}❌ PHASE 5.4 NON VALIDÉE${c.reset}`);
      console.log(`${c.gray}${failedTests} test(s) ont échoué.${c.reset}`);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('');

    await mongoose.disconnect();
    process.exit(failedTests === 0 ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error(`${c.red}❌ ERREUR : ${error.message}${c.reset}`);
    console.error(error.stack);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

verifyPhase54();