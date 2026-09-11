// frontend/src/pages/ComptesResultat.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { sfdAPI } from '../api/sfd';

const ComptesResultat = () => {
  const [sfds, setSfds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [formData, setFormData] = useState({
    sfdId: '',
    annee: new Date().getFullYear(),
    typeCloture: 'CIVILE',
  });
  const [historique, setHistorique] = useState([]);
  const [loadingHistorique, setLoadingHistorique] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadSfds();
    loadHistorique();
  }, []);

  const loadSfds = async () => {
    try {
      const response = await sfdAPI.getAll();
      setSfds(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement SFD:', err);
    }
  };

  const loadHistorique = async () => {
    try {
      setLoadingHistorique(true);
      const response = await api.get('/cr');
      setHistorique(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement historique:', err);
    } finally {
      setLoadingHistorique(false);
    }
  };

  const handleGenerer = async (e) => {
    e.preventDefault();

    if (!formData.sfdId) {
      setError('Veuillez sélectionner un SFD');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      setResultat(null);

      const response = await api.post('/cr/generer', formData);
      setResultat(response.data.data);
      setSuccess('✅ Compte de résultat généré avec succès !');
      await loadHistorique();
    } catch (err) {
      console.error('Erreur génération CR:', err);
      setError(err.response?.data?.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!resultat) return;

    try {
      const response = await api.get(
        `/cr/export/${resultat.sfd._id}/${resultat.periode.annee}`,
        {
          params: { typeCloture: resultat.periode.type },
          responseType: 'blob',
        }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CR_${resultat.sfd.code}_${resultat.periode.annee}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('✅ Export réussi !');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur export:', err);
      setError('Erreur lors de l\'export');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const getTypeLabel = (type) => {
    return type === 'ALLIANZ' ? 'Allianz (Oct-Sep)' : 'Année civile';
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📈 Comptes de Résultat</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
          ❌ {error}
          <button onClick={() => setError(null)} className="float-right">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right">✕</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">📤 Générer un compte de résultat</h2>
        <form onSubmit={handleGenerer} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SFD *</label>
            <select
              value={formData.sfdId}
              onChange={(e) => setFormData({ ...formData, sfdId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Sélectionner un SFD</option>
              {sfds.map((sfd) => (
                <option key={sfd._id} value={sfd._id}>{sfd.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Année *</label>
            <select
              value={formData.annee}
              onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de clôture</label>
            <select
              value={formData.typeCloture}
              onChange={(e) => setFormData({ ...formData, typeCloture: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="CIVILE">Année civile</option>
              <option value="ALLIANZ">Allianz (Octobre-Septembre)</option>
            </select>
          </div>
          <div className="md:col-span-3 flex gap-3">
            <button
              type="submit"
              disabled={generating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:bg-blue-400"
            >
              {generating ? 'Génération en cours...' : 'Générer le compte de résultat'}
            </button>
          </div>
        </form>
      </div>

      {resultat && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-800">{resultat.sfd.nom}</h3>
              <p className="text-sm text-gray-500">
                Exercice {resultat.periode.annee} - {getTypeLabel(resultat.periode.type)}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(resultat.periode.debut).toLocaleDateString('fr-FR')} →{' '}
                {new Date(resultat.periode.fin).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <span>📊</span> Exporter Excel
            </button>
          </div>

          <div className="p-4 overflow-x-auto">
            {/* Synthèse */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Total primes</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatCurrency(resultat.credit?.primesCollectees)} FCFA
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Sinistres payés</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(resultat.debit?.sinistresPayes)} FCFA
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Résultat</p>
                <p
                  className={`text-lg font-bold ${
                    resultat.resultat?.resultat >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(resultat.resultat?.resultat)} FCFA
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">PB SFD (80%)</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(resultat.resultat?.pb?.sfd)} FCFA
                </p>
              </div>
            </div>

            {/* 3 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CRÉDIT */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-green-600 mb-3">📥 CRÉDIT</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Primes collectées</span>
                    <span>{formatCurrency(resultat.credit?.primesCollectees)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Reprise PENA</span>
                    <span>{formatCurrency(resultat.credit?.reprises?.pena)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Reprise sinistres non réglés</span>
                    <span>{formatCurrency(resultat.credit?.reprises?.sinistresNonRegles)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Reprise sinistres inconnus</span>
                    <span>{formatCurrency(resultat.credit?.reprises?.sinistresInconnus)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t-2">
                    <span>Total crédit</span>
                    <span className="text-green-600">
                      {formatCurrency(resultat.credit?.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* DÉBIT */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-red-600 mb-3">📤 DÉBIT</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Sinistres payés</span>
                    <span>{formatCurrency(resultat.debit?.sinistresPayes)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Provision sinistres non réglés</span>
                    <span>{formatCurrency(resultat.debit?.provisions?.sinistresNonRegles)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Provision sinistres inconnus</span>
                    <span>{formatCurrency(resultat.debit?.provisions?.sinistresInconnus)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Provision PENA</span>
                    {/* ✅ FIX : chemin correct */}
                    <span>{formatCurrency(resultat.debit?.provisions?.pena)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Commission SFD</span>
                    <span>{formatCurrency(resultat.debit?.commissions?.sfd)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Commission IG</span>
                    <span>{formatCurrency(resultat.debit?.commissions?.ig)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Commission Assureur</span>
                    <span>{formatCurrency(resultat.debit?.commissions?.assureur)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Frais management (27%)</span>
                    <span>{formatCurrency(resultat.debit?.commissions?.fraisManagement)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-600">Frais réassurance (5%)</span>
                    <span>{formatCurrency(resultat.debit?.commissions?.fraisReassurance)}</span>
                  </div>
                  {resultat.debit?.reportANouveau > 0 && (
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-gray-600">Report à nouveau</span>
                      <span>{formatCurrency(resultat.debit?.reportANouveau)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t-2">
                    <span>Total débit</span>
                    <span className="text-red-600">
                      {formatCurrency(resultat.debit?.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* RÉSULTAT */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-700 mb-3">📊 RÉSULTAT</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total crédit</span>
                    <span>{formatCurrency(resultat.credit?.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total débit</span>
                    <span>{formatCurrency(resultat.debit?.total)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t-2">
                    <span>Résultat</span>
                    <span
                      className={
                        resultat.resultat?.resultat >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {formatCurrency(resultat.resultat?.resultat)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">PB SFD (80%)</span>
                    <span className="text-blue-600">
                      {formatCurrency(resultat.resultat?.pb?.sfd)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PB Assureur (20%)</span>
                    <span className="text-purple-600">
                      {formatCurrency(resultat.resultat?.pb?.assureur)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reportings inclus */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-700 text-sm mb-2">
                📋 Reportings inclus ({resultat.reportings?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-2">
                {resultat.reportings?.map((r, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                  >
                    Mois {r.mois}/{r.annee} - {r.nombreAdhesions} adh.
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historique */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">📋 Historique des CR générés</h2>
        </div>
        {loadingHistorique ? (
          <div className="flex items-center justify-center h-32">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : historique.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucun compte de résultat généré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SFD</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Année</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Total primes</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Résultat</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historique.map((cr) => (
                  <tr key={cr._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{cr.sfd?.nom || 'N/A'}</td>
                    <td className="px-3 py-2 text-gray-600">{cr.periode?.annee}</td>
                    <td className="px-3 py-2 text-gray-600">{getTypeLabel(cr.periode?.type)}</td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {formatCurrency(cr.credit?.primesCollectees)}
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-medium ${
                        cr.resultat?.resultat >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(cr.resultat?.resultat)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {cr.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {new Date(cr.dateGeneration).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComptesResultat;