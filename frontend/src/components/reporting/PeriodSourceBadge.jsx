// frontend/src/components/reporting/PeriodSourceBadge.jsx
import React from 'react';

/**
 * 🔹 Phase 5.6 — Badge de source de détection de période
 *
 * Affiche d'où vient la période :
 *   - filename     : depuis le nom du fichier (bleu)
 *   - sheet-header : depuis la ligne 1 (cyan)
 *   - content      : depuis le contenu (indigo)
 *   - legacy       : depuis la première date de prêt (gris)
 *   - user-provided: fourni par l'utilisateur (violet)
 *   - none         : aucune source (rouge)
 */
const PeriodSourceBadge = ({ source, confidence = null }) => {
  if (!source) return null;

  const config = {
    filename: {
      label: 'Nom fichier',
      className: 'bg-blue-100 text-blue-700',
    },
    'sheet-header': {
      label: 'En-tête',
      className: 'bg-cyan-100 text-cyan-700',
    },
    content: {
      label: 'Contenu',
      className: 'bg-indigo-100 text-indigo-700',
    },
    legacy: {
      label: 'Héritage',
      className: 'bg-gray-100 text-gray-700',
    },
    'user-provided': {
      label: 'Utilisateur',
      className: 'bg-purple-100 text-purple-700',
    },
    none: {
      label: 'Aucune',
      className: 'bg-red-100 text-red-700',
    },
  };

  const c = config[source] || {
    label: source,
    className: 'bg-gray-100 text-gray-700',
  };

  // Couleur de la pastille de confiance
  const confidenceColor = {
    HIGH: 'bg-green-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-red-500',
  }[confidence];

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${c.className}`}
      >
        {c.label}
      </span>
      {confidence && (
        <span
          className={`inline-block w-2 h-2 rounded-full ${confidenceColor}`}
          title={`Confiance : ${confidence}`}
        />
      )}
    </span>
  );
};

export default PeriodSourceBadge;