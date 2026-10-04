// backend/src/services/sheetDetector.js
/**
 * 🔍 Service de détection intelligente des feuilles Excel
 *
 * Rôle (Phase 5.8) :
 *   - Identifier automatiquement la feuille de reporting
 *     SANS dépendre de son nom
 *   - Se baser sur le CONTENU (en-têtes attendus)
 *   - Identifier aussi la feuille PSB (paramètres)
 *
 * ⚠️ Principe :
 *   Le nom de la feuille ne doit JAMAIS bloquer l'import.
 *   C'est la présence des colonnes attendues qui prime.
 *
 * ============================================================
 * ALGORITHME
 * ============================================================
 *
 * 1. Parcourir TOUTES les feuilles du classeur
 * 2. Pour chaque feuille :
 *    a. Lire les 30 premières lignes
 *    b. Chercher une ligne d'en-tête contenant au moins 2 mots-clés
 *       parmi : "Identifiant emprunteur", "Nom emprunteur", "Nom", "ID"
 *    c. Si trouvée → cette feuille est la feuille de reporting
 * 3. Retourner un résultat détaillé :
 *    - La feuille trouvée
 *    - La ligne d'en-tête (index)
 *    - Les colonnes disponibles
 *    - La liste des feuilles explorées
 *    - Les warnings éventuels
 *
 * ============================================================
 */

// ============================================================
// CONSTANTES
// ============================================================

const PREVIEW_LIMIT = 30;

/**
 * Mots-clés pour identifier la feuille de reporting.
 * Il faut au moins 2 mots-clés dans une même ligne pour valider.
 */
const REPORTING_HEADER_KEYWORDS = [
  'identifiant emprunteur',
  'identifiant',
  'nom emprunteur',
  'nom',
  'id',
  'montant du prêt',
  'montant pret',
  'date du prêt',
  'date pret',
  'durée du prêt',
  'duree pret',
  'guichet',
];

/**
 * Mots-clés pour identifier la feuille PSB (paramètres).
 */
const PSB_HEADER_KEYWORDS = [
  'âge minimum',
  'age minimum',
  'âge maximum',
  'age maximum',
  'taux de prime',
  'durée minimum',
  'duree minimum',
  'montant minimum',
  'montant maximum',
  'taux de frais',
  'date d\'effet',
];

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalise une chaîne pour la comparaison :
 *   - Majuscules
 *   - Sans accents
 *   - Sans espaces superflus
 */
const normalize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Extrait les 30 premières lignes d'une feuille sous forme de tableau.
 *
 * @param {Object} sheet - Feuille ExcelJS
 * @returns {Array<Array<string>>}
 */
const extractPreview = (sheet) => {
  const previewRows = [];
  const maxRow = Math.min(PREVIEW_LIMIT, sheet.actualRowCount || sheet.rowCount || 0);

  for (let i = 1; i <= maxRow; i++) {
    const row = sheet.getRow(i);
    if (!row || !row.hasValues) {
      previewRows.push([]);
      continue;
    }
    const rowData = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      rowData.push(cell.text);
    });
    previewRows.push(rowData);
  }

  return previewRows;
};

/**
 * Compte le nombre de mots-clés trouvés dans une ligne.
 *
 * @param {Array<string>} row - Ligne de cellules
 * @param {Array<string>} keywords - Mots-clés à chercher
 * @returns {number}
 */
const countKeywordMatches = (row, keywords) => {
  let count = 0;
  for (const cell of row) {
    if (!cell || typeof cell !== 'string') continue;
    const normalized = normalize(cell);

    for (const keyword of keywords) {
      if (normalized.includes(normalize(keyword))) {
        count++;
        break; // un seul mot-clé par cellule
      }
    }
  }
  return count;
};

/**
 * Cherche la ligne d'en-tête d'une feuille.
 *
 * @param {Array<Array<string>>} previewRows
 * @param {Array<string>} keywords
 * @param {number} minMatch - Nombre minimum de mots-clés trouvés
 * @returns {number} index (1-based) ou -1
 */
const findHeaderRow = (previewRows, keywords, minMatch = 2) => {
  for (let i = 0; i < previewRows.length; i++) {
    const row = previewRows[i];
    if (!row || row.length === 0) continue;

    const matches = countKeywordMatches(row, keywords);
    if (matches >= minMatch) {
      return i + 1; // 1-based
    }
  }
  return -1;
};

// ============================================================
// DÉTECTION DE LA FEUILLE DE REPORTING
// ============================================================

/**
 * Détecte la feuille contenant les données de reporting.
 *
 * ⚠️ Ne dépend PAS du nom de la feuille.
 *    Se base sur le contenu (mots-clés d'en-tête).
 *
 * @param {Object} workbook - Classeur ExcelJS
 * @returns {{
 *   sheet: Object|null,        // Feuille trouvée (objet ExcelJS)
 *   sheetName: string|null,    // Nom de la feuille
 *   headerRowIndex: number,    // Index (1-based) de la ligne d'en-tête
 *   matchedKeywords: number,   // Nombre de mots-clés trouvés
 *   exploredSheets: Array,     // Toutes les feuilles explorées (nom + score)
 *   warnings: Array,           // Warnings éventuels
 * }}
 */
const detectReportingSheet = (workbook) => {
  const warnings = [];
  const exploredSheets = [];

  let bestMatch = null;
  let bestScore = 0;

  // 1. Parcourir toutes les feuilles
  workbook.eachSheet((sheet) => {
    const sheetName = sheet.name;
    const previewRows = extractPreview(sheet);

    // 2. Chercher la ligne d'en-tête
    const headerRowIndex = findHeaderRow(previewRows, REPORTING_HEADER_KEYWORDS, 2);

    if (headerRowIndex === -1) {
      exploredSheets.push({
        name: sheetName,
        matchedKeywords: 0,
        headerRowIndex: -1,
        kept: false,
      });
      return;
    }

    // 3. Compter les mots-clés trouvés
    const headerRow = previewRows[headerRowIndex - 1] || [];
    const matches = countKeywordMatches(headerRow, REPORTING_HEADER_KEYWORDS);

    exploredSheets.push({
      name: sheetName,
      matchedKeywords: matches,
      headerRowIndex,
      kept: matches > bestScore,
    });

    // 4. Garder le meilleur score
    if (matches > bestScore) {
      bestScore = matches;
      bestMatch = {
        sheet,
        sheetName,
        headerRowIndex,
        matchedKeywords: matches,
      };
    }
  });

  // 5. Aucune feuille trouvée
  if (!bestMatch) {
    warnings.push({
      code: 'NO_REPORTING_SHEET_FOUND',
      message:
        'Aucune feuille ne contient les colonnes attendues (Nom emprunteur, Identifiant emprunteur, etc.)',
      severity: 'ERROR',
      exploredSheets,
    });

    return {
      sheet: null,
      sheetName: null,
      headerRowIndex: -1,
      matchedKeywords: 0,
      exploredSheets,
      warnings,
    };
  }

  // 6. Warning si plusieurs feuilles correspondent
  const validSheets = exploredSheets.filter((s) => s.matchedKeywords >= 2);
  if (validSheets.length > 1) {
    warnings.push({
      code: 'MULTIPLE_REPORTING_SHEETS',
      message: `${validSheets.length} feuilles contiennent les colonnes attendues. La première a été retenue : "${bestMatch.sheetName}"`,
      severity: 'WARNING',
      candidates: validSheets.map((s) => ({
        name: s.name,
        matchedKeywords: s.matchedKeywords,
      })),
    });
  }

  // 7. Warning si le nom est inhabituel
  const knownNames = ['Mensuel OK', 'Mensuel ok', 'Mensuel', 'Mensuel Base', 'Mensuel base'];
  if (!knownNames.includes(bestMatch.sheetName)) {
    warnings.push({
      code: 'NON_STANDARD_SHEET_NAME',
      message: `La feuille retenue s'appelle "${bestMatch.sheetName}" (nom non standard). Le contenu est conforme.`,
      severity: 'INFO',
    });
  }

  return {
    sheet: bestMatch.sheet,
    sheetName: bestMatch.sheetName,
    headerRowIndex: bestMatch.headerRowIndex,
    matchedKeywords: bestMatch.matchedKeywords,
    exploredSheets,
    warnings,
  };
};

// ============================================================
// DÉTECTION DE LA FEUILLE PSB
// ============================================================

/**
 * Détecte la feuille des paramètres PSB.
 *
 * ⚠️ Ne dépend PAS du nom "PSB".
 *    Se base sur le contenu (mots-clés comme "Âge minimum", "Taux de prime").
 *
 * @param {Object} workbook
 * @returns {{
 *   sheet: Object|null,
 *   sheetName: string|null,
 *   matchedKeywords: number,
 *   warnings: Array,
 * }}
 */
const detectPSBSheet = (workbook) => {
  const warnings = [];

  let bestMatch = null;
  let bestScore = 0;

  workbook.eachSheet((sheet) => {
    const previewRows = extractPreview(sheet);

    // Chercher les mots-clés PSB dans les 30 premières lignes
    let score = 0;
    for (const row of previewRows) {
      for (const cell of row) {
        if (!cell || typeof cell !== 'string') continue;
        const normalized = normalize(cell);
        for (const keyword of PSB_HEADER_KEYWORDS) {
          if (normalized.includes(normalize(keyword))) {
            score++;
            break;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { sheet, sheetName: sheet.name, matchedKeywords: score };
    }
  });

  // Minimum 3 mots-clés pour valider le PSB
  if (!bestMatch || bestScore < 3) {
    warnings.push({
      code: 'NO_PSB_SHEET_FOUND',
      message:
        'Aucune feuille ne contient les paramètres du contrat (Âge minimum, Taux de prime, etc.)',
      severity: 'WARNING',
    });

    return {
      sheet: null,
      sheetName: null,
      matchedKeywords: bestScore,
      warnings,
    };
  }

  return {
    sheet: bestMatch.sheet,
    sheetName: bestMatch.sheetName,
    matchedKeywords: bestMatch.matchedKeywords,
    warnings,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  detectReportingSheet,
  detectPSBSheet,
  _internal: {
    normalize,
    extractPreview,
    findHeaderRow,
    countKeywordMatches,
    REPORTING_HEADER_KEYWORDS,
    PSB_HEADER_KEYWORDS,
  },
};