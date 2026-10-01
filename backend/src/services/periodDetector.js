// backend/src/services/periodDetector.js
/**
 * 📅 Service de détection de période de reporting
 *
 * Rôle (Phase 5.2) :
 *   - Détecter le mois et l'année d'un reporting Excel
 *   - Appliquer une priorité stricte : filename > sheet-header > content > legacy
 *   - Signaler les conflits et ambiguïtés sans les masquer
 *   - Ne JAMAIS utiliser de fallback système silencieux
 *
 * ============================================================
 * PRIORITÉ DE DÉTECTION
 * ============================================================
 *
 *   1. user-provided  → fourni explicitement (Phase 6+)
 *   2. filename       → nom du fichier (convention IG)
 *   3. sheet-header   → ligne 1 (Date début / Date fin)
 *   4. content        → colonne "Mois du reporting" (10 lignes après en-tête)
 *   5. legacy         → première Date du prêt (fallback historique)
 *
 *   ⚠️ Aucun fallback système (année courante) n'est utilisé.
 *      Si aucune source fiable → NO_PERIOD_SOURCE (bloquant).
 *
 * ============================================================
 * FORMAT DE RETOUR
 * ============================================================
 *
 *   {
 *     mois: 3,
 *     annee: 2025,
 *     source: 'filename' | 'sheet-header' | 'content' | 'legacy' | 'none',
 *     confidence: 'HIGH' | 'MEDIUM' | 'LOW',
 *     isReliable: Boolean,
 *     isAmbiguous: Boolean,
 *     candidates: [{ mois, annee, source, confidence }],
 *     warnings: [{ code, message, severity, details }],
 *   }
 *
 * ============================================================
 * CODES D'ERREUR / WARNING
 * ============================================================
 *
 *   NO_PERIOD_SOURCE                ERROR    Aucune source fiable trouvée
 *   MULTIPLE_MONTHS_IN_FILENAME     ERROR    Plusieurs mois dans le nom
 *   MONTH_WITHOUT_YEAR              ERROR    Mois trouvé mais aucune année
 *   PERIOD_CONFLICT                 WARNING  Conflit entre sources
 *   INVALID_YEAR_IN_FILENAME        WARNING  Année invalide détectée
 *   INVALID_MONTH_IN_FILENAME       WARNING  Mois invalide détecté
 *   SHORT_YEAR_IN_FILENAME          WARNING  Année sur 2 chiffres
 *   PERIOD_COMPLETED_FROM_MULTIPLE_SOURCES  INFO  Mois et année d'origines différentes
 *   FILENAME_NO_PERIOD              INFO     Nom sans information
 *   HEADER_NO_PERIOD                INFO     En-tête sans information
 *   CONTENT_NO_PERIOD               INFO     Contenu sans information
 *   LEGACY_NO_PERIOD                INFO     Legacy sans information
 *
 * ============================================================
 * HISTORIQUE
 * ============================================================
 *   5.2.0 — Version initiale
 *   5.2.1 — Corrections :
 *           - E.1 : sélection mois prioritaire + complétion année
 *           - G.4 : regex numérique tolérante à _
 */

// ============================================================
// DICTIONNAIRES DE MOIS
// ============================================================

const MOIS_FR = {
  JANVIER: 1,
  FEVRIER: 2,
  MARS: 3,
  AVRIL: 4,
  MAI: 5,
  JUIN: 6,
  JUILLET: 7,
  AOUT: 8,
  SEPTEMBRE: 9,
  OCTOBRE: 10,
  NOVEMBRE: 11,
  DECEMBRE: 12,
};

const MOIS_FR_LIST = Object.keys(MOIS_FR);

// ============================================================
// NORMALISATION
// ============================================================

/**
 * Normalise une chaîne pour la détection :
 *   - Majuscules
 *   - Sans accents
 *   - Sans espaces superflus
 *
 * @param {string} str
 * @returns {string}
 */
const normalizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Retire l'extension d'un nom de fichier.
 * @param {string} fileName
 * @returns {string}
 */
const stripExtension = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  return fileName.replace(/\.[^.]+$/, '');
};

// ============================================================
// DÉTECTION DEPUIS LE NOM DU FICHIER
// ============================================================

/**
 * Détecte la période depuis le nom du fichier.
 *
 * Formats supportés :
 *   - REPORTING IMCEC MARS 2025
 *   - reporting_03_2025
 *   - reporting_03-2025
 *   - reporting_2025-03
 *   - RAPPORT JANVIER 2020
 *   - reporting_mars_25 (année courte → warning)
 *
 * @param {string} fileName
 * @returns {{ mois: number|null, annee: number|null, multipleMonths: boolean, warnings: Array }}
 */
const detectFromFilename = (fileName) => {
  const warnings = [];
  let mois = null;
  let annee = null;
  let multipleMonths = false;

  if (!fileName) {
    return { mois: null, annee: null, multipleMonths: false, warnings };
  }

  const normalized = normalizeString(stripExtension(fileName));

  // --- 1. Détecter les mois textuels (FR) ---
  // ⚠️ Utilisation de (?:^|[^A-Z]) plutôt que \b pour éviter les faux négatifs
  const monthsFound = [];
  for (const moisName of MOIS_FR_LIST) {
    const regex = new RegExp(`(?:^|[^A-Z])${moisName}(?:[^A-Z]|$)`, 'g');
    const matches = normalized.match(regex);
    if (matches && matches.length > 0) {
      monthsFound.push({
        name: moisName,
        value: MOIS_FR[moisName],
        count: matches.length,
      });
    }
  }

  // --- Cas 1a : plus d'un mois distinct → ambiguïté bloquante ---
  if (monthsFound.length > 1) {
    multipleMonths = true;
    warnings.push({
      code: 'MULTIPLE_MONTHS_IN_FILENAME',
      message: `Le nom du fichier contient plusieurs mois : ${monthsFound
        .map((m) => m.name)
        .join(', ')}`,
      severity: 'ERROR',
      details: { months: monthsFound.map((m) => m.name) },
    });
    return { mois: null, annee: null, multipleMonths: true, warnings };
  }

  // --- Cas 1b : un seul mois textuel trouvé ---
  if (monthsFound.length === 1) {
    mois = monthsFound[0].value;

    // Chercher une année (4 chiffres) dans le nom
    // ⚠️ Correction 5.2.1 : (?:^|[^0-9]) ... (?!\d) pour éviter _ et chiffres adjacents
    const yearMatch4 = normalized.match(/(?:^|[^0-9])((?:19|20)\d{2})(?!\d)/);
    if (yearMatch4) {
      annee = parseInt(yearMatch4[1], 10);
    } else {
      // Chercher année courte (2 chiffres) APRÈS le mois
      const monthIndex = normalized.indexOf(monthsFound[0].name);
      const afterMonth = normalized.substring(monthIndex + monthsFound[0].name.length);
      const yearMatch2 = afterMonth.match(/(?:^|[^0-9])(\d{2})(?!\d)/);
      if (yearMatch2) {
        const shortYear = parseInt(yearMatch2[1], 10);
        // Heuristique : 00-30 → 2000-2030, 31-99 → 1931-1999
        const fullYear = shortYear <= 30 ? 2000 + shortYear : 1900 + shortYear;
        annee = fullYear;
        warnings.push({
          code: 'SHORT_YEAR_IN_FILENAME',
          message: `Année sur 2 chiffres détectée : "${yearMatch2[1]}" → interprétée comme ${fullYear}`,
          severity: 'WARNING',
          details: { shortYear, fullYear },
        });
      }
    }

    // Validation de l'année
    if (annee !== null && (annee < 2000 || annee > 2100)) {
      warnings.push({
        code: 'INVALID_YEAR_IN_FILENAME',
        message: `Année invalide dans le nom du fichier : ${annee}`,
        severity: 'WARNING',
        details: { annee },
      });
      // On garde l'année mais on la signale
    }

    return { mois, annee, multipleMonths: false, warnings };
  }

  // --- 2. Détection numérique : YYYY-MM ou MM-YYYY ---
  // ⚠️ Correction 5.2.1 : \b remplacé par (?:^|[^0-9]) et (?!\d)
  //    car _ est un caractère de mot et casse \b

  // Format YYYY-MM (ex. 2025-03, 2025_03, 2025/03)
  const yyyymm = normalized.match(/(?:^|[^0-9])(20\d{2})[-_\/](\d{1,2})(?!\d)/);
  if (yyyymm) {
    const year = parseInt(yyyymm[1], 10);
    const month = parseInt(yyyymm[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { mois: month, annee: year, multipleMonths: false, warnings };
    } else {
      warnings.push({
        code: 'INVALID_MONTH_IN_FILENAME',
        message: `Mois invalide détecté dans le nom : ${month}`,
        severity: 'WARNING',
        details: { month, year },
      });
    }
  }

  // Format MM-YYYY (ex. 03-2025, 03_2025, 03/2025)
  const mmyyyy = normalized.match(/(?:^|[^0-9])(\d{1,2})[-_\/](20\d{2})(?!\d)/);
  if (mmyyyy) {
    const month = parseInt(mmyyyy[1], 10);
    const year = parseInt(mmyyyy[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { mois: month, annee: year, multipleMonths: false, warnings };
    } else {
      warnings.push({
        code: 'INVALID_MONTH_IN_FILENAME',
        message: `Mois invalide détecté dans le nom : ${month}`,
        severity: 'WARNING',
        details: { month, year },
      });
    }
  }

  // --- 3. Aucun format détecté ---
  warnings.push({
    code: 'FILENAME_NO_PERIOD',
    message: 'Aucune information de période détectée dans le nom du fichier',
    severity: 'INFO',
  });

  return { mois: null, annee: null, multipleMonths: false, warnings };
};

// ============================================================
// DÉTECTION DEPUIS L'EN-TÊTE DE LA FEUILLE (ligne 1)
// ============================================================

/**
 * Détecte la période depuis la ligne 1 de la feuille.
 *
 * Recherche les cellules contenant "Date début" / "Date fin",
 * ou directement une date dans les premières cellules.
 *
 * @param {Array<Array<string>>} previewRows - 30 premières lignes
 * @returns {{ mois: number|null, annee: number|null, warnings: Array }}
 */
const detectFromSheetHeader = (previewRows) => {
  const warnings = [];

  if (!previewRows || previewRows.length === 0) {
    warnings.push({
      code: 'HEADER_NO_PERIOD',
      message: 'Aucune ligne disponible pour la détection en-tête',
      severity: 'INFO',
    });
    return { mois: null, annee: null, warnings };
  }

  // Analyser les 3 premières lignes (généralement lignes 1-3)
  const maxRowsToScan = Math.min(3, previewRows.length);

  for (let i = 0; i < maxRowsToScan; i++) {
    const row = previewRows[i];
    if (!row || !Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;

      const cellStr = normalizeString(String(cell));

      // Chercher un motif "Date début" / "Date fin" / "Début période" / "Fin période"
      const isDateLabel =
        cellStr.includes('DATE DEBUT') ||
        cellStr.includes('DATE FIN') ||
        cellStr.includes('DEBUT PERIODE') ||
        cellStr.includes('FIN PERIODE') ||
        cellStr.includes('PERIODE DEBUT') ||
        cellStr.includes('PERIODE FIN');

      if (isDateLabel) {
        // La date est probablement dans la cellule suivante
        const nextCell = row[c + 1];
        if (nextCell) {
          const dateParsed = parseDateCell(nextCell);
          if (dateParsed) {
            return {
              mois: dateParsed.getMonth() + 1,
              annee: dateParsed.getFullYear(),
              warnings,
            };
          }
        }
      }
    }
  }

  warnings.push({
    code: 'HEADER_NO_PERIOD',
    message: 'Aucune information de période dans les lignes d\'en-tête',
    severity: 'INFO',
  });

  return { mois: null, annee: null, warnings };
};

/**
 * Parse une cellule qui peut contenir une date (string ou number).
 *
 * @param {any} value
 * @returns {Date|null}
 */
const parseDateCell = (value) => {
  if (!value) return null;

  // Cas 1 : Date JS
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Cas 2 : Number (Excel serial date)
  if (typeof value === 'number') {
    const ms = (value - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Cas 3 : String
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Format DD/MM/YYYY ou D/M/YYYY
    const ddmm = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmm) {
      const d = new Date(
        parseInt(ddmm[3], 10),
        parseInt(ddmm[2], 10) - 1,
        parseInt(ddmm[1], 10)
      );
      return isNaN(d.getTime()) ? null : d;
    }

    // Format YYYY-MM-DD
    const iso = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (iso) {
      const d = new Date(
        parseInt(iso[1], 10),
        parseInt(iso[2], 10) - 1,
        parseInt(iso[3], 10)
      );
      return isNaN(d.getTime()) ? null : d;
    }

    // Parse natif
    const native = new Date(trimmed);
    return isNaN(native.getTime()) ? null : native;
  }

  return null;
};

// ============================================================
// DÉTECTION DEPUIS LE CONTENU (colonne "Mois du reporting")
// ============================================================

/**
 * Détecte la période depuis la colonne "Mois du reporting".
 *
 * @param {Array<Array<string>>} previewRows - 30 premières lignes
 * @param {number} headerRowIndex - index (1-based) de l'en-tête
 * @param {number} colIndexMoisReporting - index de la colonne
 * @returns {{ mois: number|null, annee: number|null, warnings: Array }}
 */
const detectFromContent = (previewRows, headerRowIndex, colIndexMoisReporting) => {
  const warnings = [];

  if (
    !previewRows ||
    previewRows.length === 0 ||
    colIndexMoisReporting === -1 ||
    headerRowIndex < 1
  ) {
    warnings.push({
      code: 'CONTENT_NO_PERIOD',
      message: 'Colonne "Mois du reporting" non disponible',
      severity: 'INFO',
    });
    return { mois: null, annee: null, warnings };
  }

  // Analyser les 10 lignes après l'en-tête
  const maxToScan = Math.min(headerRowIndex + 10, previewRows.length);

  for (let i = headerRowIndex; i < maxToScan; i++) {
    const row = previewRows[i];
    if (!row) continue;

    const moisStr = row[colIndexMoisReporting];
    if (!moisStr) continue;

    const normalized = normalizeString(String(moisStr));

    // Chercher un mois textuel
    for (const moisName of MOIS_FR_LIST) {
      if (normalized.includes(moisName)) {
        const mois = MOIS_FR[moisName];
        // Chercher une année dans la même cellule
        const yearMatch = normalized.match(/(?:^|[^0-9])((?:19|20)\d{2})(?!\d)/);
        const annee = yearMatch ? parseInt(yearMatch[1], 10) : null;
        return { mois, annee, warnings };
      }
    }
  }

  warnings.push({
    code: 'CONTENT_NO_PERIOD',
    message: 'Aucun mois trouvé dans la colonne "Mois du reporting"',
    severity: 'INFO',
  });

  return { mois: null, annee: null, warnings };
};

// ============================================================
// DÉTECTION LEGACY (première Date du prêt)
// ============================================================

/**
 * Détection historique : première "Date du prêt" rencontrée.
 * Conservé pour non-régression.
 *
 * @param {Array<Array<string>>} previewRows
 * @param {number} headerRowIndex
 * @param {number} colIndexDatePret
 * @returns {{ mois: number|null, annee: number|null, warnings: Array }}
 */
const detectFromLegacyPretDate = (previewRows, headerRowIndex, colIndexDatePret) => {
  const warnings = [];

  if (
    !previewRows ||
    previewRows.length === 0 ||
    colIndexDatePret === -1 ||
    headerRowIndex < 1
  ) {
    warnings.push({
      code: 'LEGACY_NO_PERIOD',
      message: 'Colonne "Date du prêt" non disponible',
      severity: 'INFO',
    });
    return { mois: null, annee: null, warnings };
  }

  const maxToScan = Math.min(headerRowIndex + 30, previewRows.length);

  for (let i = headerRowIndex; i < maxToScan; i++) {
    const row = previewRows[i];
    if (!row) continue;
    const value = row[colIndexDatePret];
    if (!value) continue;

    const date = parseDateCell(value);
    if (date) {
      return {
        mois: date.getMonth() + 1,
        annee: date.getFullYear(),
        warnings,
      };
    }
  }

  warnings.push({
    code: 'LEGACY_NO_PERIOD',
    message: 'Aucune date de prêt trouvée pour la détection legacy',
    severity: 'INFO',
  });

  return { mois: null, annee: null, warnings };
};

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

/**
 * Détecte la période d'un reporting.
 *
 * Priorité : user-provided > filename > sheet-header > content > legacy
 *
 * ⚠️ Règle de complétude (Phase 5.2.1) :
 *    - Le MOIS est sélectionné par priorité de source (peu importe l'année)
 *    - Si l'année manque, elle est cherchée dans les autres sources
 *    - Si aucune année n'est trouvée → MONTH_WITHOUT_YEAR (bloquant)
 *
 * @param {Object} params
 * @param {string} params.fileName
 * @param {Array<Array<string>>} params.previewRows
 * @param {number} params.headerRowIndex
 * @param {Object} params.colIndex - { moisReporting, datePret }
 * @param {Object} [params.userProvided] - { mois, annee } si fourni par l'utilisateur
 * @returns {{
 *   mois: number|null,
 *   annee: number|null,
 *   source: string,
 *   confidence: 'HIGH'|'MEDIUM'|'LOW',
 *   isReliable: boolean,
 *   isAmbiguous: boolean,
 *   candidates: Array,
 *   warnings: Array,
 * }}
 */
const detectPeriod = ({
  fileName,
  previewRows,
  headerRowIndex,
  colIndex,
  userProvided = null,
}) => {
  const candidates = [];
  const allWarnings = [];

  // ============================================================
  // 0. Source utilisateur (si fournie)
  // ============================================================
  if (userProvided && userProvided.mois && userProvided.annee) {
    candidates.push({
      mois: userProvided.mois,
      annee: userProvided.annee,
      source: 'user-provided',
      confidence: 'HIGH',
    });
  }

  // ============================================================
  // 1. filename
  // ============================================================
  const filenameResult = detectFromFilename(fileName);
  allWarnings.push(...filenameResult.warnings);

  if (filenameResult.multipleMonths) {
    // Cas bloquant : plusieurs mois dans le nom
    return {
      mois: null,
      annee: null,
      source: 'none',
      confidence: 'LOW',
      isReliable: false,
      isAmbiguous: true,
      candidates,
      warnings: allWarnings,
    };
  }

  if (filenameResult.mois) {
    candidates.push({
      mois: filenameResult.mois,
      annee: filenameResult.annee,
      source: 'filename',
      confidence: 'HIGH',
    });
  }

  // ============================================================
  // 2. sheet-header
  // ============================================================
  const headerResult = detectFromSheetHeader(previewRows);
  allWarnings.push(...headerResult.warnings);

  if (headerResult.mois && headerResult.annee) {
    candidates.push({
      mois: headerResult.mois,
      annee: headerResult.annee,
      source: 'sheet-header',
      confidence: 'HIGH',
    });
  }

  // ============================================================
  // 3. content (colonne "Mois du reporting")
  // ============================================================
  const contentResult = detectFromContent(
    previewRows,
    headerRowIndex,
    colIndex?.moisReporting ?? -1
  );
  allWarnings.push(...contentResult.warnings);

  if (contentResult.mois) {
    candidates.push({
      mois: contentResult.mois,
      annee: contentResult.annee,
      source: 'content',
      confidence: contentResult.annee ? 'MEDIUM' : 'LOW',
    });
  }

  // ============================================================
  // 4. legacy (première Date du prêt)
  // ============================================================
  const legacyResult = detectFromLegacyPretDate(
    previewRows,
    headerRowIndex,
    colIndex?.datePret ?? -1
  );
  allWarnings.push(...legacyResult.warnings);

  if (legacyResult.mois && legacyResult.annee) {
    candidates.push({
      mois: legacyResult.mois,
      annee: legacyResult.annee,
      source: 'legacy',
      confidence: 'LOW',
    });
  }

  // ============================================================
  // SÉLECTION FINALE (Phase 5.2.1 — Complétude stricte)
  // ============================================================
  // ⚠️ Étape 1 : sélectionner la source la plus prioritaire AVEC un MOIS
  //             (même si l'année est null)
  // ⚠️ Étape 2 : si l'année manque, la chercher dans les autres sources
  // ⚠️ Étape 3 : valider que mois + année sont définis

  const priority = ['user-provided', 'filename', 'sheet-header', 'content', 'legacy'];

  // --- Étape 1 : trouver le MOIS par priorité ---
  let monthCandidate = null;
  for (const src of priority) {
    const candidate = candidates.find((c) => c.source === src && c.mois != null);
    if (candidate) {
      monthCandidate = candidate;
      break;
    }
  }

  // --- Étape 2 : si mois trouvé mais année manquante, la chercher ailleurs ---
  let yearFromOtherSource = null;
  if (monthCandidate && monthCandidate.annee == null) {
    for (const src of priority) {
      if (src === monthCandidate.source) continue; // on cherche AILLEURS
      const candidate = candidates.find(
        (c) => c.source === src && c.annee != null
      );
      if (candidate) {
        yearFromOtherSource = candidate;
        break;
      }
    }
  }

  // --- Étape 3 : construire la sélection finale ---
  let selected = null;

  if (monthCandidate) {
    if (monthCandidate.annee != null) {
      // Mois + année dans la même source → OK
      selected = monthCandidate;
    } else if (yearFromOtherSource) {
      // Mois d'une source, année d'une autre → complétion
      selected = {
        mois: monthCandidate.mois,
        annee: yearFromOtherSource.annee,
        source: monthCandidate.source, // on garde la source du MOIS
        confidence: 'MEDIUM',          // on dégrade la confiance
      };
      allWarnings.push({
        code: 'PERIOD_COMPLETED_FROM_MULTIPLE_SOURCES',
        message: `Mois détecté dans "${monthCandidate.source}", année détectée dans "${yearFromOtherSource.source}"`,
        severity: 'INFO',
        details: {
          monthFrom: monthCandidate.source,
          yearFrom: yearFromOtherSource.source,
        },
      });
    } else {
      // Mois seul, aucune année trouvée → pas fiable
      allWarnings.push({
        code: 'MONTH_WITHOUT_YEAR',
        message: `Mois détecté (${monthCandidate.mois}) mais aucune année trouvée dans les autres sources.`,
        severity: 'ERROR',
        details: { month: monthCandidate.mois, monthSource: monthCandidate.source },
      });
    }
  }

  // ============================================================
  // Aucune source fiable
  // ============================================================
  if (!selected) {
    allWarnings.push({
      code: 'NO_PERIOD_SOURCE',
      message:
        'Aucune période fiable détectée dans le nom du fichier, l\'en-tête ou le contenu. Import bloqué.',
      severity: 'ERROR',
    });
    return {
      mois: null,
      annee: null,
      source: 'none',
      confidence: 'LOW',
      isReliable: false,
      isAmbiguous: false,
      candidates,
      warnings: allWarnings,
    };
  }

  // ============================================================
  // DÉTECTION DES CONFLITS
  // ============================================================
  const distinctPeriods = new Map();
  for (const c of candidates) {
    if (c.mois != null && c.annee != null) {
      const key = `${c.annee}-${String(c.mois).padStart(2, '0')}`;
      if (!distinctPeriods.has(key)) {
        distinctPeriods.set(key, c);
      }
    }
  }

  const isAmbiguous = distinctPeriods.size > 1;

  if (isAmbiguous) {
    const periodsList = Array.from(distinctPeriods.values()).map((p) => ({
      mois: p.mois,
      annee: p.annee,
      source: p.source,
    }));

    allWarnings.push({
      code: 'PERIOD_CONFLICT',
      message: `Plusieurs périodes détectées : ${periodsList
        .map((p) => `${String(p.mois).padStart(2, '0')}/${p.annee} (${p.source})`)
        .join(', ')}. Source retenue : ${selected.source}.`,
      severity: 'WARNING',
      details: {
        selectedPeriod: { mois: selected.mois, annee: selected.annee },
        selectedSource: selected.source,
        candidates: periodsList,
      },
    });
  }

  // ============================================================
  // RETOUR
  // ============================================================
  return {
    mois: selected.mois,
    annee: selected.annee,
    source: selected.source,
    confidence: selected.confidence,
    isReliable:
      selected.confidence === 'HIGH' || selected.confidence === 'MEDIUM',
    isAmbiguous,
    candidates,
    warnings: allWarnings,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  detectPeriod,
  // Export pour tests unitaires ciblés
  _internal: {
    normalizeString,
    stripExtension,
    detectFromFilename,
    detectFromSheetHeader,
    detectFromContent,
    detectFromLegacyPretDate,
    parseDateCell,
  },
};