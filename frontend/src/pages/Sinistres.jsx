// frontend/src/pages/Sinistres.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { sfdAPI } from '../api/sfd';
import { exportSinistres } from '../services/exportService';

const Sinistres = () => {
  const [sinistres, setSinistres] = useState([]);
  const [sfds, setSfds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState({ statut: '', sfdId: '', type: '', dateDebut: '', dateFin: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSinistre, setNewSinistre] = useState({ adhesionId: '', dateSinistre: '', typeSinistre: 'DECES', description: '', montantPret: '', capitalRestantDu: '', capitalRembourse: '' });
  const [adhesions, setAdhesions] = useState([]);
  const [loadingAdhesions, setLoadingAdhesions] = useState(false);
  const [selectedSFDForAdhesion, setSelectedSFDForAdhesion] = useState('');
  const [selectedSinistre, setSelectedSinistre] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [stats, setStats] = useState({ total: 0, aVerifier: 0, valides: 0, refuses: 0, payes: 0, totalMontant: 0 });

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filter.statut) params.statut = filter.statut;
      if (filter.sfdId) params.sfdId = filter.sfdId;
      if (filter.type) params.type = filter.type;
      if (filter.dateDebut) params.dateDebut = filter.dateDebut;
      if (filter.dateFin) params.dateFin = filter.dateFin;
      
      const sinistresRes = await api.get('/sinistres', { params });
      const data = sinistresRes.data.data || [];
      setSinistres(data);
      
      const statsCalc = {
        total: data.length,
        aVerifier: data.filter(s => s.statut === 'A_VERIFIER').length,
        valides: data.filter(s => s.statut === 'VALIDE').length,
        refuses: data.filter(s => s.statut === 'REFUSE').length,
        payes: data.filter(s => s.statut === 'PAYE').length,
        totalMontant: data.reduce((sum, s) => sum + (s.montantSinistre || 0), 0)
      };
      setStats(statsCalc);
      
      const sfdsRes = await sfdAPI.getAll();
      setSfds(sfdsRes.data.data || []);
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const loadAdhesionsForSFD = async (sfdId) => {
    if (!sfdId) { setAdhesions([]); return; }
    setLoadingAdhesions(true);
    setError(null);
    try {
      const reportingsRes = await api.get('/reporting', { params: { sfdId, limit: 100 } });
      const reportings = reportingsRes.data.data || [];
      let allAdhesions = [];
      for (const reporting of reportings) {
        try {
          const adhRes = await api.get(`/reporting/${reporting._id}/adhesions`, { params: { exclude: 'false', limit: 1000 } });
          const adhesionsData = adhRes.data.data || [];
          adhesionsData.forEach(adh => { allAdhesions.push({ ...adh, reportingInfo: `${reporting.mois}/${reporting.annee}` }); });
        } catch (err) { console.error(`Erreur chargement adhésions du reporting ${reporting._id}:`, err); }
      }
      setAdhesions(allAdhesions);
      if (allAdhesions.length === 0) setError('Aucune adhésion valide trouvée pour ce SFD.');
    } catch (err) {
      console.error('Erreur chargement adhésions:', err);
      setError('Impossible de charger les adhésions');
      setAdhesions([]);
    } finally {
      setLoadingAdhesions(false);
    }
  };

  const handleCreateSinistre = async (e) => {
    e.preventDefault();
    if (!newSinistre.adhesionId) { setError('Veuillez sélectionner une adhésion'); return; }
    try {
      await api.post('/sinistres', { ...newSinistre, montantPret: parseFloat(newSinistre.montantPret), capitalRestantDu: parseFloat(newSinistre.capitalRestantDu), capitalRembourse: parseFloat(newSinistre.capitalRembourse) || 0 });
      setSuccess('✅ Sinistre déclaré avec succès !');
      setShowCreateModal(false);
      setNewSinistre({ adhesionId: '', dateSinistre: '', typeSinistre: 'DECES', description: '', montantPret: '', capitalRestantDu: '', capitalRembourse: '' });
      setSelectedSFDForAdhesion('');
      setAdhesions([]);
      await loadData();
    } catch (err) {
      console.error('Erreur création:', err);
      setError(err.response?.data?.message || 'Erreur lors de la déclaration');
    }
  };

  const handleValider = async (id) => {
    if (!window.confirm('Voulez-vous vraiment valider ce sinistre ?')) return;
    try {
      await api.put(`/sinistres/${id}/valider`, { commentaire: 'Sinistre validé après vérification' });
      setSuccess('✅ Sinistre validé avec succès');
      await loadData();
    } catch (err) {
      console.error('Erreur validation:', err);
      setError(err.response?.data?.message || 'Erreur lors de la validation');
    }
  };

  const handleRefuser = async (id) => {
    const commentaire = prompt('Motif du refus :');
    if (commentaire === null) return;
    if (!commentaire.trim()) { setError('Un motif est requis pour refuser un sinistre'); return; }
    try {
      await api.put(`/sinistres/${id}/refuser`, { commentaire });
      setSuccess('❌ Sinistre refusé');
      await loadData();
    } catch (err) {
      console.error('Erreur refus:', err);
      setError(err.response?.data?.message || 'Erreur lors du refus');
    }
  };

  const handlePayer = async (id) => {
    if (!window.confirm('Confirmer le paiement de ce sinistre ?')) return;
    try {
      await api.put(`/sinistres/${id}/payer`, { commentaire: 'Sinistre payé' });
      setSuccess('💰 Sinistre marqué comme payé');
      await loadData();
    } catch (err) {
      console.error('Erreur paiement:', err);
      setError(err.response?.data?.message || 'Erreur lors du paiement');
    }
  };

  const openDetails = async (sinistre) => {
    try {
      const response = await api.get(`/sinistres/${sinistre._id}`);
      setSelectedSinistre(response.data.data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Erreur:', err);
      setError('Impossible de charger les détails');
    }
  };

  const handleAddJustificatif = async (id, file) => {
    if (!file) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/sinistres/${id}/justificatifs`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('✅ Justificatif ajouté avec succès');
      const response = await api.get(`/sinistres/${id}`);
      setSelectedSinistre(response.data.data);
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors de l\'ajout du justificatif');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleExport = () => {
    if (sinistres.length === 0) { setError('Aucune donnée à exporter'); return; }
    const success = exportSinistres(sinistres);
    if (success) { setSuccess('✅ Export Excel réussi !'); setTimeout(() => setSuccess(null), 3000); } 
    else { setError('Erreur lors de l\'export'); }
  };

  const resetFilters = () => { setFilter({ statut: '', sfdId: '', type: '', dateDebut: '', dateFin: '' }); };

  const getStatusColor = (statut) => {
    const colors = { 'A_VERIFIER': 'bg-yellow-100 text-yellow-600', 'VALIDE': 'bg-blue-100 text-blue-600', 'REFUSE': 'bg-red-100 text-red-600', 'PAYE': 'bg-green-100 text-green-600' };
    return colors[statut] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (statut) => {
    const labels = { 'A_VERIFIER': 'À vérifier', 'VALIDE': 'Validé', 'REFUSE': 'Refusé', 'PAYE': 'Payé' };
    return labels[statut] || statut;
  };

  const getTypeLabel = (type) => {
    const labels = { 'DECES': 'Décès', 'INVALIDITE': 'Invalidité', 'AUTRE': 'Autre' };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🚨 Gestion des Sinistres</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>📊</span> Exporter Excel
          </button>
          <button onClick={() => setShowCreateModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>➕</span> Déclarer
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">❌ {error}<button onClick={() => setError(null)} className="float-right">✕</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}<button onClick={() => setSuccess(null)} className="float-right">✕</button></div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-gray-400"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold text-gray-800">{stats.total}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-yellow-500"><p className="text-xs text-gray-500">À vérifier</p><p className="text-xl font-bold text-yellow-600">{stats.aVerifier}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500"><p className="text-xs text-gray-500">Validés</p><p className="text-xl font-bold text-blue-600">{stats.valides}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-red-500"><p className="text-xs text-gray-500">Refusés</p><p className="text-xl font-bold text-red-600">{stats.refuses}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500"><p className="text-xs text-gray-500">Payés</p><p className="text-xl font-bold text-green-600">{stats.payes}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500"><p className="text-xs text-gray-500">Montant total</p><p className="text-sm font-bold text-purple-600 truncate">{new Intl.NumberFormat('fr-FR').format(stats.totalMontant)} FCFA</p></div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div><label className="text-sm text-gray-600 block mb-1">Statut</label><select value={filter.statut} onChange={(e) => setFilter({ ...filter, statut: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="A_VERIFIER">À vérifier</option><option value="VALIDE">Validé</option><option value="REFUSE">Refusé</option><option value="PAYE">Payé</option></select></div>
        <div><label className="text-sm text-gray-600 block mb-1">SFD</label><select value={filter.sfdId} onChange={(e) => setFilter({ ...filter, sfdId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div>
        <div><label className="text-sm text-gray-600 block mb-1">Type</label><select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="DECES">Décès</option><option value="INVALIDITE">Invalidité</option><option value="AUTRE">Autre</option></select></div>
        <div><label className="text-sm text-gray-600 block mb-1">Date début</label><input type="date" value={filter.dateDebut} onChange={(e) => setFilter({ ...filter, dateDebut: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div>
        <div><label className="text-sm text-gray-600 block mb-1">Date fin</label><input type="date" value={filter.dateFin} onChange={(e) => setFilter({ ...filter, dateFin: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div>
        <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Réinitialiser</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><div className="text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div><p className="mt-2 text-sm text-gray-500">Chargement...</p></div></div>
        : sinistres.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">✅</p><p>Aucun sinistre trouvé</p><p className="text-sm">Aucun sinistre déclaré pour le moment</p></div>
        : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SFD</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emprunteur</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Montant</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{sinistres.map((sinistre) => (<tr key={sinistre._id} className="hover:bg-gray-50 transition"><td className="px-4 py-3 text-sm font-medium text-gray-800">{sinistre.sfdId?.nom || 'N/A'}</td><td className="px-4 py-3 text-sm text-gray-600">{sinistre.adhesionId?.nomEmprunteur || 'N/A'}</td><td className="px-4 py-3 text-sm text-gray-600"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{getTypeLabel(sinistre.typeSinistre)}</span></td><td className="px-4 py-3 text-sm text-center text-gray-600">{new Intl.NumberFormat('fr-FR').format(sinistre.montantSinistre || 0)}</td><td className="px-4 py-3 text-sm text-center text-gray-600">{new Date(sinistre.dateSinistre).toLocaleDateString('fr-FR')}</td><td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sinistre.statut)}`}>{getStatusLabel(sinistre.statut)}</span></td><td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1 flex-wrap"><button onClick={() => openDetails(sinistre)} className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded" title="Voir détails">👁️</button>{sinistre.statut === 'A_VERIFIER' && <><button onClick={() => handleValider(sinistre._id)} className="text-green-600 hover:text-green-800 text-sm p-1 hover:bg-green-50 rounded" title="Valider">✅</button><button onClick={() => handleRefuser(sinistre._id)} className="text-red-600 hover:text-red-800 text-sm p-1 hover:bg-red-50 rounded" title="Refuser">❌</button></>}{sinistre.statut === 'VALIDE' && <button onClick={() => handlePayer(sinistre._id)} className="text-purple-600 hover:text-purple-800 text-sm p-1 hover:bg-purple-50 rounded" title="Marquer comme payé">💰</button>}</div></td></tr>))}</tbody></table></div>}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-bold text-gray-800">➕ Déclarer un sinistre</h2><button onClick={() => { setShowCreateModal(false); setAdhesions([]); setSelectedSFDForAdhesion(''); }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <form onSubmit={handleCreateSinistre} className="flex-1 overflow-y-auto p-4">
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">SFD *</label><select value={selectedSFDForAdhesion} onChange={(e) => { setSelectedSFDForAdhesion(e.target.value); loadAdhesionsForSFD(e.target.value); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required><option value="">Sélectionner un SFD</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Adhésion *</label><select value={newSinistre.adhesionId} onChange={(e) => { const adh = adhesions.find(a => a._id === e.target.value); setNewSinistre({ ...newSinistre, adhesionId: e.target.value, montantPret: adh?.montantPret || '', capitalRestantDu: adh?.montantPret || '' }); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required disabled={loadingAdhesions || !selectedSFDForAdhesion}><option value="">{loadingAdhesions ? 'Chargement...' : !selectedSFDForAdhesion ? 'Sélectionnez d\'abord un SFD' : adhesions.length === 0 ? 'Aucune adhésion trouvée' : 'Sélectionner une adhésion'}</option>{!loadingAdhesions && adhesions.map((adh) => (<option key={adh._id} value={adh._id}>{adh.nomEmprunteur} {adh.prenomEmprunteur || ''} - {new Intl.NumberFormat('fr-FR').format(adh.montantPret || 0)} FCFA {adh.reportingInfo ? `(${adh.reportingInfo})` : ''}</option>))}</select>{selectedSFDForAdhesion && !loadingAdhesions && adhesions.length === 0 && <p className="text-xs text-yellow-600 mt-1">⚠️ Aucune adhésion trouvée.</p>}{loadingAdhesions && <p className="text-xs text-blue-600 mt-1">⏳ Chargement...</p>}</div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select value={newSinistre.typeSinistre} onChange={(e) => setNewSinistre({ ...newSinistre, typeSinistre: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required><option value="DECES">Décès</option><option value="INVALIDITE">Invalidité</option><option value="AUTRE">Autre</option></select></div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Date sinistre *</label><input type="date" value={newSinistre.dateSinistre} onChange={(e) => setNewSinistre({ ...newSinistre, dateSinistre: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Montant prêt *</label><input type="number" value={newSinistre.montantPret} onChange={(e) => setNewSinistre({ ...newSinistre, montantPret: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Capital restant dû *</label><input type="number" value={newSinistre.capitalRestantDu} onChange={(e) => setNewSinistre({ ...newSinistre, capitalRestantDu: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Capital remboursé</label><input type="number" value={newSinistre.capitalRembourse} onChange={(e) => setNewSinistre({ ...newSinistre, capitalRembourse: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newSinistre.description} onChange={(e) => setNewSinistre({ ...newSinistre, description: e.target.value })} rows="3" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Détails..." /></div>
              <div className="flex gap-3"><button type="button" onClick={() => { setShowCreateModal(false); setAdhesions([]); setSelectedSFDForAdhesion(''); }} className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Annuler</button><button type="submit" className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition">Déclarer</button></div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedSinistre && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-bold text-gray-800">📄 Détails du sinistre</h2><button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-4"><div><p className="text-xs text-gray-500">Emprunteur</p><p className="font-medium">{selectedSinistre.adhesionId?.nomEmprunteur || 'N/A'}</p></div><div><p className="text-xs text-gray-500">SFD</p><p className="font-medium">{selectedSinistre.sfdId?.nom || 'N/A'}</p></div><div><p className="text-xs text-gray-500">Type</p><p className="font-medium">{getTypeLabel(selectedSinistre.typeSinistre)}</p></div><div><p className="text-xs text-gray-500">Statut</p><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedSinistre.statut)}`}>{getStatusLabel(selectedSinistre.statut)}</span></div><div><p className="text-xs text-gray-500">Date sinistre</p><p className="font-medium">{new Date(selectedSinistre.dateSinistre).toLocaleDateString('fr-FR')}</p></div><div><p className="text-xs text-gray-500">Date déclaration</p><p className="font-medium">{new Date(selectedSinistre.dateDeclaration).toLocaleDateString('fr-FR')}</p></div></div>
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg mb-4"><div><p className="text-xs text-gray-500">Montant prêt</p><p className="font-bold text-gray-800">{new Intl.NumberFormat('fr-FR').format(selectedSinistre.montantPret || 0)} FCFA</p></div><div><p className="text-xs text-gray-500">Capital restant</p><p className="font-bold text-red-600">{new Intl.NumberFormat('fr-FR').format(selectedSinistre.capitalRestantDu || 0)} FCFA</p></div><div><p className="text-xs text-gray-500">Capital remboursé</p><p className="font-bold text-green-600">{new Intl.NumberFormat('fr-FR').format(selectedSinistre.capitalRembourse || 0)} FCFA</p></div></div>
              {selectedSinistre.description && <div className="mb-4 p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">Description</p><p className="text-sm">{selectedSinistre.description}</p></div>}
              <div className="mb-4"><h3 className="font-semibold text-gray-700 mb-2">📎 Justificatifs</h3>{selectedSinistre.justificatifs?.length === 0 ? <p className="text-sm text-gray-500">Aucun justificatif</p> : <div className="space-y-1">{selectedSinistre.justificatifs?.map((j, idx) => (<div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded"><span>📄</span><span>{j.nom}</span><span className="text-xs text-gray-500 ml-auto">{new Date(j.dateUpload).toLocaleDateString('fr-FR')}</span></div>))}</div>}
              {selectedSinistre.statut !== 'PAYE' && selectedSinistre.statut !== 'REFUSE' && <div className="mt-3"><label className="block text-sm text-gray-600 mb-1">Ajouter un justificatif</label><div className="flex gap-3"><input type="file" accept=".pdf,.jpg,.png,.jpeg" onChange={(e) => { if (e.target.files[0]) { handleAddJustificatif(selectedSinistre._id, e.target.files[0]); } e.target.value = ''; }} className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2" disabled={uploadingFile} />{uploadingFile && <span className="text-sm text-gray-500">Envoi...</span>}</div></div>}</div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2">
              {selectedSinistre.statut === 'A_VERIFIER' && <><button onClick={() => { handleValider(selectedSinistre._id); setShowDetailModal(false); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">✅ Valider</button><button onClick={() => { handleRefuser(selectedSinistre._id); setShowDetailModal(false); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition">❌ Refuser</button></>}
              {selectedSinistre.statut === 'VALIDE' && <button onClick={() => { handlePayer(selectedSinistre._id); setShowDetailModal(false); }} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition">💰 Marquer payé</button>}
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sinistres;