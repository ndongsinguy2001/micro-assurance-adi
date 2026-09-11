// frontend/src/pages/Statistiques.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { exportStatistiques } from '../services/exportService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Statistiques = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear());
  const [filterPays, setFilterPays] = useState('Sénégal');

  // Options de chart
  const colors = {
    blue: 'rgba(54, 162, 235, 0.8)',
    green: 'rgba(75, 192, 192, 0.8)',
    red: 'rgba(255, 99, 132, 0.8)',
    orange: 'rgba(255, 159, 64, 0.8)',
    purple: 'rgba(153, 102, 255, 0.8)',
    yellow: 'rgba(255, 206, 86, 0.8)',
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadData();
  }, [filterAnnee, filterPays]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/statistiques/agregat', {
        params: { annee: filterAnnee, pays: filterPays },
      });

      setStatsData(response.data.data);
    } catch (err) {
      console.error('Erreur chargement statistiques:', err);
      setError('Impossible de charger les statistiques');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!statsData || !statsData.moisLabels || statsData.moisLabels.length === 0) {
      setError('Aucune donnée à exporter');
      return;
    }

    // Construire les données pour l'export
    const exportData = statsData.moisLabels.map((label, index) => ({
      mois: index + 1,
      nbHommes: statsData.moisData.nbHommes[index] || 0,
      nbFemmes: statsData.moisData.nbFemmes[index] || 0,
      nbPM: statsData.moisData.nbPM[index] || 0,
      capitalAssure: statsData.moisData.capitalAssure[index] || 0,
      primeTotale: statsData.moisData.primeTotale[index] || 0,
      nbSinistres: statsData.moisData.nbSinistres[index] || 0,
      montantSinistres: statsData.moisData.montantSinistres[index] || 0,
      commissionGestionIMF: statsData.moisData.commissionGestionIMF[index] || 0,
      montantDuAssureur: statsData.moisData.montantDuAssureur[index] || 0,
      montantPayeSFD: statsData.moisData.montantPayeSFD[index] || 0,
      commissionsFacturees: statsData.moisData.commissionsFacturees[index] || 0,
      commissionsEncaissees: statsData.moisData.commissionsEncaissees[index] || 0,
      montantPayeAllianz: statsData.moisData.montantPayeAllianz[index] || 0,
    }));

    const success = exportStatistiques(exportData, filterAnnee, filterPays);
    if (success) {
      setSuccess('✅ Export Excel réussi !');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError('Erreur lors de l\'export');
    }
  };

  // Préparer les données pour les graphiques
  const getChartData = (label, data, color, labelText) => ({
    labels: statsData?.moisLabels || [],
    datasets: [
      {
        label: labelText || label,
        data: data || [],
        backgroundColor: color || colors.blue,
        borderColor: color || colors.blue,
        borderWidth: 2,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return value;
          },
        },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-500">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  const total = statsData?.total || {};
  const moisData = statsData?.moisData || {};
  const moisLabels = statsData?.moisLabels || [];

  // KPI Cards
  const kpis = [
    { label: 'Total Hommes', value: total.nbHommes || 0, icon: '👨', color: 'blue' },
    { label: 'Total Femmes', value: total.nbFemmes || 0, icon: '👩', color: 'pink' },
    { label: 'Total PM', value: total.nbPM || 0, icon: '📊', color: 'purple' },
    { label: 'Capital assuré', value: total.capitalAssure || 0, icon: '💰', color: 'green', currency: true },
    { label: 'Prime totale', value: total.primeTotale || 0, icon: '💳', color: 'orange', currency: true },
    { label: 'Nb sinistres', value: total.nbSinistres || 0, icon: '🚨', color: 'red' },
    { label: 'Montant sinistres', value: total.montantSinistres || 0, icon: '💸', color: 'red', currency: true },
    { label: 'Commission IMF', value: total.commissionGestionIMF || 0, icon: '🏦', color: 'teal', currency: true },
  ];

  // Données pour le graphique des primes
  const primeChartData = {
    labels: moisLabels,
    datasets: [
      {
        label: 'Prime totale',
        data: moisData.primeTotale || [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
      },
    ],
  };

  // Données pour le graphique des sinistres
  const sinistreChartData = {
    labels: moisLabels,
    datasets: [
      {
        label: 'Montant sinistres',
        data: moisData.montantSinistres || [],
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        tension: 0.3,
      },
    ],
  };

  // Données pour le graphique hommes/femmes
  const genreChartData = {
    labels: moisLabels,
    datasets: [
      {
        label: 'Hommes',
        data: moisData.nbHommes || [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'Femmes',
        data: moisData.nbFemmes || [],
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Données pour le pie chart des commissions
  const pieData = {
    labels: ['Commission IMF', 'Commission IG', 'Commission Assureur'],
    datasets: [
      {
        data: [
          total.commissionGestionIMF || 0,
          total.commissionsFacturees || 0,
          total.commissionsEncaissees || 0,
        ],
        backgroundColor: ['rgba(75, 192, 192, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 Statistiques</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <span>📊</span> Exporter Excel
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="text-sm text-gray-600 block mb-1">Année</label>
          <select
            value={filterAnnee}
            onChange={(e) => setFilterAnnee(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Pays</label>
          <select
            value={filterPays}
            onChange={(e) => setFilterPays(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="Sénégal">Sénégal</option>
            <option value="Mali">Mali</option>
            <option value="Côte d'Ivoire">Côte d'Ivoire</option>
            <option value="Burkina Faso">Burkina Faso</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={loadData}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
          >
            Actualiser
          </button>
        </div>
        {statsData && statsData.moisLabels && statsData.moisLabels.length > 0 && (
          <div className="flex items-end ml-auto text-sm text-gray-500">
            <span>{statsData.moisLabels.length} mois affichés</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className={`bg-white rounded-lg shadow p-4 border-l-4 border-${kpi.color}-500`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-lg font-bold text-gray-800">
                  {kpi.currency
                    ? new Intl.NumberFormat('fr-FR').format(kpi.value) + ' FCFA'
                    : new Intl.NumberFormat('fr-FR').format(kpi.value)}
                </p>
              </div>
              <span className="text-2xl">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Prime totale */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-4">💰 Prime totale par mois</h2>
          {moisLabels.length > 0 ? (
            <Bar data={primeChartData} options={chartOptions} height={250} />
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée</p>
          )}
        </div>

        {/* Montant sinistres */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-4">🚨 Montant des sinistres</h2>
          {moisLabels.length > 0 ? (
            <Line data={sinistreChartData} options={chartOptions} height={250} />
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée</p>
          )}
        </div>

        {/* Répartition Hommes/Femmes */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-4">👥 Évolution Hommes / Femmes</h2>
          {moisLabels.length > 0 ? (
            <Bar data={genreChartData} options={chartOptions} height={250} />
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée</p>
          )}
        </div>

        {/* Commissions */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-4">📊 Répartition des commissions</h2>
          {total.commissionGestionIMF || total.commissionsFacturees || total.commissionsEncaissees ? (
            <Pie data={pieData} options={pieOptions} height={250} />
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">📋 Tableau récapitulatif</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mois</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Hommes</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Femmes</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">PM</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Capital assuré</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Prime totale</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Nb sinistres</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Montant sinistres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {moisLabels.map((label, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{label}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{moisData.nbHommes?.[index] || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{moisData.nbFemmes?.[index] || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{moisData.nbPM?.[index] || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {new Intl.NumberFormat('fr-FR').format(moisData.capitalAssure?.[index] || 0)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {new Intl.NumberFormat('fr-FR').format(moisData.primeTotale?.[index] || 0)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">{moisData.nbSinistres?.[index] || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {new Intl.NumberFormat('fr-FR').format(moisData.montantSinistres?.[index] || 0)}
                  </td>
                </tr>
              ))}
              {moisLabels.length > 0 && (
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-gray-800">TOTAL</td>
                  <td className="px-3 py-2 text-center text-gray-800">{total.nbHommes || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-800">{total.nbFemmes || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-800">{total.nbPM || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-800">
                    {new Intl.NumberFormat('fr-FR').format(total.capitalAssure || 0)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-800">
                    {new Intl.NumberFormat('fr-FR').format(total.primeTotale || 0)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-800">{total.nbSinistres || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-800">
                    {new Intl.NumberFormat('fr-FR').format(total.montantSinistres || 0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {moisLabels.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">📊</p>
            <p>Aucune donnée disponible pour {filterPays} en {filterAnnee}</p>
            <p className="text-sm">Importez des statistiques pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Statistiques;