// frontend/src/services/exportService.js
import * as XLSX from 'xlsx';

/**
 * Exporte des données vers un fichier Excel
 */
export const exportToExcel = (data, columns, filename = 'export') => {
  try {
    const exportData = data.map(item => {
      const row = {};
      columns.forEach(col => {
        const value = getNestedValue(item, col.key);
        row[col.label] = formatValue(value, col.type);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    const colWidths = columns.map(col => ({
      wch: Math.max(col.label.length, 12) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return true;
  } catch (error) {
    console.error('Erreur export Excel:', error);
    return false;
  }
};

const getNestedValue = (obj, path) => {
  if (!path) return '';
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return '';
    }
  }
  return result;
};

const formatValue = (value, type = 'string') => {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'date':
      if (value instanceof Date) return value.toLocaleDateString('fr-FR');
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date.toLocaleDateString('fr-FR');
      }
      return value;
    case 'currency':
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    case 'number':
      return value;
    case 'percentage':
      return `${(value * 100).toFixed(2)}%`;
    default:
      return String(value);
  }
};

// ============================================================
// FONCTIONS D'EXPORT PAR MODULE
// ============================================================

export const exportReportings = (reportings) => {
  const columns = [
    { key: 'sfdId.nom', label: 'SFD', type: 'string' },
    { key: 'code', label: 'Code', type: 'string' },
    { key: 'mois', label: 'Mois', type: 'number' },
    { key: 'annee', label: 'Année', type: 'number' },
    { key: 'nombreAdhesions', label: 'Adhésions', type: 'number' },
    { key: 'nombreExclusions', label: 'Exclusions', type: 'number' },
    { key: 'totalPrime', label: 'Prime totale', type: 'currency' },
    { key: 'commissionSFD', label: 'Commission SFD', type: 'currency' },
    { key: 'commissionIG', label: 'Commission IG', type: 'currency' },
    { key: 'statut', label: 'Statut', type: 'string' },
    { key: 'dateCloture', label: 'Date clôture', type: 'date' },
  ];
  const filename = `reportings_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(reportings, columns, filename);
};

export const exportAdhesions = (adhesions, reportingInfo) => {
  const columns = [
    { key: 'identifiantEmprunteur', label: 'Identifiant', type: 'string' },
    { key: 'nomEmprunteur', label: 'Nom', type: 'string' },
    { key: 'prenomEmprunteur', label: 'Prénom', type: 'string' },
    { key: 'dateNaissance', label: 'Date naissance', type: 'date' },
    { key: 'age', label: 'Âge', type: 'number' },
    { key: 'sexe', label: 'Sexe', type: 'string' },
    { key: 'montantPret', label: 'Montant prêt', type: 'currency' },
    { key: 'dureePret', label: 'Durée (mois)', type: 'number' },
    { key: 'datePret', label: 'Date prêt', type: 'date' },
    { key: 'dateFinPret', label: 'Date fin prêt', type: 'date' },
    { key: 'prime', label: 'Prime', type: 'currency' },
    { key: 'fraisGestion', label: 'Frais gestion', type: 'currency' },
    { key: 'taxes', label: 'Taxes', type: 'currency' },
    { key: 'montantDu', label: 'Montant dû', type: 'currency' },
    { key: 'controleGlobal', label: 'Contrôle', type: 'string' },
    { key: 'estExclue', label: 'Exclue', type: 'string' },
  ];
  const exportData = adhesions.map(adh => ({ ...adh, estExclue: adh.estExclue ? 'Oui' : 'Non' }));
  const filename = `adhesions_${reportingInfo}_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(exportData, columns, filename);
};

export const exportSinistres = (sinistres) => {
  const columns = [
    { key: 'sfdId.nom', label: 'SFD', type: 'string' },
    { key: 'adhesionId.nomEmprunteur', label: 'Emprunteur', type: 'string' },
    { key: 'typeSinistre', label: 'Type', type: 'string' },
    { key: 'montantSinistre', label: 'Montant', type: 'currency' },
    { key: 'capitalRestantDu', label: 'Capital restant', type: 'currency' },
    { key: 'capitalRembourse', label: 'Capital remboursé', type: 'currency' },
    { key: 'dateSinistre', label: 'Date sinistre', type: 'date' },
    { key: 'dateDeclaration', label: 'Date déclaration', type: 'date' },
    { key: 'dateValidation', label: 'Date validation', type: 'date' },
    { key: 'datePaiement', label: 'Date paiement', type: 'date' },
    { key: 'statut', label: 'Statut', type: 'string' },
  ];
  const filename = `sinistres_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(sinistres, columns, filename);
};

export const exportSFD = (sfds) => {
  const columns = [
    { key: 'code', label: 'Code', type: 'string' },
    { key: 'nom', label: 'Nom', type: 'string' },
    { key: 'pays', label: 'Pays', type: 'string' },
    { key: 'region', label: 'Région', type: 'string' },
    { key: 'assureurId.nom', label: 'Assureur', type: 'string' },
    { key: 'contact.nom', label: 'Contact', type: 'string' },
    { key: 'contact.email', label: 'Email', type: 'string' },
    { key: 'contact.telephone', label: 'Téléphone', type: 'string' },
    { key: 'dateDebutContrat', label: 'Début contrat', type: 'date' },
    { key: 'dateFinContrat', label: 'Fin contrat', type: 'date' },
    { key: 'parametresSpecifiques.tauxCommissionSFD', label: 'Commission SFD', type: 'percentage' },
    { key: 'parametresSpecifiques.tauxCommissionIG', label: 'Commission IG', type: 'percentage' },
    { key: 'parametresSpecifiques.typeGestionSinistres', label: 'Gestion sinistres', type: 'string' },
    { key: 'statut', label: 'Statut', type: 'string' },
  ];
  const filename = `sfd_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(sfds, columns, filename);
};

export const exportAssureurs = (assureurs) => {
  const columns = [
    { key: 'code', label: 'Code', type: 'string' },
    { key: 'nom', label: 'Nom', type: 'string' },
    { key: 'pays', label: 'Pays', type: 'string' },
    { key: 'adresse', label: 'Adresse', type: 'string' },
    { key: 'contact.nom', label: 'Contact', type: 'string' },
    { key: 'contact.email', label: 'Email', type: 'string' },
    { key: 'contact.telephone', label: 'Téléphone', type: 'string' },
    { key: 'statut', label: 'Statut', type: 'string' },
  ];
  const filename = `assureurs_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(assureurs, columns, filename);
};

export const exportContrats = (contrats) => {
  const columns = [
    { key: 'code', label: 'Code', type: 'string' },
    { key: 'nom', label: 'Nom', type: 'string' },
    { key: 'sfdId.nom', label: 'SFD', type: 'string' },
    { key: 'assureurId.nom', label: 'Assureur', type: 'string' },
    { key: 'ageMin', label: 'Âge min', type: 'number' },
    { key: 'ageMaxDebut', label: 'Âge max début', type: 'number' },
    { key: 'ageMaxFin', label: 'Âge max fin', type: 'number' },
    { key: 'montantMax', label: 'Montant max', type: 'currency' },
    { key: 'tauxPrime1', label: 'Taux prime 1', type: 'percentage' },
    { key: 'tauxPrime2', label: 'Taux prime 2', type: 'percentage' },
    { key: 'tauxCommissionSFD', label: 'Commission SFD', type: 'percentage' },
    { key: 'tauxCommissionIG', label: 'Commission IG', type: 'percentage' },
    { key: 'tauxCommissionAssureur', label: 'Commission Assureur', type: 'percentage' },
    { key: 'typeGestionSinistres', label: 'Gestion sinistres', type: 'string' },
    { key: 'dateEffet', label: 'Date d\'effet', type: 'date' },
    { key: 'statut', label: 'Statut', type: 'string' },
  ];
  const filename = `contrats_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(contrats, columns, filename);
};

export const exportFactures = (factures) => {
  const columns = [
    { key: 'reference', label: 'Référence', type: 'string' },
    { key: 'sfd.nom', label: 'SFD', type: 'string' },
    { key: 'periode.trimestre', label: 'Trimestre', type: 'number' },
    { key: 'periode.annee', label: 'Année', type: 'number' },
    { key: 'montants.totalPrimes', label: 'Total primes', type: 'currency' },
    { key: 'montants.commissionIG', label: 'Commission IG', type: 'currency' },
    { key: 'montants.tva', label: 'TVA', type: 'currency' },
    { key: 'montants.totalTTC', label: 'Total TTC', type: 'currency' },
    { key: 'dateGeneration', label: 'Date génération', type: 'date' },
    { key: 'statut', label: 'Statut', type: 'string' },
  ];
  const filename = `factures_${new Date().toISOString().split('T')[0]}`;
  return exportToExcel(factures, columns, filename);
};

// ============================================================
// NOUVELLE FONCTION : EXPORT STATISTIQUES
// ============================================================

export const exportStatistiques = (statistiques, annee, pays) => {
  const columns = [
    { key: 'mois', label: 'Mois', type: 'string' },
    { key: 'nbHommes', label: 'Hommes', type: 'number' },
    { key: 'nbFemmes', label: 'Femmes', type: 'number' },
    { key: 'nbPM', label: 'PM', type: 'number' },
    { key: 'capitalAssure', label: 'Capital assuré', type: 'currency' },
    { key: 'primeTotale', label: 'Prime totale', type: 'currency' },
    { key: 'nbSinistres', label: 'Nb sinistres', type: 'number' },
    { key: 'montantSinistres', label: 'Montant sinistres', type: 'currency' },
    { key: 'commissionGestionIMF', label: 'Commission IMF', type: 'currency' },
    { key: 'montantDuAssureur', label: 'Montant dû assureur', type: 'currency' },
    { key: 'montantPayeSFD', label: 'Montant payé SFD', type: 'currency' },
    { key: 'commissionsFacturees', label: 'Commissions facturées', type: 'currency' },
    { key: 'commissionsEncaissees', label: 'Commissions encaissées', type: 'currency' },
    { key: 'montantPayeAllianz', label: 'Montant payé Allianz', type: 'currency' },
  ];

  // Ajouter une ligne de total
  const totalRow = {
    mois: 'TOTAL',
    nbHommes: statistiques.reduce((sum, s) => sum + (s.nbHommes || 0), 0),
    nbFemmes: statistiques.reduce((sum, s) => sum + (s.nbFemmes || 0), 0),
    nbPM: statistiques.reduce((sum, s) => sum + (s.nbPM || 0), 0),
    capitalAssure: statistiques.reduce((sum, s) => sum + (s.capitalAssure || 0), 0),
    primeTotale: statistiques.reduce((sum, s) => sum + (s.primeTotale || 0), 0),
    nbSinistres: statistiques.reduce((sum, s) => sum + (s.nbSinistres || 0), 0),
    montantSinistres: statistiques.reduce((sum, s) => sum + (s.montantSinistres || 0), 0),
    commissionGestionIMF: statistiques.reduce((sum, s) => sum + (s.commissionGestionIMF || 0), 0),
    montantDuAssureur: statistiques.reduce((sum, s) => sum + (s.montantDuAssureur || 0), 0),
    montantPayeSFD: statistiques.reduce((sum, s) => sum + (s.montantPayeSFD || 0), 0),
    commissionsFacturees: statistiques.reduce((sum, s) => sum + (s.commissionsFacturees || 0), 0),
    commissionsEncaissees: statistiques.reduce((sum, s) => sum + (s.commissionsEncaissees || 0), 0),
    montantPayeAllianz: statistiques.reduce((sum, s) => sum + (s.montantPayeAllianz || 0), 0),
  };

  const exportData = [...statistiques, totalRow];
  const filename = `statistiques_${pays}_${annee}`;
  return exportToExcel(exportData, columns, filename);
};