// frontend/src/components/reporting/IgnoredLinesTable.jsx
import React, { useState, useMemo } from 'react';

/**
 * 🔹 Phase 5.6 — Table des lignes ignorées
 *
 * Affiche les lignes ignorées d'un ImportJob avec :
 *   - sourceRowNumber (ligne Excel)
 *   - sheetName (nom de la feuille)
 *   - reason (NO_VALUES, EMPTY_ROW, MISSING_NAME, ...)
 *   - aperçu de rawData
 */
const IgnoredLinesTable = ({ ignoredLines = [], pageSize = 20 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterReason, setFilterReason] = useState('');

  const reasonLabels = {
    NO_VALUES: 'Sans valeurs',
    EMPTY_ROW: 'Ligne vide',
    MISSING_NAME: 'Nom manquant',
    OUT_OF_RANGE: 'Hors plage',
    OTHER: 'Autre',
  };

  const reasonColors = {
    NO_VALUES: 'bg-gray-100 text-gray-700',
    EMPTY_ROW: 'bg-yellow-100 text-yellow-700',
    MISSING_NAME: 'bg-orange-100 text-orange-700',
    OUT_OF_RANGE: 'bg-red-100 text-red-700',
    OTHER: 'bg-gray-100 text-gray-700',
  };

  // Filtrage
  const filtered = useMemo(() => {
    if (!filterReason) return ignoredLines;
    return ignoredLines.filter((l) => l.reason === filterReason);
  }, [ignoredLines, filterReason]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const pageData = filtered.slice(startIndex, startIndex + pageSize);

  // Statistiques
  const statsByReason = useMemo(() => {
    const stats = {};
    ignoredLines.forEach((l) => {
      stats[l.reason] = (stats[l.reason] || 0) + 1;
    });
    return stats;
  }, [ignoredLines]);

  if (ignoredLines.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-3xl mb-2">✅</p>
        <p className="text-sm">Aucune ligne ignorée</p>
      </div>
    );
  }

  return (
    <div>
      {/* Statistiques par raison */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            setFilterReason('');
            setCurrentPage(1);
          }}
          className={`text-xs px-3 py-1 rounded-full font-medium transition ${
            filterReason === ''
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Toutes ({ignoredLines.length})
        </button>
        {Object.entries(statsByReason).map(([reason, count]) => (
          <button
            key={reason}
            onClick={() => {
              setFilterReason(reason);
              setCurrentPage(1);
            }}
            className={`text-xs px-3 py-1 rounded-full font-medium transition ${
              filterReason === reason
                ? 'bg-blue-600 text-white'
                : `${reasonColors[reason] || 'bg-gray-100 text-gray-700'} hover:opacity-80`
            }`}
          >
            {reasonLabels[reason] || reason} ({count})
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Ligne
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Feuille
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Raison
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Aperçu
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.map((line, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-800 font-mono">
                  {line.sourceRowNumber}
                </td>
                <td className="px-3 py-2 text-gray-600">{line.sheetName || '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      reasonColors[line.reason] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {reasonLabels[line.reason] || line.reason}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate">
                  {line.rawData
                    ? Object.entries(line.rawData)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: "${v || ''}"`)
                        .join(' | ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-gray-500">
            {startIndex + 1}–{Math.min(startIndex + pageSize, filtered.length)} sur{' '}
            {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              ←
            </button>
            <span className="px-3 py-1 text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IgnoredLinesTable;