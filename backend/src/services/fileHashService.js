// backend/src/services/fileHashService.js
const crypto = require('crypto');
const fs = require('fs');

/**
 * 🔐 Service de hash de fichier
 *
 * ⚠️ Portée Phase 5.1 :
 *   - Identifie un FICHIER (empreinte SHA-256)
 *   - NE détecte PAS les doublons d'adhésions
 *
 * ⚠️ Portée Phase 5.3 :
 *   - Le hash est OBLIGATOIRE pour les imports
 *   - Refus explicite si le hash ne peut pas être calculé
 */

/**
 * Calcule le hash SHA-256 d'un fichier, en streaming.
 *
 * @param {string} filePath - Chemin absolu ou relatif du fichier
 * @returns {Promise<string|null>} Hash hex (64 caractères) ou null si erreur
 */
const computeFileHash = (filePath) => {
  return new Promise((resolve) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return resolve(null);
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => {
      console.warn(`⚠️ computeFileHash: erreur lecture (${err.message})`);
      resolve(null);
    });
  });
};

/**
 * Construit une clé composite lisible (utile pour logs / debug).
 */
const buildCompositeKey = ({ fileHash, institutionId, month, year }) => {
  const h = fileHash ? fileHash.substring(0, 16) : 'nohash';
  const inst = institutionId ? String(institutionId) : 'noinst';
  const m = month != null ? String(month).padStart(2, '0') : 'MM';
  const y = year != null ? String(year) : 'YYYY';
  return `${h}::${inst}::${y}-${m}`;
};

/**
 * 🔹 Phase 5.3 — Vérifie que le hash est disponible.
 * Lève une erreur métier si le hash est null.
 *
 * @param {string|null} fileHash
 * @throws {Error} FILE_HASH_UNAVAILABLE
 */
const assertHashAvailable = (fileHash) => {
  if (!fileHash) {
    const err = new Error(
      'Impossible de calculer l\'empreinte du fichier. Vérifiez que le fichier est lisible et non corrompu.'
    );
    err.code = 'FILE_HASH_UNAVAILABLE';
    throw err;
  }
};

module.exports = {
  computeFileHash,
  buildCompositeKey,
  assertHashAvailable, // 🔹 Phase 5.3
};