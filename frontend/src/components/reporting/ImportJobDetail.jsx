// frontend/src/components/reporting/ImportJobDetail.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { reportingAPI } from '../../api/reporting';
import LifecycleBadge from './LifecycleBadge';
import PeriodSourceBadge from './PeriodSourceBadge';

/**
 * 🔹 Phase 5.7 — Modale de détail d'un ImportJob
 *
 * Correctif v1.3 :
 *   - ignoredLines chargés À LA DEMANDE (paginés)
 *   - Utilise ignoredLinesMeta (count + byReason)
 *   - Réduit la taille de la réponse initiale (586 Ko → ~86 Ko)
 */
const ImportJobDetail = ({ importJobId, onClose }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // 🔹 Phase 5.7 — État des ignoredLines
  const [ignoredLines, setIgnoredLines] = useState([]);
  const [ignoredMeta, setIgnoredMeta] = useState({ total: 0, byReason: {} });
  const [ignoredLoading, setIgnoredLoading] = useState(false);
  const [ignoredPage, setIgnoredPage] = useState(1);
  const [ignoredLimit] = useState(50);
  const [ignoredTotalPages, setIgnoredTotalPages] = useState(1);
  const [ignoredFilter, setIgnoredFilter] = useState('');
  const [ignoredLoaded, setIgnoredLoaded] = useState(false);

  const fetchedRef = useRef(false);

  const moisNoms = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

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

  // ============================================================
  // Charger l'ImportJob (sans ignoredLines)
  // ============================================================
  useEffect(() => {
    if (!importJobId) return;
    if (fetchedRef.current === importJobId) return;
    fetchedRef.current = importJobId;

    const fetchJob = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await reportingAPI.getImportJobById(importJobId);
        const data = response.data.data;
        setJob(data);
        setIgnoredMeta(data.ignoredLinesMeta || { total: 0, byReason: {} });
      } catch (err) {
        console.error('Erreur chargement ImportJob:', err);
        setError('Impossible de charger les détails de l\'import');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [importJobId]);

  useEffect(() => {
    return () => {
      fetchedRef.current = false;
    };
  }, []);

  // ============================================================
  // 🔹 Phase 5.7 — Charger les ignoredLines (paginé)
  // ============================================================
  const loadIgnoredLines = useCallback(
    async (page = 1, reason = '') => {
      if (!importJobId) return;

      try {
        setIgnoredLoading(true);
        const params = { page, limit: ignoredLimit };
        if (reason) params.reason = reason;

        const response = await reportingAPI.getIgnoredLines(importJobId, params);
        const data = response.data;

        setIgnoredLines(data.data || []);
        setIgnoredPage(data.pagination?.page || 1);
        setIgnoredTotalPages(data.pagination?.pages || 1);
        setIgnoredFilter(reason);

        // Mettre à jour les stats si disponibles
        if (data.stats) {
          setIgnoredMeta({
            total: data.stats.totalIgnored || 0,
            byReason: data.stats.byReason || {},
          });
        }

        setIgnoredLoaded(true);
      } catch (err) {
        console.error('Erreur chargement ignoredLines:', err);
      } finally {
        setIgnoredLoading(false);
      }
    },
    [importJobId, ignoredLimit]
  );

  // Charger les ignoredLines quand on ouvre l'onglet
  useEffect(() => {
    if (activeTab === 'ignored' && !ignoredLoaded) {
      loadIgnoredLines(1, '');
    }
  }, [activeTab, ignoredLoaded, loadIgnoredLines]);

  // Reset quand la modale se ferme
  useEffect(() => {
    return () => {
      setIgnoredLines([]);
      setIgnoredPage(1);
      setIgnoredTotalPages(1);
      setIgnoredFilter('');
      setIgnoredLoaded(false);
    };
  }, []);

  // ============================================================
  // RENDU
  // ============================================================

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              📋 Détails de l'import
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
          <div className="text-center">
            <p className="text-red-600 mb-4">
              ❌ {error || 'ImportJob introuvable'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const counters = job.counters || {};
  const detectedPeriod = job.detectedPeriod || {};
  const periodeLabel = detectedPeriod.month
    ? `${moisNoms[detectedPeriod.month - 1]} ${detectedPeriod.year}`
    : 'Non détectée';

  const sumStatuses =
    (counters.validRows || 0) +
    (counters.excludedRows || 0) +
    (counters.ignoredRows || 0) +
    (counters.errorRows || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              📋 Détails de l'import
            </h2>
            <p className="text-sm text-gray-500">{job.fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Onglets */}
        <div className="border-b px-4 flex gap-1">
          {[
            { id: 'overview', label: '📊 Vue d\'ensemble' },
            {
              id: 'ignored',
              label: `ℹ️ Lignes ignorées (${ignoredMeta.total || 0})`,
            },
            {
              id: 'anomalies',
              label: `⚠️ Anomalies (${job.anomalies?.length || 0})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ============================================ */}
          {/* ONGLET : VUE D'ENSEMBLE                      */}
          {/* ============================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Statut + Version + Durée */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Statut</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        job.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : job.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {job.status}
                    </span>
                    <LifecycleBadge lifecycle={job.lifecycle} size="sm" />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Version</p>
                  <p className="font-medium text-gray-800 mt-1">
                    v{job.versionNumber || 1}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Durée</p>
                  <p className="font-medium text-gray-800 mt-1">
                    {job.durationMs
                      ? `${(job.durationMs / 1000).toFixed(2)} s`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Période détectée */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  📅 Période détectée
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-blue-800">{periodeLabel}</span>
                  <PeriodSourceBadge
                    source={detectedPeriod.source}
                    confidence={detectedPeriod.confidence}
                  />
                  {detectedPeriod.isAmbiguous && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                      ⚠️ Ambigu
                    </span>
                  )}
                </div>
                {detectedPeriod.candidates?.length > 1 && (
                  <div className="mt-2 text-xs text-blue-700">
                    <p className="font-medium mb-1">Candidats :</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {detectedPeriod.candidates.map((c, i) => (
                        <li key={i}>
                          {moisNoms[c.month - 1]} {c.year} — source :{' '}
                          {c.source} ({c.confidence})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Compteurs */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  📊 Compteurs
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Source</p>
                    <p className="font-bold text-gray-800">
                      {counters.sourceRows ?? 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Traitées</p>
                    <p className="font-bold text-gray-800">
                      {counters.processedRows ?? 0}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-xs text-green-700">Conformes</p>
                    <p className="font-bold text-green-600">
                      {counters.validRows ?? 0}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <p className="text-xs text-red-700">Exclues</p>
                    <p className="font-bold text-red-600">
                      {counters.excludedRows ?? 0}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded p-2">
                    <p className="text-xs text-yellow-700">Ignorées</p>
                    <p className="font-bold text-yellow-600">
                      {counters.ignoredRows ?? 0}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <p className="text-xs text-orange-700">Erreurs</p>
                    <p className="font-bold text-orange-600">
                      {counters.errorRows ?? 0}
                    </p>
                  </div>
                </div>

                {counters.sourceRows != null && (
                  <div
                    className={`mt-2 p-2 rounded text-xs ${
                      counters.sourceRows === sumStatuses
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {counters.sourceRows === sumStatuses
                      ? '✅ Compteurs cohérents'
                      : `❌ Incohérence : source=${counters.sourceRows}, somme=${sumStatuses}`}
                  </div>
                )}
              </div>

              {/* Métadonnées techniques */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                  🔧 Métadonnées techniques
                </summary>
                <div className="mt-2 space-y-1 text-xs bg-gray-50 p-3 rounded">
                  <div>
                    <span className="text-gray-500">FileHash :</span>{' '}
                    <span className="font-mono text-gray-700">
                      {job.fileHash || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Taille :</span>{' '}
                    <span className="text-gray-700">
                      {job.fileSize
                        ? `${(job.fileSize / 1024).toFixed(1)} Ko`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Démarré :</span>{' '}
                    <span className="text-gray-700">
                      {job.startedAt
                        ? new Date(job.startedAt).toLocaleString('fr-FR')
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Terminé :</span>{' '}
                    <span className="text-gray-700">
                      {job.completedAt
                        ? new Date(job.completedAt).toLocaleString('fr-FR')
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* ============================================ */}
          {/* ONGLET : LIGNES IGNORÉES (paginé)            */}
          {/* ============================================ */}
          {activeTab === 'ignored' && (
            <div>
              {/* Statistiques par raison */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => loadIgnoredLines(1, '')}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                    ignoredFilter === ''
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Toutes ({ignoredMeta.total || 0})
                </button>
                {Object.entries(ignoredMeta.byReason || {}).map(
                  ([reason, count]) => (
                    <button
                      key={reason}
                      onClick={() => loadIgnoredLines(1, reason)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                        ignoredFilter === reason
                          ? 'bg-blue-600 text-white'
                          : `${
                              reasonColors[reason] ||
                              'bg-gray-100 text-gray-700'
                            } hover:opacity-80`
                      }`}
                    >
                      {reasonLabels[reason] || reason} ({count})
                    </button>
                  )
                )}
              </div>

              {/* Tableau */}
              {ignoredLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div>
                </div>
              ) : ignoredLines.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm">Aucune ligne ignorée</p>
                </div>
              ) : (
                <>
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
                        {ignoredLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800 font-mono">
                              {line.sourceRowNumber}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {line.sheetName || '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                                  reasonColors[line.reason] ||
                                  'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {reasonLabels[line.reason] || line.reason}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate">
                              {line.rawData
                                ? Object.entries(line.rawData)
                                    .slice(0, 3)
                                    .map(
                                      ([k, v]) =>
                                        `${k}: "${v || ''}"`
                                    )
                                    .join(' | ')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {ignoredTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-gray-500">
                        Page {ignoredPage} sur {ignoredTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            loadIgnoredLines(
                              Math.max(1, ignoredPage - 1),
                              ignoredFilter
                            )
                          }
                          disabled={ignoredPage === 1}
                          className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          ←
                        </button>
                        <span className="px-3 py-1 text-gray-600">
                          {ignoredPage} / {ignoredTotalPages}
                        </span>
                        <button
                          onClick={() =>
                            loadIgnoredLines(
                              Math.min(ignoredTotalPages, ignoredPage + 1),
                              ignoredFilter
                            )
                          }
                          disabled={ignoredPage === ignoredTotalPages}
                          className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* ONGLET : ANOMALIES                            */}
          {/* ============================================ */}
          {activeTab === 'anomalies' && (
            <div>
              {!job.anomalies || job.anomalies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm">Aucune anomalie détectée</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {job.anomalies.map((a, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        a.severity === 'ERROR'
                          ? 'bg-red-50 border-red-200'
                          : a.severity === 'WARNING'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            a.severity === 'ERROR'
                              ? 'bg-red-100 text-red-700'
                              : a.severity === 'WARNING'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {a.severity}
                        </span>
                        <span className="text-sm font-mono text-gray-600">
                          {a.code}
                        </span>
                        {a.rowNumber && (
                          <span className="text-xs text-gray-500">
                            Ligne {a.rowNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

export default ImportJobDetail;