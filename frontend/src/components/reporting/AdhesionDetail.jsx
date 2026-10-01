// frontend/src/components/reporting/AdhesionDetail.jsx
import React from 'react';
import ExclusionReasonsBadge from './ExclusionReasonsBadge';

/**
 * 🔹 Phase 5.6 — Modale de détail d'une adhésion
 *
 * Affiche :
 *   - Identité et données du prêt
 *   - Statut (VALID/EXCLUDED)
 *   - validationResults[] (4 règles)
 *   - exclusionReasons[] (si EXCLUDED)
 *   - Traçabilité (sourceRowNumber, sheetName)
 */
const AdhesionDetail = ({ adhesion, onClose }) => {
  if (!adhesion) return null;

  const formatMontant = (v) =>
    v != null ? new Intl.NumberFormat('fr-FR').format(v) + ' FCFA' : '—';

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
  };

  const isExcluded = adhesion.status === 'EXCLUDED' || adhesion.estExclue;

  const ruleNames = {
    'RULE-001': 'Date de prêt valide',
    'RULE-002': 'Âge conforme',
    'RULE-003': 'Montant conforme',
    'RULE-004': 'Durée conforme',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isExcluded ? 'bg-red-50' : 'bg-green-50'
          }`}
        >
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {adhesion.prenomEmprunteur} {adhesion.nomEmprunteur}
            </h2>
            <p className="text-sm text-gray-600">
              {adhesion.identifiantEmprunteur || 'Sans identifiant'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                isExcluded
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {isExcluded ? '⚠️ EXCLUE' : '✅ VALIDE'}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Traçabilité */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">📍 Traçabilité</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Ligne Excel :</span>{' '}
                <span className="font-mono font-medium text-gray-800">
                  {adhesion.sourceRowNumber ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Feuille :</span>{' '}
                <span className="font-medium text-gray-800">
                  {adhesion.sheetName || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Données du prêt */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">💰 Données du prêt</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Montant</p>
                <p className="font-medium text-gray-800">
                  {formatMontant(adhesion.montantPret)}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Durée</p>
                <p className="font-medium text-gray-800">
                  {adhesion.dureePret || 0} mois
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Date du prêt</p>
                <p className="font-medium text-gray-800">{formatDate(adhesion.datePret)}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Fin du prêt</p>
                <p className="font-medium text-gray-800">
                  {formatDate(adhesion.dateFinPret)}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Âge</p>
                <p className="font-medium text-gray-800">{adhesion.age || 0} ans</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Sexe</p>
                <p className="font-medium text-gray-800">{adhesion.sexe || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Prime</p>
                <p className="font-medium text-gray-800">
                  {formatMontant(adhesion.prime)}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Frais gestion</p>
                <p className="font-medium text-gray-800">
                  {formatMontant(adhesion.fraisGestion)}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-500">Montant dû</p>
                <p className="font-medium text-gray-800">
                  {formatMontant(adhesion.montantDu)}
                </p>
              </div>
            </div>
          </div>

          {/* Motifs d'exclusion */}
          {isExcluded && adhesion.exclusionReasons?.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm font-medium text-red-900 mb-2">
                ⚠️ Motifs d'exclusion
              </p>
              <div className="space-y-2">
                {adhesion.exclusionReasons.map((r, i) => (
                  <div key={i} className="bg-white rounded p-2 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-red-600">
                        {r.ruleId}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        {r.code}
                      </span>
                    </div>
                    <p className="text-gray-700">{r.message}</p>
                    {r.normalizedValue != null && (
                      <p className="text-xs text-gray-500 mt-1">
                        Valeur observée : {String(r.normalizedValue)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résultats des règles */}
          {adhesion.validationResults?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                🔍 Résultats des règles ({adhesion.validationResults.length})
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-xs text-gray-500 font-medium">
                        Règle
                      </th>
                      <th className="px-2 py-1 text-left text-xs text-gray-500 font-medium">
                        Champ
                      </th>
                      <th className="px-2 py-1 text-center text-xs text-gray-500 font-medium">
                        Résultat
                      </th>
                      <th className="px-2 py-1 text-left text-xs text-gray-500 font-medium">
                        Détail
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adhesion.validationResults.map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-xs font-mono text-gray-600">
                          {r.ruleId}
                        </td>
                        <td className="px-2 py-1 text-xs text-gray-600">
                          {r.field}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <span
                            className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                              r.passed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {r.passed ? 'OK' : 'Échec'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-xs text-gray-500">
                          {r.message || r.expectedValue || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Données brutes (si disponibles) */}
          {adhesion.rawData && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                🔧 Données brutes Excel
              </summary>
              <div className="mt-2 bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
                <pre>{JSON.stringify(adhesion.rawData, null, 2)}</pre>
              </div>
            </details>
          )}
        </div>

        {/* Pied */}
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdhesionDetail;