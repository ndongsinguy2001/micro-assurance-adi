// frontend/src/components/reporting/ExclusionReasonsBadge.jsx
import React, { useState } from 'react';

/**
 * 🔹 Phase 5.6 — Badge de motifs d'exclusion
 *
 * Affiche le nombre de motifs + tooltip au survol.
 */
const ExclusionReasonsBadge = ({ reasons = [], compact = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!reasons || reasons.length === 0) {
    return (
      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        Aucun
      </span>
    );
  }

  const count = reasons.length;

  if (compact) {
    return (
      <span
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium cursor-help">
          {count} motif{count > 1 ? 's' : ''}
        </span>
        {showTooltip && (
          <div className="absolute z-50 top-full left-0 mt-1 w-64 p-2 bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
            {reasons.map((r, i) => (
              <div key={i} className="mb-1 last:mb-0">
                <span className="font-medium text-gray-800">{r.code}</span>
                <span className="text-gray-500 ml-1">— {r.message}</span>
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((r, i) => (
        <span
          key={i}
          className="inline-block text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700"
          title={`${r.ruleId || ''} ${r.field || ''}`}
        >
          {r.code || r.message}
        </span>
      ))}
    </div>
  );
};

export default ExclusionReasonsBadge;