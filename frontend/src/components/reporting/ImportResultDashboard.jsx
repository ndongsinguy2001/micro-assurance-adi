// frontend/src/components/reporting/ImportResultDashboard.jsx
import React from 'react';
import PeriodSourceBadge from './PeriodSourceBadge';
import LifecycleBadge from './LifecycleBadge';

/**
 * 🔹 Phase 5.6 (v1.2) — Dashboard post-import
 *
 * Correctif v1.2 :
 *   - Utilise `result.institution.nom` (exposé par le backend v5.6.2)
 *   - Fallback sur `reporting.sfdId.nom` et `importJob.institutionId.nom`
 */
const ImportResultDashboard = ({
  result,
  onViewAdhesions,
  onViewExclusions,
  onViewIgnored,
  onViewJob,
  onExport,
  onClose,
}) => {
  if (!result) return null;

  const {
    reporting,
    importJob,
    institution,
    totalAdhesions,
    totalExclusions,
    dureeMs,
    action,
  } = result;

  const counters = reporting?.sourceTotals || importJob?.counters || {};
  const detectedPeriod =
    importJob?.detectedPeriod || reporting?.detectedPeriod || null;
  const version = importJob?.versionNumber || reporting?.versionNumber || 1;
  const lifecycle = importJob?.lifecycle || reporting?.lifecycle || 'ACTIVE';

  // 🔹 CORRECTIF v1.2 — Institution
  // Priorité : result.institution.nom (nouveau champ backend)
  //           → reporting.sfdId.nom (si populé)
  //           → importJob.institutionId.nom
  const institutionName =
    institution?.nom ||
    reporting?.sfdId?.nom ||
    importJob?.institutionId?.nom ||
    'N/A';

  const moisNoms = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  const periodeLabel = detectedPeriod
    ? `${moisNoms[detectedPeriod.month - 1] || detectedPeriod.month} ${detectedPeriod.year}`
    : `${moisNoms[(reporting?.mois || 1) - 1]} ${reporting?.annee || ''}`;

  const isReplacement = action === 'CREATE_WITH_REPLACE';

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden mb-4">
      {/* En-tête */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          isReplacement
            ? 'bg-blue-50 border-b border-blue-200'
            : 'bg-green-50 border-b border-green-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{isReplacement ? '🔄' : '✅'}</span>
          <div>
            <h3 className="font-bold text-gray-800">
              {isReplacement
                ? 'Import remplacé avec succès'
                : 'Import terminé avec succès'}
            </h3>
            <p className="text-sm text-gray-600">
              {reporting?.fichierOriginal?.nom || importJob?.fileName}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Corps */}
      <div className="p-4">
        {/* Métadonnées */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Institution</p>
            <p className="font-medium text-gray-800">{institutionName}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Période</p>
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-800">{periodeLabel}</span>
              {detectedPeriod?.source && (
                <PeriodSourceBadge
                  source={detectedPeriod.source}
                  confidence={detectedPeriod.confidence}
                />
              )}
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Version</p>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">v{version}</span>
              <LifecycleBadge lifecycle={lifecycle} size="sm" />
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Durée</p>
            <p className="font-medium text-gray-800">
              {dureeMs ? `${(dureeMs / 1000).toFixed(2)} s` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Compteurs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Lignes source</p>
            <p className="text-xl font-bold text-gray-800">
              {counters.sourceRows ?? '—'}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-700">Conformes</p>
            <p className="text-xl font-bold text-green-600">
              {counters.validRows ?? totalAdhesions ?? 0}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-700">Exclusions</p>
            <p className="text-xl font-bold text-red-600">
              {counters.excludedRows ?? totalExclusions ?? 0}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-700">Ignorées</p>
            <p className="text-xl font-bold text-yellow-600">
              {counters.ignoredRows ?? 0}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {onViewAdhesions && (
            <button
              onClick={onViewAdhesions}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
            >
              ✅ Voir les conformes ({counters.validRows ?? totalAdhesions ?? 0})
            </button>
          )}
          {onViewExclusions &&
            (counters.excludedRows ?? totalExclusions ?? 0) > 0 && (
              <button
                onClick={onViewExclusions}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
              >
                ⚠️ Voir les exclusions (
                {counters.excludedRows ?? totalExclusions ?? 0})
              </button>
            )}
          {onViewIgnored && (counters.ignoredRows ?? 0) > 0 && (
            <button
              onClick={onViewIgnored}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition"
            >
              ℹ️ Voir les ignorées ({counters.ignoredRows ?? 0})
            </button>
          )}
          {onViewJob && importJob?._id && (
            <button
              onClick={onViewJob}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              📋 Voir l'ImportJob
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
            >
              📊 Exporter
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportResultDashboard;