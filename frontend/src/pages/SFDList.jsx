// frontend/src/pages/SFDList.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { sfdAPI } from '../api/sfd';
import { assureurAPI } from '../api/assureur';
import { exportSFD } from '../services/exportService';

const SFDList = () => {
  const [sfds, setSfds] = useState([]);
  const [assureurs, setAssureurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ nom: '', code: '', pays: 'Sénégal', region: '', contact: { nom: '', email: '', telephone: '' }, assureurId: '', dateDebutContrat: '', dateFinContrat: '', statut: 'ACTIF', parametresSpecifiques: { tauxCommissionSFD: 0.07, tauxCommissionIG: 0.15, typeGestionSinistres: 'COMPENSATION' } });
  const [editingId, setEditingId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSFD, setSelectedSFD] = useState(null);
  const [sfdReportings, setSfdReportings] = useState([]);
  const [sfdSinistres, setSfdSinistres] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => { loadData(); loadAssureurs(); }, []);
  useEffect(() => { const timer = setTimeout(() => { loadData(); }, 300); return () => clearTimeout(timer); }, [searchTerm, filterStatut]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterStatut) params.statut = filterStatut;
      const response = await sfdAPI.getAll(params);
      setSfds(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement SFD:', err);
      setError('Impossible de charger les SFD');
    } finally {
      setLoading(false);
    }
  };

  const loadAssureurs = async () => {
    try {
      const response = await assureurAPI.getAll();
      setAssureurs(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement assureurs:', err);
    }
  };

  const handleExport = () => {
    if (sfds.length === 0) { setError('Aucune donnée à exporter'); return; }
    const success = exportSFD(sfds);
    if (success) { setSuccess('✅ Export Excel réussi !'); setTimeout(() => setSuccess(null), 3000); } 
    else { setError('Erreur lors de l\'export'); }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setFormData({ nom: '', code: '', pays: 'Sénégal', region: '', contact: { nom: '', email: '', telephone: '' }, assureurId: '', dateDebutContrat: '', dateFinContrat: '', statut: 'ACTIF', parametresSpecifiques: { tauxCommissionSFD: 0.07, tauxCommissionIG: 0.15, typeGestionSinistres: 'COMPENSATION' } });
    setShowModal(true);
  };

  const openEditModal = (sfd) => {
    setIsEditing(true);
    setEditingId(sfd._id);
    setFormData({ nom: sfd.nom || '', code: sfd.code || '', pays: sfd.pays || 'Sénégal', region: sfd.region || '', contact: { nom: sfd.contact?.nom || '', email: sfd.contact?.email || '', telephone: sfd.contact?.telephone || '' }, assureurId: sfd.assureurId?._id || sfd.assureurId || '', dateDebutContrat: sfd.dateDebutContrat ? new Date(sfd.dateDebutContrat).toISOString().split('T')[0] : '', dateFinContrat: sfd.dateFinContrat ? new Date(sfd.dateFinContrat).toISOString().split('T')[0] : '', statut: sfd.statut || 'ACTIF', parametresSpecifiques: { tauxCommissionSFD: sfd.parametresSpecifiques?.tauxCommissionSFD || 0.07, tauxCommissionIG: sfd.parametresSpecifiques?.tauxCommissionIG || 0.15, typeGestionSinistres: sfd.parametresSpecifiques?.typeGestionSinistres || 'COMPENSATION' } });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else if (name.includes('parametresSpecifiques.')) {
      const key = name.split('.')[1];
      setFormData(prev => ({ ...prev, parametresSpecifiques: { ...prev.parametresSpecifiques, [key]: parseFloat(value) || value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (!formData.nom || !formData.code) { setError('Le nom et le code sont obligatoires'); return; }
      const dataToSend = { ...formData, dateDebutContrat: formData.dateDebutContrat ? new Date(formData.dateDebutContrat) : null, dateFinContrat: formData.dateFinContrat ? new Date(formData.dateFinContrat) : null, parametresSpecifiques: { ...formData.parametresSpecifiques, tauxCommissionSFD: parseFloat(formData.parametresSpecifiques.tauxCommissionSFD) || 0, tauxCommissionIG: parseFloat(formData.parametresSpecifiques.tauxCommissionIG) || 0 } };
      if (isEditing) { await sfdAPI.update(editingId, dataToSend); setSuccess(`✅ SFD "${dataToSend.nom}" modifié avec succès`); } 
      else { await sfdAPI.create(dataToSend); setSuccess(`✅ SFD "${dataToSend.nom}" créé avec succès`); }
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id, nom) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le SFD "${nom}" ?`)) return;
    try {
      await sfdAPI.delete(id);
      setSuccess(`✅ SFD "${nom}" supprimé avec succès`);
      await loadData();
    } catch (err) {
      console.error('Erreur suppression:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const openDetails = async (sfd) => {
    setSelectedSFD(sfd);
    setShowDetailModal(true);
    setLoadingDetails(true);
    try {
      const reportingsRes = await api.get('/reporting', { params: { sfdId: sfd._id, limit: 50 } });
      setSfdReportings(reportingsRes.data.data || []);
      const sinistresRes = await api.get('/sinistres', { params: { sfdId: sfd._id, limit: 50 } });
      setSfdSinistres(sinistresRes.data.data || []);
    } catch (err) { console.error('Erreur chargement détails:', err); } finally { setLoadingDetails(false); }
  };

  const getStatusColor = (statut) => {
    const colors = { 'ACTIF': 'bg-green-100 text-green-600', 'INACTIF': 'bg-gray-100 text-gray-600', 'EXPIRE': 'bg-red-100 text-red-600' };
    return colors[statut] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (statut) => {
    const labels = { 'ACTIF': 'Actif', 'INACTIF': 'Inactif', 'EXPIRE': 'Expiré' };
    return labels[statut] || statut;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🏦 Gestion des SFD</h1>
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
        <div><label className="text-sm text-gray-600 block mb-1">Statut</label><select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option><option value="EXPIRE">Expiré</option></select></div>
        <div className="flex items-end"><button onClick={() => { setSearchTerm(''); setFilterStatut(''); }} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Réinitialiser</button></div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><div className="text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div><p className="mt-2 text-sm text-gray-500">Chargement...</p></div></div>
        : sfds.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">🏦</p><p>Aucun SFD trouvé</p><p className="text-sm">Cliquez sur "Ajouter un SFD" pour commencer</p></div>
        : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pays</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assureur</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{sfds.map((sfd) => (<tr key={sfd._id} className="hover:bg-gray-50 transition"><td className="px-4 py-3 text-sm font-mono text-gray-800">{sfd.code}</td><td className="px-4 py-3 text-sm font-medium text-gray-800">{sfd.nom}</td><td className="px-4 py-3 text-sm text-gray-600">{sfd.pays}</td><td className="px-4 py-3 text-sm text-gray-600">{sfd.assureurId?.nom || 'Non assigné'}</td><td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sfd.statut)}`}>{getStatusLabel(sfd.statut)}</span></td><td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openDetails(sfd)} className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded" title="Voir détails">👁️</button><button onClick={() => openEditModal(sfd)} className="text-yellow-600 hover:text-yellow-800 text-sm p-1 hover:bg-yellow-50 rounded" title="Modifier">✏️</button><button onClick={() => handleDelete(sfd._id, sfd.nom)} className="text-red-600 hover:text-red-800 text-sm p-1 hover:bg-red-50 rounded" title="Supprimer">🗑️</button></div></td></tr>))}</tbody></table></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-bold text-gray-800">{isEditing ? '✏️ Modifier le SFD' : '➕ Ajouter un SFD'}</h2><button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" name="nom" value={formData.nom} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Code *</label><input type="text" name="code" value={formData.code} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase" required /></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Pays</label><input type="text" name="pays" value={formData.pays} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Région</label><input type="text" name="region" value={formData.region} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div></div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-3">📞 Contact</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="block text-sm text-gray-600 mb-1">Nom du contact</label><input type="text" name="contact.nom" value={formData.contact.nom} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div><div><label className="block text-sm text-gray-600 mb-1">Email</label><input type="email" name="contact.email" value={formData.contact.email} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div><div><label className="block text-sm text-gray-600 mb-1">Téléphone</label><input type="text" name="contact.telephone" value={formData.contact.telephone} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Assureur</label><select name="assureurId" value={formData.assureurId} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"><option value="">Non assigné</option>{assureurs.map((a) => (<option key={a._id} value={a._id}>{a.nom}</option>))}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Statut</label><select name="statut" value={formData.statut} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option><option value="EXPIRE">Expiré</option></select></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Date début contrat</label><input type="date" name="dateDebutContrat" value={formData.dateDebutContrat} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Date fin contrat</label><input type="date" name="dateFinContrat" value={formData.dateFinContrat} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div></div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-3">⚙️ Paramètres spécifiques</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="block text-sm text-gray-600 mb-1">Taux commission SFD (%)</label><input type="number" step="0.01" name="parametresSpecifiques.tauxCommissionSFD" value={formData.parametresSpecifiques.tauxCommissionSFD} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div><div><label className="block text-sm text-gray-600 mb-1">Taux commission IG (%)</label><input type="number" step="0.01" name="parametresSpecifiques.tauxCommissionIG" value={formData.parametresSpecifiques.tauxCommissionIG} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" /></div><div><label className="block text-sm text-gray-600 mb-1">Gestion des sinistres</label><select name="parametresSpecifiques.typeGestionSinistres" value={formData.parametresSpecifiques.typeGestionSinistres} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="COMPENSATION">Compensation</option><option value="DIRECT">Direct</option></select></div></div></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Annuler</button><button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">{isEditing ? 'Modifier' : 'Créer'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedSFD && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><div><h2 className="text-lg font-bold text-gray-800">🏦 {selectedSFD.nom}</h2><p className="text-sm text-gray-500">Code: {selectedSFD.code}</p></div><button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-4"><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Pays</p><p className="font-medium">{selectedSFD.pays || 'Non renseigné'}</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Région</p><p className="font-medium">{selectedSFD.region || 'Non renseigné'}</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Statut</p><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedSFD.statut)}`}>{getStatusLabel(selectedSFD.statut)}</span></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Assureur</p><p className="font-medium">{selectedSFD.assureurId?.nom || 'Non assigné'}</p></div></div>
              {selectedSFD.contact && (selectedSFD.contact.nom || selectedSFD.contact.email || selectedSFD.contact.telephone) && <div className="mb-4 p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-2">📞 Contact</h3><div className="grid grid-cols-3 gap-2 text-sm"><div><span className="text-gray-500">Nom:</span><span className="ml-1">{selectedSFD.contact.nom || '-'}</span></div><div><span className="text-gray-500">Email:</span><span className="ml-1">{selectedSFD.contact.email || '-'}</span></div><div><span className="text-gray-500">Téléphone:</span><span className="ml-1">{selectedSFD.contact.telephone || '-'}</span></div></div></div>}
              {selectedSFD.parametresSpecifiques && <div className="mb-4 p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 mb-2">⚙️ Paramètres</h3><div className="grid grid-cols-3 gap-2 text-sm"><div><span className="text-gray-500">Commission SFD:</span><span className="ml-1 font-medium">{(selectedSFD.parametresSpecifiques.tauxCommissionSFD || 0) * 100}%</span></div><div><span className="text-gray-500">Commission IG:</span><span className="ml-1 font-medium">{(selectedSFD.parametresSpecifiques.tauxCommissionIG || 0) * 100}%</span></div><div><span className="text-gray-500">Gestion sinistres:</span><span className="ml-1 font-medium">{selectedSFD.parametresSpecifiques.typeGestionSinistres || 'COMPENSATION'}</span></div></div></div>}
              <div className="mb-4"><h3 className="font-medium text-gray-700 mb-2">📋 Reportings ({sfdReportings.length})</h3>{loadingDetails ? <p className="text-sm text-gray-500">Chargement...</p> : sfdReportings.length === 0 ? <p className="text-sm text-gray-500">Aucun reporting</p> : <div className="max-h-40 overflow-y-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Période</th><th className="px-2 py-1 text-center text-xs font-medium text-gray-500">Adhésions</th><th className="px-2 py-1 text-center text-xs font-medium text-gray-500">Statut</th></tr></thead><tbody>{sfdReportings.slice(0, 10).map((r) => (<tr key={r._id} className="border-b border-gray-100"><td className="px-2 py-1">{r.mois}/{r.annee}</td><td className="px-2 py-1 text-center">{r.nombreAdhesions || 0}</td><td className="px-2 py-1 text-center"><span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(r.statut)}`}>{getStatusLabel(r.statut)}</span></td></tr>))}</tbody></table></div>}</div>
              <div className="mb-4"><h3 className="font-medium text-gray-700 mb-2">🚨 Sinistres ({sfdSinistres.length})</h3>{loadingDetails ? <p className="text-sm text-gray-500">Chargement...</p> : sfdSinistres.length === 0 ? <p className="text-sm text-gray-500">Aucun sinistre</p> : <div className="max-h-40 overflow-y-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Date</th><th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Type</th><th className="px-2 py-1 text-center text-xs font-medium text-gray-500">Montant</th><th className="px-2 py-1 text-center text-xs font-medium text-gray-500">Statut</th></tr></thead><tbody>{sfdSinistres.slice(0, 10).map((s) => (<tr key={s._id} className="border-b border-gray-100"><td className="px-2 py-1">{new Date(s.dateSinistre).toLocaleDateString('fr-FR')}</td><td className="px-2 py-1">{getTypeLabel(s.typeSinistre)}</td><td className="px-2 py-1 text-center">{new Intl.NumberFormat('fr-FR').format(s.montantSinistre || 0)}</td><td className="px-2 py-1 text-center"><span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(s.statut)}`}>{getStatusLabel(s.statut)}</span></td></tr>))}</tbody></table></div>}</div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2"><button onClick={() => { setShowDetailModal(false); openEditModal(selectedSFD); }} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition">✏️ Modifier</button><button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SFDList;