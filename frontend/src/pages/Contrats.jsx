// frontend/src/pages/Contrats.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { sfdAPI } from '../api/sfd';
import { assureurAPI } from '../api/assureur';
import { contratAPI } from '../api/contrat';
import { exportContrats } from '../services/exportService';

const Contrats = () => {
  const [contrats, setContrats] = useState([]);
  const [sfds, setSfds] = useState([]);
  const [assureurs, setAssureurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterSFD, setFilterSFD] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ nom: '', code: '', sfdId: '', assureurId: '', ageMin: 18, ageMaxDebut: 64, ageMaxFin: 65, dureeMin: 1, dureeMax: null, montantMin: 0, montantMax: 25000000, tauxPrime1: 0.0065, tauxPrime2: 0.0163, seuilPrime2: 14000000, tauxFraisGestion: 0.08, tauxTaxe: 0, tauxCommissionSFD: 0.07, tauxCommissionAssureur: 0.05, tauxCommissionIG: 0.15, typeGestionSinistres: 'COMPENSATION', tauxRemboursementPret: 1, dateEffet: '', dateEffetAvenant: '', statut: 'ACTIF' });
  const [editingId, setEditingId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContrat, setSelectedContrat] = useState(null);

  useEffect(() => { loadData(); loadSfds(); loadAssureurs(); }, []);
  useEffect(() => { const timer = setTimeout(() => { loadData(); }, 300); return () => clearTimeout(timer); }, [searchTerm, filterStatut, filterSFD]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterStatut) params.statut = filterStatut;
      if (filterSFD) params.sfdId = filterSFD;
      const response = await contratAPI.getAll(params);
      setContrats(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement contrats:', err);
      setError('Impossible de charger les contrats');
    } finally {
      setLoading(false);
    }
  };

  const loadSfds = async () => {
    try {
      const response = await sfdAPI.getAll();
      setSfds(response.data.data || []);
    } catch (err) { console.error('Erreur chargement SFD:', err); }
  };

  const loadAssureurs = async () => {
    try {
      const response = await assureurAPI.getAll();
      setAssureurs(response.data.data || []);
    } catch (err) { console.error('Erreur chargement assureurs:', err); }
  };

  const handleExport = () => {
    if (contrats.length === 0) { setError('Aucune donnée à exporter'); return; }
    const success = exportContrats(contrats);
    if (success) { setSuccess('✅ Export Excel réussi !'); setTimeout(() => setSuccess(null), 3000); } 
    else { setError('Erreur lors de l\'export'); }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setFormData({ nom: '', code: '', sfdId: '', assureurId: '', ageMin: 18, ageMaxDebut: 64, ageMaxFin: 65, dureeMin: 1, dureeMax: null, montantMin: 0, montantMax: 25000000, tauxPrime1: 0.0065, tauxPrime2: 0.0163, seuilPrime2: 14000000, tauxFraisGestion: 0.08, tauxTaxe: 0, tauxCommissionSFD: 0.07, tauxCommissionAssureur: 0.05, tauxCommissionIG: 0.15, typeGestionSinistres: 'COMPENSATION', tauxRemboursementPret: 1, dateEffet: '', dateEffetAvenant: '', statut: 'ACTIF' });
    setShowModal(true);
  };

  const openEditModal = (contrat) => {
    setIsEditing(true);
    setEditingId(contrat._id);
    setFormData({ nom: contrat.nom || '', code: contrat.code || '', sfdId: contrat.sfdId?._id || contrat.sfdId || '', assureurId: contrat.assureurId?._id || contrat.assureurId || '', ageMin: contrat.ageMin || 18, ageMaxDebut: contrat.ageMaxDebut || 64, ageMaxFin: contrat.ageMaxFin || 65, dureeMin: contrat.dureeMin || 1, dureeMax: contrat.dureeMax || null, montantMin: contrat.montantMin || 0, montantMax: contrat.montantMax || 25000000, tauxPrime1: contrat.tauxPrime1 || 0.0065, tauxPrime2: contrat.tauxPrime2 || 0.0163, seuilPrime2: contrat.seuilPrime2 || 14000000, tauxFraisGestion: contrat.tauxFraisGestion || 0.08, tauxTaxe: contrat.tauxTaxe || 0, tauxCommissionSFD: contrat.tauxCommissionSFD || 0.07, tauxCommissionAssureur: contrat.tauxCommissionAssureur || 0.05, tauxCommissionIG: contrat.tauxCommissionIG || 0.15, typeGestionSinistres: contrat.typeGestionSinistres || 'COMPENSATION', tauxRemboursementPret: contrat.tauxRemboursementPret || 1, dateEffet: contrat.dateEffet ? new Date(contrat.dateEffet).toISOString().split('T')[0] : '', dateEffetAvenant: contrat.dateEffetAvenant ? new Date(contrat.dateEffetAvenant).toISOString().split('T')[0] : '', statut: contrat.statut || 'ACTIF' });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (!formData.nom || !formData.code || !formData.sfdId || !formData.assureurId) { setError('Le nom, le code, le SFD et l\'assureur sont obligatoires'); return; }
      const dataToSend = { ...formData, code: formData.code.toUpperCase(), dateEffet: formData.dateEffet ? new Date(formData.dateEffet) : null, dateEffetAvenant: formData.dateEffetAvenant ? new Date(formData.dateEffetAvenant) : null };
      if (isEditing) { await contratAPI.update(editingId, dataToSend); setSuccess(`✅ Contrat "${dataToSend.nom}" modifié avec succès`); } 
      else { await contratAPI.create(dataToSend); setSuccess(`✅ Contrat "${dataToSend.nom}" créé avec succès`); }
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id, nom) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le contrat "${nom}" ?`)) return;
    try {
      await contratAPI.delete(id);
      setSuccess(`✅ Contrat "${nom}" supprimé avec succès`);
      await loadData();
    } catch (err) {
      console.error('Erreur suppression:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const openDetails = async (contrat) => {
    try {
      const response = await contratAPI.getById(contrat._id);
      setSelectedContrat(response.data.data);
      setShowDetailModal(true);
    } catch (err) { console.error('Erreur chargement détails:', err); setError('Impossible de charger les détails'); }
  };

  const getStatusColor = (statut) => {
    const colors = { 'ACTIF': 'bg-green-100 text-green-600', 'INACTIF': 'bg-gray-100 text-gray-600' };
    return colors[statut] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (statut) => {
    const labels = { 'ACTIF': 'Actif', 'INACTIF': 'Inactif' };
    return labels[statut] || statut;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Gestion des Contrats</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>📊</span> Exporter Excel
          </button>
          <button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>➕</span> Ajouter
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">❌ {error}<button onClick={() => setError(null)} className="float-right">✕</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}<button onClick={() => setSuccess(null)} className="float-right">✕</button></div>}

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><label className="text-sm text-gray-600 block mb-1">Rechercher</label><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nom ou code..." className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
        <div><label className="text-sm text-gray-600 block mb-1">Statut</label><select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select></div>
        <div><label className="text-sm text-gray-600 block mb-1">SFD</label><select value={filterSFD} onChange={(e) => setFilterSFD(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div>
        <div className="flex items-end"><button onClick={() => { setSearchTerm(''); setFilterStatut(''); setFilterSFD(''); }} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Réinitialiser</button></div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><div className="text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div><p className="mt-2 text-sm text-gray-500">Chargement...</p></div></div>
        : contrats.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">📋</p><p>Aucun contrat trouvé</p><p className="text-sm">Cliquez sur "Ajouter un contrat" pour commencer</p></div>
        : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SFD</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assureur</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Montant max</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{contrats.map((contrat) => (<tr key={contrat._id} className="hover:bg-gray-50 transition"><td className="px-4 py-3 text-sm font-mono text-gray-800">{contrat.code}</td><td className="px-4 py-3 text-sm font-medium text-gray-800">{contrat.nom}</td><td className="px-4 py-3 text-sm text-gray-600">{contrat.sfdId?.nom || 'N/A'}</td><td className="px-4 py-3 text-sm text-gray-600">{contrat.assureurId?.nom || 'N/A'}</td><td className="px-4 py-3 text-sm text-center text-gray-600">{new Intl.NumberFormat('fr-FR').format(contrat.montantMax || 0)}</td><td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contrat.statut)}`}>{getStatusLabel(contrat.statut)}</span></td><td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openDetails(contrat)} className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded" title="Voir détails">👁️</button><button onClick={() => openEditModal(contrat)} className="text-yellow-600 hover:text-yellow-800 text-sm p-1 hover:bg-yellow-50 rounded" title="Modifier">✏️</button><button onClick={() => handleDelete(contrat._id, contrat.nom)} className="text-red-600 hover:text-red-800 text-sm p-1 hover:bg-red-50 rounded" title="Supprimer">🗑️</button></div></td></tr>))}</tbody></table></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-bold text-gray-800">{isEditing ? '✏️ Modifier le contrat' : '➕ Ajouter un contrat'}</h2><button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" name="nom" value={formData.nom} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Code *</label><input type="text" name="code" value={formData.code} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase" required /></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">SFD *</label><select name="sfdId" value={formData.sfdId} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required><option value="">Sélectionner un SFD</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Assureur *</label><select name="assureurId" value={formData.assureurId} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required><option value="">Sélectionner un assureur</option>{assureurs.map((a) => (<option key={a._id} value={a._id}>{a.nom}</option>))}</select></div></div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-2">📋 Conditions de souscription</h3><div className="grid grid-cols-3 gap-3"><div><label className="block text-xs text-gray-600">Âge min</label><input type="number" name="ageMin" value={formData.ageMin} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Âge max début</label><input type="number" name="ageMaxDebut" value={formData.ageMaxDebut} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Âge max fin</label><input type="number" name="ageMaxFin" value={formData.ageMaxFin} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Durée min (mois)</label><input type="number" name="dureeMin" value={formData.dureeMin} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Durée max (mois)</label><input type="number" name="dureeMax" value={formData.dureeMax || ''} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Illimité" /></div><div><label className="block text-xs text-gray-600">Montant max</label><input type="number" name="montantMax" value={formData.montantMax} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div></div></div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-2">💰 Tarification</h3><div className="grid grid-cols-3 gap-3"><div><label className="block text-xs text-gray-600">Taux prime 1</label><input type="number" step="0.0001" name="tauxPrime1" value={formData.tauxPrime1} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Taux prime 2</label><input type="number" step="0.0001" name="tauxPrime2" value={formData.tauxPrime2} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Seuil prime 2</label><input type="number" name="seuilPrime2" value={formData.seuilPrime2} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Frais gestion</label><input type="number" step="0.01" name="tauxFraisGestion" value={formData.tauxFraisGestion} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Taxe</label><input type="number" step="0.01" name="tauxTaxe" value={formData.tauxTaxe} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Remboursement prêt</label><input type="number" step="0.01" name="tauxRemboursementPret" value={formData.tauxRemboursementPret} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div></div></div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-2">📊 Commissions</h3><div className="grid grid-cols-3 gap-3"><div><label className="block text-xs text-gray-600">Commission SFD</label><input type="number" step="0.01" name="tauxCommissionSFD" value={formData.tauxCommissionSFD} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Commission IG</label><input type="number" step="0.01" name="tauxCommissionIG" value={formData.tauxCommissionIG} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div><div><label className="block text-xs text-gray-600">Commission Assureur</label><input type="number" step="0.01" name="tauxCommissionAssureur" value={formData.tauxCommissionAssureur} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></div></div></div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-2">⚙️ Gestion des sinistres</h3><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-600">Type de gestion</label><select name="typeGestionSinistres" value={formData.typeGestionSinistres} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"><option value="COMPENSATION">Compensation</option><option value="DIRECT">Direct</option></select></div><div><label className="block text-xs text-gray-600">Statut</label><select name="statut" value={formData.statut} onChange={handleInputChange} className="w-full border border-gray-300 rounded px-2 py-1 text-sm"><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select></div></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Date d'effet</label><input type="date" name="dateEffet" value={formData.dateEffet} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Date avenant</label><input type="date" name="dateEffetAvenant" value={formData.dateEffetAvenant} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Annuler</button><button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">{isEditing ? 'Modifier' : 'Créer'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedContrat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><div><h2 className="text-lg font-bold text-gray-800">📋 {selectedContrat.nom}</h2><p className="text-sm text-gray-500">Code: {selectedContrat.code}</p></div><button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-4"><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">SFD</p><p className="font-medium">{selectedContrat.sfdId?.nom || 'N/A'}</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Assureur</p><p className="font-medium">{selectedContrat.assureurId?.nom || 'N/A'}</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Âge min / max</p><p className="font-medium">{selectedContrat.ageMin} - {selectedContrat.ageMaxFin} ans</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Montant max</p><p className="font-medium">{new Intl.NumberFormat('fr-FR').format(selectedContrat.montantMax)} FCFA</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Commission SFD</p><p className="font-medium">{(selectedContrat.tauxCommissionSFD || 0) * 100}%</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Commission IG</p><p className="font-medium">{(selectedContrat.tauxCommissionIG || 0) * 100}%</p></div></div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2"><button onClick={() => { setShowDetailModal(false); openEditModal(selectedContrat); }} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition">✏️ Modifier</button><button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contrats;