// backend/src/services/crService.js
const mongoose = require('mongoose');
const CompteResultat = require('../models/CompteResultat');
const ReportingMensuel = require('../models/ReportingMensuel');
const Sinistre = require('../models/Sinistre');
const Adhesion = require('../models/Adhesion');
const SFD = require('../models/SFD');
const Contrat = require('../models/Contrat');

// ============================================================
// CONSTANTES
// ============================================================

const TYPES_CLOTURE = {
  CIVILE: 'CIVILE',
  ALLIANZ: 'ALLIANZ',
};

/**
 * Détermine les dates de période selon le type de clôture
 * @param {Number} annee - Année de référence
 * @param {String} type - 'CIVILE' ou 'ALLIANZ'
 * @returns {{ debut: Date, fin: Date }}
 */
const determinerPeriode = (annee, type) => {
  if (type === TYPES_CLOTURE.ALLIANZ) {
    // Allianz : 01/10/N-1 → 30/09/N
    return {
      debut: new Date(annee - 1, 9, 1), // 1er Octobre N-1
      fin: new Date(annee, 9, 0), // 30 Septembre N (dernier jour du mois 9 = Septembre)
    };
  }
  // CIVILE : 01/01/N → 31/12/N
  return {
    debut: new Date(annee, 0, 1),
    fin: new Date(annee, 11, 31, 23, 59, 59, 999),
  };
};

/**
 * Génère la référence unique du CR
 */
const genererReferenceCR = (sfdCode, annee, type) => {
  return `CR-${sfdCode}-${annee}-${type}`;
};

/**
 * Calcule les mois concernés par la période (retourne un array de {mois, annee})
 */
const getMoisPeriode = (debut, fin) => {
  const mois = [];
  const current = new Date(debut.getFullYear(), debut.getMonth(), 1);
  const last = new Date(fin.getFullYear(), fin.getMonth(), 1);

  while (current <= last) {
    mois.push({
      mois: current.getMonth() + 1,
      annee: current.getFullYear(),
    });
    current.setMonth(current.getMonth() + 1);
  }
  return mois;
};

/**
 * Calcule la part de prime "impactée au-delà de N"
 * Pour une adhésion donnée, retourne la portion de la prime correspondant
 * à la période postérieure à la fin de l'exercice N
 */
const calculerPrimeImpacteeAuDela = (adhesion, finExercice) => {
  const { datePret, dateFinPret, prime } = adhesion;

  if (!datePret || !dateFinPret || !prime || prime <= 0) return 0;

  const debutPret = new Date(datePret).getTime();
  const finPret = new Date(dateFinPret).getTime();
  const finN = new Date(finExercice).getTime();

  // Si le prêt se termine avant la fin de l'exercice → rien au-delà
  if (finPret <= finN) return 0;

  // Si le prêt commence après la fin de l'exercice → tout au-delà
  if (debutPret >= finN) return prime;

  // Sinon, calcul au prorata
  const dureeTotale = finPret - debutPret;
  const dureeAuDela = finPret - finN;

  if (dureeTotale <= 0) return 0;

  const ratio = dureeAuDela / dureeTotale;
  return prime * ratio;
};

// ============================================================
// CALCUL COMPLET DU CR
// ============================================================

/**
 * Calcule les données du compte de résultat pour un SFD/année/type
 * @param {Object} params
 * @param {String} params.sfdId
 * @param {Number} params.annee
 * @param {String} params.typeCloture - 'CIVILE' ou 'ALLIANZ'
 * @returns {Object} Les données calculées (non persistées)
 */
const calculerCR = async ({ sfdId, annee, typeCloture }) => {
  // --- 1. Récupérer le SFD ---
  const sfd = await SFD.findById(sfdId);
  if (!sfd) {
    throw new Error('SFD non trouvé');
  }

  // --- 2. Récupérer le contrat actif ---
  const contrat = await Contrat.findOne({ sfdId, statut: 'ACTIF' }).populate(
    'assureurId',
    'nom code'
  );
  if (!contrat) {
    throw new Error('Aucun contrat actif trouvé pour ce SFD');
  }

  // --- 3. Déterminer la période ---
  const { debut: dateDebut, fin: dateFin } = determinerPeriode(annee, typeCloture);
  const moisPeriode = getMoisPeriode(dateDebut, dateFin);

  // --- 4. Récupérer les reportings clôturés de la période ---
  const moisArray = moisPeriode.map((m) => m.mois);
  const anneesArray = [...new Set(moisPeriode.map((m) => m.annee))];

  const reportings = await ReportingMensuel.find({
    sfdId,
    annee: { $in: anneesArray },
    mois: { $in: moisArray },
    statut: 'CLOTURE',
  });

  // Filtrer les reportings qui sont réellement dans la période
  const reportingsFiltres = reportings.filter((r) => {
    const date = new Date(r.annee, r.mois - 1, 1);
    return date >= dateDebut && date <= dateFin;
  });

  if (reportingsFiltres.length === 0) {
    throw new Error('Aucun reporting clôturé trouvé pour cette période');
  }

  // --- 5. Calculer le total des primes collectées ---
  let totalPrimes = 0;
  reportingsFiltres.forEach((r) => {
    totalPrimes += r.totalPrime || 0;
  });

  // --- 6. Récupérer tous les sinistres de la période ---
  const sinistres = await Sinistre.find({
    sfdId,
    dateSinistre: { $gte: dateDebut, $lte: dateFin },
  });

  const sinistresPayes = sinistres.filter((s) => s.statut === 'PAYE');
  const sinistresValides = sinistres.filter((s) => s.statut === 'VALIDE');
  const sinistresEnAttente = sinistres.filter((s) => s.statut === 'A_VERIFIER');

  const totalSinistresPayes = sinistresPayes.reduce(
    (sum, s) => sum + (s.montantSinistre || 0),
    0
  );

  // --- 7. Récupérer les adhésions de la période pour le calcul PENA ---
  const reportingsIds = reportingsFiltres.map((r) => r._id);
  const adhesions = await Adhesion.find({
    reportingMensuelId: { $in: reportingsIds },
    estExclue: false,
  });

  // --- 8. Calcul des provisions ---
  const TAUX_MANAGEMENT = contrat.tauxManagement || 0.27;

  // 8.1 Provision pour sinistres inconnus = 1/12 des sinistres payés
  const provisionSinistresInconnus = totalSinistresPayes / 12;

  // 8.2 Provision pour sinistres non réglés = total des sinistres validés non payés + en attente (hors refusés)
  const sinistresNonRegles = [...sinistresValides, ...sinistresEnAttente];
  const provisionSinistresNonRegles = sinistresNonRegles.reduce(
    (sum, s) => sum + (s.montantSinistre || 0),
    0
  );

  // 8.3 Provision PENA = (1 - 0.27) × primes impactées au-delà de N
  let primesImpacteesAuDela = 0;
  adhesions.forEach((adh) => {
    primesImpacteesAuDela += calculerPrimeImpacteeAuDela(adh, dateFin);
  });
  const provisionPENA = (1 - TAUX_MANAGEMENT) * primesImpacteesAuDela;

  // --- 9. Récupérer le CR N-1 pour les reprises et le report à nouveau ---
  const crPrecedent = await CompteResultat.findOne({
    'sfd._id': sfdId,
    'periode.annee': annee - 1,
    'periode.type': typeCloture,
    statut: { $in: ['VALIDE', 'ENVOYE_SFD'] },
  });

  let reprisesPENA = 0;
  let reprisesSinistresNonRegles = 0;
  let reprisesSinistresInconnus = 0;
  let reportANouveau = 0;

  if (crPrecedent) {
    reprisesPENA = crPrecedent.debit.provisions.pena || 0;
    reprisesSinistresNonRegles =
      crPrecedent.debit.provisions.sinistresNonRegles || 0;
    reprisesSinistresInconnus =
      crPrecedent.debit.provisions.sinistresInconnus || 0;

    // Report à nouveau : si CR N-1 < 0, on reporte le déficit
    if (crPrecedent.resultat.resultat < 0) {
      reportANouveau = Math.abs(crPrecedent.resultat.resultat);
    }
  }

  // --- 10. Calcul des commissions et frais ---
  const commissionSFD = totalPrimes * (contrat.tauxCommissionSFD || 0.07);
  const commissionIG = totalPrimes * (contrat.tauxCommissionIG || 0.15);
  const commissionAssureur = totalPrimes * (contrat.tauxCommissionAssureur || 0.05);
  const fraisManagement = totalPrimes * TAUX_MANAGEMENT;
  const fraisReassurance = totalPrimes * (contrat.tauxReassurance || 0.05);

  // --- 11. CRÉDIT ---
  const totalReprises =
    reprisesPENA + reprisesSinistresNonRegles + reprisesSinistresInconnus;
  const totalCredit = totalPrimes + totalReprises;

  // --- 12. DÉBIT ---
  const totalDebit =
    totalSinistresPayes +
    provisionSinistresNonRegles +
    provisionSinistresInconnus +
    provisionPENA +
    commissionSFD +
    commissionIG +
    commissionAssureur +
    fraisManagement +
    fraisReassurance +
    reportANouveau;

  // --- 13. RÉSULTAT ---
  const resultat = totalCredit - totalDebit;

  const pourcentagePB_SFD = contrat.pourcentagePB_SFD || 0.80;
  const pourcentagePB_Assureur = contrat.pourcentagePB_Assureur || 0.20;

  const pbSFD = resultat * pourcentagePB_SFD;
  const pbAssureur = resultat * pourcentagePB_Assureur;

  // --- 14. Retour ---
  return {
    sfd: {
      _id: sfd._id,
      nom: sfd.nom,
      code: sfd.code,
    },
    contrat: {
      _id: contrat._id,
      nom: contrat.nom,
      code: contrat.code,
      assureurId: contrat.assureurId?._id,
      assureurNom: contrat.assureurId?.nom || '',
    },
    periode: {
      annee,
      type: typeCloture,
      debut: dateDebut,
      fin: dateFin,
    },
    taux: {
      commissionSFD: contrat.tauxCommissionSFD || 0.07,
      commissionIG: contrat.tauxCommissionIG || 0.15,
      commissionAssureur: contrat.tauxCommissionAssureur || 0.05,
      fraisManagement: TAUX_MANAGEMENT,
      fraisReassurance: contrat.tauxReassurance || 0.05,
      pourcentagePB_SFD,
      pourcentagePB_Assureur,
    },
    credit: {
      primesCollectees: totalPrimes,
      reprises: {
        pena: reprisesPENA,
        sinistresNonRegles: reprisesSinistresNonRegles,
        sinistresInconnus: reprisesSinistresInconnus,
      },
      total: totalCredit,
    },
    debit: {
      sinistresPayes: totalSinistresPayes,
      provisions: {
        sinistresNonRegles: provisionSinistresNonRegles,
        sinistresInconnus: provisionSinistresInconnus,
        pena: provisionPENA,
        primesImpacteesNPlus: primesImpacteesAuDela,
      },
      commissions: {
        sfd: commissionSFD,
        ig: commissionIG,
        assureur: commissionAssureur,
        fraisManagement,
        fraisReassurance,
      },
      reportANouveau,
      total: totalDebit,
    },
    resultat: {
      totalCredit,
      totalDebit,
      resultat,
      pb: {
        sfd: pbSFD,
        assureur: pbAssureur,
      },
    },
    reportings: reportingsFiltres.map((r) => ({
      _id: r._id,
      mois: r.mois,
      annee: r.annee,
      totalPrime: r.totalPrime || 0,
      nombreAdhesions: r.nombreAdhesions || 0,
    })),
    sinistres: sinistres.map((s) => s._id),
    crPrecedentId: crPrecedent ? crPrecedent._id : null,
    // Métadonnées utiles pour le diagnostic
    meta: {
      nbReportings: reportingsFiltres.length,
      nbSinistres: sinistres.length,
      nbSinistresPayes: sinistresPayes.length,
      nbSinistresValides: sinistresValides.length,
      nbSinistresEnAttente: sinistresEnAttente.length,
      nbAdhesions: adhesions.length,
      crPrecedentExiste: !!crPrecedent,
    },
  };
};

// ============================================================
// PERSISTANCE
// ============================================================

/**
 * Génère et persiste un CR (ou retourne l'existant en mode dry-run)
 * @param {Object} params - { sfdId, annee, typeCloture, userId, dryRun }
 * @returns {Object} Le CR persisté (ou calculé)
 */
const genererEtPersister = async ({
  sfdId,
  annee,
  typeCloture,
  userId,
  dryRun = false,
}) => {
  const donnees = await calculerCR({ sfdId, annee, typeCloture });

  if (dryRun) {
    return donnees;
  }

  const reference = genererReferenceCR(
    donnees.sfd.code,
    annee,
    typeCloture
  );

  // Vérifier si un CR existe déjà
  let cr = await CompteResultat.findOne({ reference });

  if (cr) {
    // Mettre à jour (recalcul)
    if (cr.statut === 'VALIDE' || cr.statut === 'ENVOYE_SFD') {
      throw new Error(
        `Un CR validé existe déjà pour ${donnees.sfd.nom} - ${annee} (${typeCloture}). Il ne peut pas être recalculé.`
      );
    }

    Object.assign(cr, {
      ...donnees,
      modifiePar: userId,
    });
    await cr.save();
  } else {
    cr = await CompteResultat.create({
      reference,
      ...donnees,
      statut: 'BROUILLON',
      dateGeneration: new Date(),
      creePar: userId,
    });
  }

  return cr;
};

module.exports = {
  TYPES_CLOTURE,
  determinerPeriode,
  genererReferenceCR,
  getMoisPeriode,
  calculerPrimeImpacteeAuDela,
  calculerCR,
  genererEtPersister,
};