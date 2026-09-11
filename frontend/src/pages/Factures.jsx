// frontend/src/pages/Factures.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { sfdAPI } from '../api/sfd';
import { factureAPI } from '../api/facture';
import { exportFactures } from '../services/exportService';

const Factures = () => {
  const [factures, setFactures] = useState([]);
  const [sfds, setSfds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear());
  const [filterTrimestre, setFilterTrimestre] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterSFD, setFilterSFD] = useState('');
  const [showGenererModal, setShowGenererModal] = useState(false);
  const [genererData, setGenererData] = useState({ sfdId: '', trimestre: 1, annee: new Date().getFullYear(), tauxChange: 1 });
  const [generating, setGenerating] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [stats, setStats] = useState({ total: 0, generees: 0, payees: 0, totalMontant: 0, totalPaye: 0 });

  useEffect(() => { loadData(); loadSfds(); }, []);
  useEffect(() => { const timer = setTimeout(() => { loadData(); }, 300); return () => clearTimeout(timer); }, [filterAnnee, filterTrimestre, filterStatut, filterSFD]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterAnnee) params.annee = filterAnnee;
      if (filterTrimestre) params.trimestre = filterTrimestre;
      if (filterStatut) params.statut = filterStatut;
      if (filterSFD) params.sfdId = filterSFD;
      const response = await factureAPI.getAll(params);
      const data = response.data.data || [];
      setFactures(data);
      const statsCalc = { total: data.length, generees: data.filter(f => f.statut === 'GENEREE' || f.statut === 'ENVOYEE').length, payees: data.filter(f => f.statut === 'PAYEE').length, totalMontant: data.reduce((sum, f) => sum + (f.montants?.totalTTC || 0), 0), totalPaye: data.filter(f => f.statut === 'PAYEE').reduce((sum, f) => sum + (f.montants?.totalTTC || 0), 0) };
      setStats(statsCalc);
    } catch (err) {
      console.error('Erreur chargement factures:', err);
      setError('Impossible de charger les factures');
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

  const handleExport = () => {
    if (factures.length === 0) { setError('Aucune donnée à exporter'); return; }
    const success = exportFactures(factures);
    if (success) { setSuccess('✅ Export Excel réussi !'); setTimeout(() => setSuccess(null), 3000); } 
    else { setError('Erreur lors de l\'export'); }
  };

  const handleGenerer = async (e) => {
    e.preventDefault();
    if (!genererData.sfdId) { setError('Veuillez sélectionner un SFD'); return; }
    try {
      setGenerating(true);
      setError(null);
      const response = await factureAPI.generer(genererData);
      setSuccess(`✅ Facture générée avec succès ! Réf: ${response.data.data.facture.reference}`);
      setShowGenererModal(false);
      await loadData();
    } catch (err) {
      console.error('Erreur génération:', err);
      setError(err.response?.data?.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async (reference) => {
    try {
      const response = await factureAPI.getPDF(reference);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture_${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      setError('Erreur lors du téléchargement du PDF');
    }
  };

  const handlePayer = async (reference) => {
    if (!window.confirm(`Confirmer le paiement de la facture ${reference} ?`)) return;
    try {
      await factureAPI.payer(reference, { datePaiement: new Date().toISOString(), referencePaiement: `PAY-${Date.now()}` });
      setSuccess(`✅ Facture ${reference} marquée comme payée`);
      await loadData();
    } catch (err) {
      console.error('Erreur paiement:', err);
      setError(err.response?.data?.message || 'Erreur lors du paiement');
    }
  };

  const openDetails = async (facture) => {
    try {
      const response = await factureAPI.getByReference(facture.reference);
      setSelectedFacture(response.data.data);
      setShowDetailModal(true);
    } catch (err) { console.error('Erreur:', err); setError('Impossible de charger les détails'); }
  };

  const getStatusColor = (statut) => {
    const colors = { 'GENEREE': 'bg-blue-100 text-blue-600', 'ENVOYEE': 'bg-yellow-100 text-yellow-600', 'PAYEE': 'bg-green-100 text-green-600', 'ANNULEE': 'bg-red-100 text-red-600' };
    return colors[statut] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (statut) => {
    const labels = { 'GENEREE': 'Générée', 'ENVOYEE': 'Envoyée', 'PAYEE': 'Payée', 'ANNULEE': 'Annulée' };
    return labels[statut] || statut;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📄 Gestion des Factures</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>📊</span> Exporter Excel
          </button>
          <button onClick={() => setShowGenererModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>📤</span> Générer
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">❌ {error}<button onClick={() => setError(null)} className="float-right">✕</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}<button onClick={() => setSuccess(null)} className="float-right">✕</button></div>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-gray-400"><p className="text-xs text-gray-500">Total factures</p><p className="text-xl font-bold text-gray-800">{stats.total}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500"><p className="text-xs text-gray-500">Générées</p><p className="text-xl font-bold text-blue-600">{stats.generees}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500"><p className="text-xs text-gray-500">Payées</p><p className="text-xl font-bold text-green-600">{stats.payees}</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500"><p className="text-xs text-gray-500">Montant total</p><p className="text-sm font-bold text-purple-600 truncate">{new Intl.NumberFormat('fr-FR').format(stats.totalMontant)} FCFA</p></div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-emerald-500"><p className="text-xs text-gray-500">Montant payé</p><p className="text-sm font-bold text-emerald-600 truncate">{new Intl.NumberFormat('fr-FR').format(stats.totalPaye)} FCFA</p></div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div><label className="text-sm text-gray-600 block mb-1">Année</label><select value={filterAnnee} onChange={(e) => setFilterAnnee(parseInt(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">{years.map((y) => (<option key={y} value={y}>{y}</option>))}</select></div>
        <div><label className="text-sm text-gray-600 block mb-1">Trimestre</label><select value={filterTrimestre} onChange={(e) => setFilterTrimestre(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="1">T1 (Jan-Mar)</option><option value="2">T2 (Avr-Jun)</option><option value="3">T3 (Jul-Sep)</option><option value="4">T4 (Oct-Déc)</option></select></div>
        <div><label className="text-sm text-gray-600 block mb-1">Statut</label><select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="GENEREE">Générée</option><option value="ENVOYEE">Envoyée</option><option value="PAYEE">Payée</option><option value="ANNULEE">Annulée</option></select></div>
        <div><label className="text-sm text-gray-600 block mb-1">SFD</label><select value={filterSFD} onChange={(e) => setFilterSFD(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div>
        <div className="flex items-end"><button onClick={() => { setFilterAnnee(currentYear); setFilterTrimestre(''); setFilterStatut(''); setFilterSFD(''); }} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Réinitialiser</button></div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><div className="text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div><p className="mt-2 text-sm text-gray-500">Chargement...</p></div></div>
        : factures.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">📄</p><p>Aucune facture trouvée</p><p className="text-sm">Cliquez sur "Générer une facture" pour commencer</p></div>
        : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SFD</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Période</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Montant</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{factures.map((facture) => (<tr key={facture.reference} className="hover:bg-gray-50 transition"><td className="px-4 py-3 text-sm font-mono text-gray-800">{facture.reference}</td><td className="px-4 py-3 text-sm text-gray-600">{facture.sfd?.nom || 'N/A'}</td><td className="px-4 py-3 text-sm text-center text-gray-600">T{facture.periode?.trimestre} {facture.periode?.annee}</td><td className="px-4 py-3 text-sm text-center text-gray-600">{new Intl.NumberFormat('fr-FR').format(facture.montants?.totalTTC || 0)} FCFA</td><td className="px-4 py-3 text-sm text-center text-gray-600">{new Date(facture.dateGeneration).toLocaleDateString('fr-FR')}</td><td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(facture.statut)}`}>{getStatusLabel(facture.statut)}</span></td><td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openDetails(facture)} className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded" title="Voir détails">👁️</button><button onClick={() => handleDownloadPDF(facture.reference)} className="text-purple-600 hover:text-purple-800 text-sm p-1 hover:bg-purple-50 rounded" title="Télécharger PDF">📥</button>{facture.statut === 'GENEREE' && <button onClick={() => handlePayer(facture.reference)} className="text-green-600 hover:text-green-800 text-sm p-1 hover:bg-green-50 rounded" title="Marquer comme payée">💰</button>}</div></td></tr>))}</tbody></table></div>}
      </div>

      {showGenererModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-bold text-gray-800">📤 Générer une facture</h2><button onClick={() => setShowGenererModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <form onSubmit={handleGenerer} className="p-4">
              <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">SFD *</label><select value={genererData.sfdId} onChange={(e) => setGenererData({ ...genererData, sfdId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required><option value="">Sélectionner un SFD</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Trimestre *</label><select value={genererData.trimestre} onChange={(e) => setGenererData({ ...genererData, trimestre: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required><option value="1">T1 (Jan-Mar)</option><option value="2">T2 (Avr-Jun)</option><option value="3">T3 (Jul-Sep)</option><option value="4">T4 (Oct-Déc)</option></select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Année *</label><select value={genererData.annee} onChange={(e) => setGenererData({ ...genererData, annee: parseInt(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>{years.map((y) => (<option key={y} value={y}>{y}</option>))}</select></div></div>
              <div className="mt-4"><label className="block text-sm font-medium text-gray-700 mb-1">Taux de change (optionnel)</label><input type="number" step="0.01" value={genererData.tauxChange} onChange={(e) => setGenererData({ ...genererData, tauxChange: parseFloat(e.target.value) || 1 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="1" /></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowGenererModal(false)} className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Annuler</button><button type="submit" disabled={generating} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:bg-blue-400">{generating ? 'Génération...' : 'Générer'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedFacture && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-bold text-gray-800">📄 {selectedFacture.reference}</h2><button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3 mb-4"><div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">SFD</p><p className="font-medium text-sm">{selectedFacture.sfd?.nom}</p></div><div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Statut</p><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedFacture.statut)}`}>{getStatusLabel(selectedFacture.statut)}</span></div><div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Période</p><p className="font-medium text-sm">T{selectedFacture.periode?.trimestre} {selectedFacture.periode?.annee}</p></div><div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">Date génération</p><p className="font-medium text-sm">{new Date(selectedFacture.dateGeneration).toLocaleDateString('fr-FR')}</p></div></div>
              <div className="p-3 bg-gray-50 rounded-lg"><h3 className="font-medium text-gray-700 text-sm mb-2">💰 Montants</h3><div className="space-y-1 text-sm"><div className="flex justify-between"><span className="text-gray-600">Total primes</span><span>{new Intl.NumberFormat('fr-FR').format(selectedFacture.montants?.totalPrimes || 0)} FCFA</span></div><div className="flex justify-between"><span className="text-gray-600">Commission IG ({((selectedFacture.montants?.tauxCommission || 0.15) * 100)}%)</span><span>{new Intl.NumberFormat('fr-FR').format(selectedFacture.montants?.commissionIG || 0)} FCFA</span></div><div className="flex justify-between"><span className="text-gray-600">TVA ({(selectedFacture.montants?.tauxTVA || 0.18) * 100}%)</span><span>{new Intl.NumberFormat('fr-FR').format(selectedFacture.montants?.tva || 0)} FCFA</span></div><div className="flex justify-between font-bold border-t pt-1"><span>Total TTC</span><span className="text-blue-600">{new Intl.NumberFormat('fr-FR').format(selectedFacture.montants?.totalTTC || 0)} FCFA</span></div></div></div>
              {selectedFacture.montants?.totalTTCDevise && <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-center"><span className="text-gray-500">Total en devise:</span><span className="font-medium ml-1">{new Intl.NumberFormat('fr-FR').format(selectedFacture.montants.totalTTCDevise)} {selectedFacture.montants?.tauxChange ? `(taux: ${selectedFacture.montants.tauxChange})` : ''}</span></div>}
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2"><button onClick={() => handleDownloadPDF(selectedFacture.reference)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition">📥 Télécharger PDF</button>{selectedFacture.statut === 'GENEREE' && <button onClick={() => { handlePayer(selectedFacture.reference); setShowDetailModal(false); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">💰 Marquer payée</button>}<button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Factures;