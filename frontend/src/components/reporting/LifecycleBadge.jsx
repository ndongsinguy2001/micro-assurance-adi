// frontend/src/components/reporting/LifecycleBadge.jsx
import React from 'react';

/**
 * 🔹 Phase 5.6 — Badge de lifecycle
 *
 * Affiche le cycle de vie d'un ImportJob ou ReportingMensuel :
 *   - ACTIVE     : vert
 *   - SUPERSEDED : orange
 *   - REPLACED   : bleu
 *   - FAILED     : rouge
 */
const LifecycleBadge = ({ lifecycle, size = 'md' }) => {
  if (!lifecycle) return null;

  const config = {
    ACTIVE: {
      label: 'Actif',
      className: 'bg-green-100 text-green-700',
    },
    SUPERSEDED: {
      label: 'Remplacé',
      className: 'bg-orange-100 text-orange-700',
    },
    REPLACED: {
      label: 'A remplacé',
      className: 'bg-blue-100 text-blue-700',
    },
    FAILED: {
      label: 'Échoué',
      className: 'bg-red-100 text-red-700',
    },
  };

  const c = config[lifecycle] || {
    label: lifecycle,
    className: 'bg-gray-100 text-gray-700',
  };

  const sizeClass =
    size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-block rounded-full font-medium ${sizeClass} ${c.className}`}
    >
      {c.label}
    </span>
  );
};

export default LifecycleBadge;