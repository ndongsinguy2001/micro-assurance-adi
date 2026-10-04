// backend/scripts/verify-phase-5.8.js
/**
 * 🔍 Vérification Phase 5.8 — Détection intelligente de feuilles
 *
 * Analyse un fichier Excel et affiche :
 *   - La feuille détectée pour le reporting
 *   - La feuille détectée pour le PSB
 *   - Les warnings éventuels
 *
 * USAGE :
 *   node scripts/verify-phase-5.8.js chemin/vers/fichier.xlsx
 */

require('dotenv').config();
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const sheetDetector = require('../src/services/sheetDetector');

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const main = async () => {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error(`${c.red}❌ Usage : node scripts/verify-phase-5.8.js chemin/vers/fichier.xlsx${c.reset}`);
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`${c.red}❌ Fichier introuvable : ${filePath}${c.reset}`);
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`${c.bold}🔍 VÉRIFICATION PHASE 5.8 — Détection de feuilles${c.reset}`);
  console.log('='.repeat(70));
  console.log('');
  console.log(`${c.cyan}📄 Fichier :${c.reset} ${path.basename(filePath)}`);

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log(`${c.cyan}📋 Feuilles présentes :${c.reset}`);
    workbook.eachSheet((ws) => {
      console.log(`   • "${ws.name}" (${ws.actualRowCount || ws.rowCount || 0} lignes)`);
    });
    console.log('');

    // Détection reporting
    console.log(`${c.bold}━━━ Feuille de REPORTING ━━━${c.reset}`);
    const reporting = sheetDetector.detectReportingSheet(workbook);

    if (reporting.sheet) {
      console.log(`   ${c.green}✅ Feuille trouvée :${c.reset} "${reporting.sheetName}"`);
      console.log(`   ${c.gray}   Ligne d'en-tête : ${reporting.headerRowIndex}${c.reset}`);
      console.log(`   ${c.gray}   Mots-clés trouvés : ${reporting.matchedKeywords}${c.reset}`);
    } else {
      console.log(`   ${c.red}❌ Aucune feuille de reporting trouvée${c.reset}`);
    }

    console.log('');
    console.log(`   ${c.cyan}Feuilles explorées :${c.reset}`);
    reporting.exploredSheets.forEach((s) => {
      const status = s.matchedKeywords >= 2 ? '✅' : '❌';
      console.log(`     ${status} "${s.name}" — ${s.matchedKeywords} mots-clés`);
    });

    if (reporting.warnings && reporting.warnings.length > 0) {
      console.log('');
      console.log(`   ${c.yellow}Warnings :${c.reset}`);
      reporting.warnings.forEach((w) => {
        console.log(`     [${w.severity}] ${w.code} : ${w.message}`);
      });
    }

    // Détection PSB
    console.log('');
    console.log(`${c.bold}━━━ Feuille PSB (paramètres) ━━━${c.reset}`);
    const psb = sheetDetector.detectPSBSheet(workbook);

    if (psb.sheet) {
      console.log(`   ${c.green}✅ Feuille trouvée :${c.reset} "${psb.sheetName}"`);
      console.log(`   ${c.gray}   Mots-clés trouvés : ${psb.matchedKeywords}${c.reset}`);
    } else {
      console.log(`   ${c.yellow}⚠️  Aucune feuille PSB trouvée (fallback : valeurs par défaut)${c.reset}`);
    }

    // Verdict
    console.log('');
    console.log('='.repeat(70));
    if (reporting.sheet) {
      console.log(`${c.bold}${c.green}✅ FICHIER IMPORTABLE${c.reset}`);
    } else {
      console.log(`${c.bold}${c.red}❌ FICHIER NON IMPORTABLE${c.reset}`);
    }
    console.log('='.repeat(70));
    console.log('');

    process.exit(reporting.sheet ? 0 : 1);
  } catch (error) {
    console.error(`${c.red}❌ Erreur : ${error.message}${c.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
};

main();