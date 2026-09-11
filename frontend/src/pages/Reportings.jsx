// frontend/src/pages/Reportings.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { sfdAPI } from '../api/sfd';
import { exportReportings, exportAdhesions } from '../services/exportService';

const Reportings = () => {
  const [reportings, setReportings] = useState([]);
  const [sfds, setSfds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState({ statut: '', sfdId: '', mois: '', annee: '' });
  const [selectedReporting, setSelectedReporting] = useState(null);
  const [adhesions, setAdhesions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingAdhesions, setLoadingAdhesions] = useState(false);
  const [adhesionsFilter, setAdhesionsFilter] = useState({ exclude: 'false', search: '' });
  const [stats, setStats] = useState({ total: 0, clotures: 0, enCours: 0, exclusions: 0 });

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filter.statut) params.statut = filter.statut;
      if (filter.sfdId) params.sfdId = filter.sfdId;
      if (filter.mois) params.mois = filter.mois;
      if (filter.annee) params.annee = filter.annee;
      
      const reportingsRes = await api.get('/reporting', { params });
      const data = reportingsRes.data.data || [];
      setReportings(data);
      
      const statsCalc = {
        total: data.length,
        clotures: data.filter(r => r.statut === 'CLOTURE').length,
        enCours: data.filter(r => r.statut !== 'CLOTURE').length,
        exclusions: data.reduce((sum, r) => sum + (r.nombreExclusions || 0), 0)
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

  const openDetails = async (reporting) => {
    setSelectedReporting(reporting);
    setShowModal(true);
    setLoadingAdhesions(true);
    try {
      const response = await api.get(`/reporting/${reporting._id}/adhesions`, {
        params: { exclude: 'false', limit: 500 }
      });
      setAdhesions(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement adhésions:', err);
      setError('Impossible de charger les adhésions');
    } finally {
      setLoadingAdhesions(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReporting(null);
    setAdhesions([]);
  };

  const loadAdhesionsWithFilter = async (exclude) => {
    if (!selectedReporting) return;
    setLoadingAdhesions(true);
    try {
      const response = await api.get(`/reporting/${selectedReporting._id}/adhesions`, {
        params: { exclude: exclude === 'true' ? 'true' : 'false', limit: 500 }
      });
      setAdhesions(response.data.data || []);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoadingAdhesions(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type)) {
        setError('Seuls les fichiers Excel sont autorisés (.xlsx, .xls)');
        e.target.value = '';
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        setError('Le fichier ne doit pas dépasser 30 MB');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Veuillez sélectionner un fichier');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await api.post('/reporting/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      const result = response.data.data;
      setSuccess(`✅ ${result.totalAdhesions || 0} adhésions importées, ${result.totalExclusions || 0} exclusions`);
      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
      await loadData();
    } catch (err) {
      console.error('Erreur import:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setUploading(false);
    }
  };

  const handleCloturer = async (id) => {
    if (!window.confirm('Voulez-vous vraiment clôturer ce reporting ?')) return;
    try {
      await api.post(`/reporting/${id}/cloturer`);
      setSuccess('✅ Reporting clôturé avec succès');
      await loadData();
    } catch (err) {
      console.error('Erreur clôture:', err);
      setError(err.response?.data?.message || 'Erreur lors de la clôture');
    }
  };

  const handleExport = () => {
    if (reportings.length === 0) {
      setError('Aucune donnée à exporter');
      return;
    }
    const success = exportReportings(reportings);
    if (success) {
      setSuccess('✅ Export Excel réussi !');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError('Erreur lors de l\'export');
    }
  };

  const handleExportAdhesions = () => {
    if (adhesions.length === 0) {
      setError('Aucune adhésion à exporter');
      return;
    }
    const success = exportAdhesions(adhesions, `${selectedReporting?.sfdId?.nom}_${moisNoms[selectedReporting?.mois - 1]}_${selectedReporting?.annee}`);
    if (success) {
      setSuccess('✅ Export des adhésions réussi !');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const resetFilters = () => {
    setFilter({ statut: '', sfdId: '', mois: '', annee: '' });
  };

  const getStatusColor = (statut) => {
    const colors = {
      'RECU': 'bg-gray-100 text-gray-600',
      'EN_VALIDATION': 'bg-blue-100 text-blue-600',
      'EXCLUSIONS_A_CORRIGER': 'bg-yellow-100 text-yellow-600',
      'CORRIGE': 'bg-purple-100 text-purple-600',
      'CLOTURE': 'bg-green-100 text-green-600'
    };
    return colors[statut] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (statut) => {
    const labels = {
      'RECU': 'Reçu',
      'EN_VALIDATION': 'En validation',
      'EXCLUSIONS_A_CORRIGER': 'Exclusions à corriger',
      'CORRIGE': 'Corrigé',
      'CLOTURE': 'Clôturé'
    };
    return labels[statut] || statut;
  };

  const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Gestion des Reportings</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>📊</span> Exporter Excel
          </button>
          <button onClick={() => document.getElementById('fileInput').click()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>📤</span> Importer
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">❌ {error}<button onClick={() => setError(null)} className="float-right">✕</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}<button onClick={() => setSuccess(null)} className="float-right">✕</button></div>}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">📤 Importer un reporting</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <input id="fileInput" type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          <div className="flex-1">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition cursor-pointer" onClick={() => document.getElementById('fileInput').click()}>
              {selectedFile ? <span className="text-green-600">✅ {selectedFile.name}</span> : <span className="text-gray-500">Cliquez pour sélectionner un fichier Excel</span>}
            </div>
          </div>
          <button onClick={handleImport} disabled={!selectedFile || uploading} className={`px-6 py-2 rounded-lg text-white font-medium transition whitespace-nowrap ${!selectedFile || uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {uploading ? 'Import en cours...' : 'Importer'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Formats acceptés : .xlsx, .xls (max 30 MB)</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold text-gray-800">{stats.total}</p></div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500"><p className="text-sm text-gray-500">Clôturés</p><p className="text-2xl font-bold text-green-600">{stats.clotures}</p></div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500"><p className="text-sm text-gray-500">En cours</p><p className="text-2xl font-bold text-yellow-600">{stats.enCours}</p></div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500"><p className="text-sm text-gray-500">Exclusions</p><p className="text-2xl font-bold text-red-600">{stats.exclusions}</p></div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div><label className="text-sm text-gray-600 block mb-1">Statut</label><select value={filter.statut} onChange={(e) => setFilter({ ...filter, statut: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option><option value="RECU">Reçu</option><option value="EN_VALIDATION">En validation</option><option value="EXCLUSIONS_A_CORRIGER">Exclusions à corriger</option><option value="CORRIGE">Corrigé</option><option value="CLOTURE">Clôturé</option></select></div>
        <div><label className="text-sm text-gray-600 block mb-1">SFD</label><select value={filter.sfdId} onChange={(e) => setFilter({ ...filter, sfdId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option>{sfds.map((sfd) => (<option key={sfd._id} value={sfd._id}>{sfd.nom}</option>))}</select></div>
        <div><label className="text-sm text-gray-600 block mb-1">Mois</label><select value={filter.mois} onChange={(e) => setFilter({ ...filter, mois: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Tous</option>{moisNoms.map((m, i) => (<option key={i + 1} value={i + 1}>{m}</option>))}</select></div>
        <div><label className="text-sm text-gray-600 block mb-1">Année</label><select value={filter.annee} onChange={(e) => setFilter({ ...filter, annee: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"><option value="">Toutes</option>{years.map((y) => (<option key={y} value={y}>{y}</option>))}</select></div>
        <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Réinitialiser</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-32"><div className="text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div><p className="mt-2 text-sm text-gray-500">Chargement...</p></div></div>
        : reportings.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">📭</p><p>Aucun reporting trouvé</p><p className="text-sm">Importez un fichier Excel pour commencer</p></div>
        : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SFD</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Adhésions</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Exclusions</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prime totale</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th><th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{reportings.map((reporting) => (<tr key={reporting._id} className="hover:bg-gray-50 transition"><td className="px-4 py-3 text-sm font-medium text-gray-800">{reporting.sfdId?.nom || 'N/A'}</td><td className="px-4 py-3 text-sm text-gray-600">{moisNoms[reporting.mois - 1]} {reporting.annee}</td><td className="px-4 py-3 text-sm text-center text-gray-600">{reporting.nombreAdhesions || 0}</td><td className="px-4 py-3 text-sm text-center"><span className={reporting.nombreExclusions > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{reporting.nombreExclusions || 0}</span></td><td className="px-4 py-3 text-sm text-center text-gray-600">{new Intl.NumberFormat('fr-FR').format(reporting.totalPrime || 0)} FCFA</td><td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reporting.statut)}`}>{getStatusLabel(reporting.statut)}</span></td><td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => openDetails(reporting)} className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded" title="Voir détails">👁️</button>{reporting.statut !== 'CLOTURE' && reporting.nombreExclusions === 0 && <button onClick={() => handleCloturer(reporting._id)} className="text-green-600 hover:text-green-800 text-sm p-1 hover:bg-green-50 rounded" title="Clôturer">✅</button>}{reporting.statut === 'EXCLUSIONS_A_CORRIGER' && <button className="text-yellow-600 hover:text-yellow-800 text-sm p-1 hover:bg-yellow-50 rounded" title="Corriger les exclusions">✏️</button>}</div></td></tr>))}</tbody></table></div>}
      </div>

      {showModal && selectedReporting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-lg"><div><h2 className="text-lg font-bold text-gray-800">📋 Détails du reporting</h2><p className="text-sm text-gray-500">{selectedReporting.sfdId?.nom} - {moisNoms[selectedReporting.mois - 1]} {selectedReporting.annee}</p></div><button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50"><div><p className="text-xs text-gray-500">Adhésions</p><p className="text-lg font-bold text-gray-800">{selectedReporting.nombreAdhesions || 0}</p></div><div><p className="text-xs text-gray-500">Exclusions</p><p className="text-lg font-bold text-red-600">{selectedReporting.nombreExclusions || 0}</p></div><div><p className="text-xs text-gray-500">Prime totale</p><p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('fr-FR').format(selectedReporting.totalPrime || 0)} FCFA</p></div><div><p className="text-xs text-gray-500">Statut</p><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedReporting.statut)}`}>{getStatusLabel(selectedReporting.statut)}</span></div></div>
            <div className="flex items-center gap-4 p-4 border-b"><button onClick={() => { setAdhesionsFilter({ ...adhesionsFilter, exclude: 'false' }); loadAdhesionsWithFilter('false'); }} className={`px-3 py-1 text-sm rounded-lg transition ${adhesionsFilter.exclude === 'false' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>✅ Adhésions valides</button><button onClick={() => { setAdhesionsFilter({ ...adhesionsFilter, exclude: 'true' }); loadAdhesionsWithFilter('true'); }} className={`px-3 py-1 text-sm rounded-lg transition ${adhesionsFilter.exclude === 'true' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>⚠️ Exclusions</button><span className="text-sm text-gray-500 ml-auto">{adhesions.length} lignes</span></div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingAdhesions ? <div className="flex items-center justify-center h-32"><div className="text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div><p className="mt-2 text-sm text-gray-500">Chargement...</p></div></div>
              : adhesions.length === 0 ? <div className="text-center py-8 text-gray-500"><p>Aucune adhésion trouvée</p></div>
              : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emprunteur</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Montant</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durée</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Âge</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sexe</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th></tr></thead><tbody className="divide-y divide-gray-100">{adhesions.slice(0, 100).map((adh) => (<tr key={adh._id} className="hover:bg-gray-50"><td className="px-3 py-2 text-gray-800">{adh.prenomEmprunteur} {adh.nomEmprunteur}</td><td className="px-3 py-2 text-gray-600">{new Intl.NumberFormat('fr-FR').format(adh.montantPret || 0)}</td><td className="px-3 py-2 text-gray-600">{adh.dureePret || 0} mois</td><td className="px-3 py-2 text-gray-600">{adh.age || 0}</td><td className="px-3 py-2 text-gray-600">{adh.sexe || '-'}</td><td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${adh.estExclue ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{adh.estExclue ? 'Exclue' : 'Active'}</span></td></tr>))}</tbody></table>{adhesions.length > 100 && <p className="text-center text-sm text-gray-500 py-2">Affichage des 100 premières adhésions sur {adhesions.length}</p>}</div>}
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-between">
              <button onClick={handleExportAdhesions} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">📊 Exporter les adhésions</button>
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reportings;