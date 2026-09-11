// frontend/src/pages/Assureurs.jsx
import React, { useState, useEffect } from 'react';
import { assureurAPI } from '../api/assureur';
import api from '../api/axios';

const Assureurs = () => {
  // États principaux
  const [assureurs, setAssureurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPays, setFilterPays] = useState('');

  // États pour le modal de création/modification
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    code: '',
    contact: {
      nom: '',
      email: '',
      telephone: ''
    },
    adresse: '',
    pays: 'Sénégal',
    statut: 'ACTIF'
  });
  const [editingId, setEditingId] = useState(null);

  // États pour le modal de détails
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssureur, setSelectedAssureur] = useState(null);
  const [assureurContrats, setAssureurContrats] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  // Filtrer les assureurs
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filterStatut, filterPays]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterStatut) params.statut = filterStatut;
      if (filterPays) params.pays = filterPays;
      
      const response = await assureurAPI.getAll(params);
      setAssureurs(response.data.data || []);
      
    } catch (err) {
      console.error('Erreur chargement assureurs:', err);
      setError('Impossible de charger les assureurs');
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir le modal de création
  const openCreateModal = () => {
    setIsEditing(false);
    setFormData({
      nom: '',
      code: '',
      contact: {
        nom: '',
        email: '',
        telephone: ''
      },
      adresse: '',
      pays: 'Sénégal',
      statut: 'ACTIF'
    });
    setShowModal(true);
  };

  // Ouvrir le modal de modification
  const openEditModal = (assureur) => {
    setIsEditing(true);
    setEditingId(assureur._id);
    setFormData({
      nom: assureur.nom || '',
      code: assureur.code || '',
      contact: {
        nom: assureur.contact?.nom || '',
        email: assureur.contact?.email || '',
        telephone: assureur.contact?.telephone || ''
      },
      adresse: assureur.adresse || '',
      pays: assureur.pays || 'Sénégal',
      statut: assureur.statut || 'ACTIF'
    });
    setShowModal(true);
  };

  // Gérer les changements du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Soumettre le formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      // Vérifier les champs obligatoires
      if (!formData.nom || !formData.code) {
        setError('Le nom et le code sont obligatoires');
        return;
      }

      // Mettre le code en majuscules
      const dataToSend = {
        ...formData,
        code: formData.code.toUpperCase()
      };

      let response;
      if (isEditing) {
        response = await assureurAPI.update(editingId, dataToSend);
        setSuccess(`✅ Assureur "${dataToSend.nom}" modifié avec succès`);
      } else {
        response = await assureurAPI.create(dataToSend);
        setSuccess(`✅ Assureur "${dataToSend.nom}" créé avec succès`);
      }

      setShowModal(false);
      await loadData();
      
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  // Supprimer un assureur
  const handleDelete = async (id, nom) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer l'assureur "${nom}" ? Cette action est irréversible.`)) return;
    
    try {
      await assureurAPI.delete(id);
      setSuccess(`✅ Assureur "${nom}" supprimé avec succès`);
      await loadData();
    } catch (err) {
      console.error('Erreur suppression:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // Ouvrir les détails
  const openDetails = async (assureur) => {
    setSelectedAssureur(assureur);
    setShowDetailModal(true);
    setLoadingDetails(true);
    
    try {
      // Récupérer les contrats associés à l'assureur
      const response = await api.get('/contrats', { 
        params: { assureurId: assureur._id, limit: 50 }
      });
      setAssureurContrats(response.data.data || []);
      
    } catch (err) {
      console.error('Erreur chargement contrats:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Fermer le modal de détails
  const closeDetails = () => {
    setShowDetailModal(false);
    setSelectedAssureur(null);
    setAssureurContrats([]);
  };

  // Statut colors
  const getStatusColor = (statut) => {
    const colors = {
      'ACTIF': 'bg-green-100 text-green-600',
      'INACTIF': 'bg-gray-100 text-gray-600'
    };
    return colors[statut] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (statut) => {
    const labels = {
      'ACTIF': 'Actif',
      'INACTIF': 'Inactif'
    };
    return labels[statut] || statut;
  };

  // Pays uniques pour le filtre
  const paysUniques = [...new Set(assureurs.map(a => a.pays).filter(Boolean))];

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🏢 Gestion des Assureurs</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          <span>➕</span> Ajouter un assureur
        </button>
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

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-gray-600 block mb-1">Rechercher</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom ou code..."
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Statut</label>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            <option value="ACTIF">Actif</option>
            <option value="INACTIF">Inactif</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Pays</label>
          <select
            value={filterPays}
            onChange={(e) => setFilterPays(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {paysUniques.map((pays) => (
              <option key={pays} value={pays}>{pays}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatut('');
              setFilterPays('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Liste des assureurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">Chargement...</p>
            </div>
          </div>
        ) : assureurs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-2">🏢</p>
            <p>Aucun assureur trouvé</p>
            <p className="text-sm">Cliquez sur "Ajouter un assureur" pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pays</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Contrats</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assureurs.map((assureur) => (
                  <tr key={assureur._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm font-mono text-gray-800">
                      {assureur.code}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {assureur.nom}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {assureur.pays}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {assureur.contact?.nom || '-'}
                      {assureur.contact?.telephone && (
                        <span className="text-xs text-gray-400 block">{assureur.contact.telephone}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assureur.statut)}`}>
                        {getStatusLabel(assureur.statut)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {assureur.nombreContrats || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetails(assureur)}
                          className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded"
                          title="Voir détails"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => openEditModal(assureur)}
                          className="text-yellow-600 hover:text-yellow-800 text-sm p-1 hover:bg-yellow-50 rounded"
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(assureur._id, assureur.nom)}
                          className="text-red-600 hover:text-red-800 text-sm p-1 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de création/modification */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {isEditing ? '✏️ Modifier l\'assureur' : '➕ Ajouter un assureur'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              {/* Informations générales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pays
                  </label>
                  <input
                    type="text"
                    name="pays"
                    value={formData.pays}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    name="statut"
                    value={formData.statut}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ACTIF">Actif</option>
                    <option value="INACTIF">Inactif</option>
                  </select>
                </div>
              </div>

              {/* Adresse */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  name="adresse"
                  value={formData.adresse}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Contact */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-700 mb-3">📞 Contact</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nom du contact</label>
                    <input
                      type="text"
                      name="contact.nom"
                      value={formData.contact.nom}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      name="contact.email"
                      value={formData.contact.email}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Téléphone</label>
                    <input
                      type="text"
                      name="contact.telephone"
                      value={formData.contact.telephone}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {isEditing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de détails */}
      {showDetailModal && selectedAssureur && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  🏢 {selectedAssureur.nom}
                </h2>
                <p className="text-sm text-gray-500">Code: {selectedAssureur.code}</p>
              </div>
              <button
                onClick={closeDetails}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Pays</p>
                  <p className="font-medium">{selectedAssureur.pays || 'Non renseigné'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Statut</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAssureur.statut)}`}>
                    {getStatusLabel(selectedAssureur.statut)}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Adresse</p>
                  <p className="font-medium">{selectedAssureur.adresse || 'Non renseignée'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Nombre de contrats</p>
                  <p className="font-medium">{assureurContrats.length}</p>
                </div>
              </div>

              {/* Contact */}
              {selectedAssureur.contact && (selectedAssureur.contact.nom || selectedAssureur.contact.email || selectedAssureur.contact.telephone) && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">📞 Contact</h3>
                  <div className="space-y-1 text-sm">
                    {selectedAssureur.contact.nom && (
                      <div><span className="text-gray-500">Nom:</span> {selectedAssureur.contact.nom}</div>
                    )}
                    {selectedAssureur.contact.email && (
                      <div><span className="text-gray-500">Email:</span> {selectedAssureur.contact.email}</div>
                    )}
                    {selectedAssureur.contact.telephone && (
                      <div><span className="text-gray-500">Téléphone:</span> {selectedAssureur.contact.telephone}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Contrats associés */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">📋 Contrats associés ({assureurContrats.length})</h3>
                {loadingDetails ? (
                  <p className="text-sm text-gray-500">Chargement...</p>
                ) : assureurContrats.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun contrat associé</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Code</th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Nom</th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">SFD</th>
                          <th className="px-2 py-1 text-center text-xs font-medium text-gray-500">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assureurContrats.map((c) => (
                          <tr key={c._id} className="border-b border-gray-100">
                            <td className="px-2 py-1 font-mono">{c.code}</td>
                            <td className="px-2 py-1">{c.nom}</td>
                            <td className="px-2 py-1">{c.sfdId?.nom || 'N/A'}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.statut)}`}>
                                {getStatusLabel(c.statut)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Pied du modal */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2">
              <button
                onClick={() => {
                  closeDetails();
                  openEditModal(selectedAssureur);
                }}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition"
              >
                ✏️ Modifier
              </button>
              <button
                onClick={closeDetails}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assureurs;