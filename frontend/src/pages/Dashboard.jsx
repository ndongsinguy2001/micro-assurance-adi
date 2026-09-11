// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../api/dashboard';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getIndicateurs();
      setStats(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement stats:', err);
      setError('Impossible de charger les statistiques');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  const cards = [
    { title: 'SFD Actifs', value: stats?.sfd?.actifs || 0, icon: '🏦', color: 'blue' },
    { title: 'Reportings en cours', value: stats?.reportings?.enCours || 0, icon: '📋', color: 'yellow' },
    { title: 'Sinistres en attente', value: stats?.sinistres?.enAttente || 0, icon: '🚨', color: 'red' },
    { title: 'Contrats actifs', value: stats?.contrats?.actifs || 0, icon: '📄', color: 'green' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📊 Tableau de bord</h1>

      {/* Cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`bg-white rounded-lg shadow p-6 border-l-4 border-${card.color}-500`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              </div>
              <span className="text-3xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Informations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">📈 Activité récente</h2>
          <p className="text-gray-500 text-sm">Les données seront affichées ici prochainement.</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">🔔 Alertes</h2>
          <p className="text-gray-500 text-sm">Aucune alerte pour le moment.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;