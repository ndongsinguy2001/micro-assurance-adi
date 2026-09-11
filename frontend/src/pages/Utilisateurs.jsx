// frontend/src/pages/Utilisateurs.jsx
import React, { useState, useEffect } from 'react';
import { userAPI } from '../api/user';
import { sfdAPI } from '../api/sfd';
import { assureurAPI } from '../api/assureur';

const Utilisateurs = () => {
  const [users, setUsers] = useState([]);
  const [sfds, setSfds] = useState([]);
  const [assureurs, setAssureurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActif, setFilterActif] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    motDePasse: '',
    role: 'GESTIONNAIRE_IG',
    sfdId: '',
    assureurId: '',
    actif: true,
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    userId: null,
    userNom: '',
    nouveauMotDePasse: '',
    confirmation: '',
  });

  useEffect(() => {
    loadData();
  }, [searchTerm, filterRole, filterActif]);

  useEffect(() => {
    loadRefs();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterRole) params.role = filterRole;
      if (filterActif !== '') params.actif = filterActif;

      const res = await userAPI.getAll(params);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const loadRefs = async () => {
    try {
      const [sfdRes, assRes] = await Promise.all([
        sfdAPI.getAll(),
        assureurAPI.getAll(),
      ]);
      setSfds(sfdRes.data.data || []);
      setAssureurs(assRes.data.data || []);
    } catch (err) {
      console.error('Erreur chargement refs:', err);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      nom: '',
      email: '',
      motDePasse: '',
      role: 'GESTIONNAIRE_IG',
      sfdId: '',
      assureurId: '',
      actif: true,
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setIsEditing(true);
    setEditingId(user._id);
    setFormData({
      nom: user.nom || '',
      email: user.email || '',
      motDePasse: '',
      role: user.role || 'GESTIONNAIRE_IG',
      sfdId: user.sfdId?._id || user.sfdId || '',
      assureurId: user.assureurId?._id || user.assureurId || '',
      actif: user.actif !== undefined ? user.actif : true,
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nom || !formData.email || !formData.role) {
      setError('Nom, email et rôle sont obligatoires');
      return;
    }

    if (!isEditing && !formData.motDePasse) {
      setError('Le mot de passe est obligatoire');
      return;
    }

    if (!isEditing && formData.motDePasse.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (formData.role === 'SFD' && !formData.sfdId) {
      setError('Un SFD doit être sélectionné pour ce rôle');
      return;
    }

    if (formData.role === 'ASSUREUR' && !formData.assureurId) {
      setError('Un assureur doit être sélectionné pour ce rôle');
      return;
    }

    try {
      setError(null);

      if (isEditing) {
        // On n'envoie PAS le mot de passe en édition (endpoint séparé)
        const { motDePasse, ...dataToSend } = formData;
        await userAPI.update(editingId, dataToSend);
        setSuccess(`✅ Utilisateur "${formData.nom}" modifié`);
      } else {
        await userAPI.create(formData);
        setSuccess(`✅ Utilisateur "${formData.nom}" créé`);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleToggleActif = async (user) => {
    if (!window.confirm(`${user.actif ? 'Désactiver' : 'Activer'} le compte de ${user.nom} ?`))
      return;
    try {
      await userAPI.toggleActif(user._id);
      setSuccess(`✅ Compte ${user.actif ? 'désactivé' : 'activé'}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Supprimer définitivement l'utilisateur "${user.nom}" ?`)) return;
    try {
      await userAPI.delete(user._id);
      setSuccess(`✅ Utilisateur "${user.nom}" supprimé`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const openPasswordModal = (user) => {
    setPasswordData({
      userId: user._id,
      userNom: user.nom,
      nouveauMotDePasse: '',
      confirmation: '',
    });
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.nouveauMotDePasse.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (passwordData.nouveauMotDePasse !== passwordData.confirmation) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      await userAPI.changerMotDePasse(
        passwordData.userId,
        passwordData.nouveauMotDePasse
      );
      setSuccess(`✅ Mot de passe de "${passwordData.userNom}" modifié`);
      setShowPasswordModal(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      ADMIN: 'Administrateur',
      GESTIONNAIRE_IG: 'Gestionnaire IG',
      SFD: 'SFD',
      ASSUREUR: 'Assureur',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'bg-purple-100 text-purple-700',
      GESTIONNAIRE_IG: 'bg-blue-100 text-blue-700',
      SFD: 'bg-green-100 text-green-700',
      ASSUREUR: 'bg-orange-100 text-orange-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👥 Gestion des utilisateurs</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          <span>➕</span> Ajouter un utilisateur
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

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-gray-600 block mb-1">Rechercher</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom ou email..."
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Rôle</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            <option value="ADMIN">Administrateur</option>
            <option value="GESTIONNAIRE_IG">Gestionnaire IG</option>
            <option value="SFD">SFD</option>
            <option value="ASSUREUR">Assureur</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Statut</label>
          <select
            value={filterActif}
            onChange={(e) => setFilterActif(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterRole('');
              setFilterActif('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-2">👥</p>
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rattachement</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{user.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.sfdId?.nom || user.assureurId?.nom || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${user.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-yellow-600 hover:text-yellow-800 text-sm p-1 hover:bg-yellow-50 rounded"
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => openPasswordModal(user)}
                          className="text-blue-600 hover:text-blue-800 text-sm p-1 hover:bg-blue-50 rounded"
                          title="Changer mot de passe"
                        >
                          🔑
                        </button>
                        <button
                          onClick={() => handleToggleActif(user)}
                          className={`text-sm p-1 rounded ${user.actif ? 'text-gray-600 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'}`}
                          title={user.actif ? 'Désactiver' : 'Activer'}
                        >
                          {user.actif ? '🚫' : '✅'}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
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

      {/* Modal création/modification */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {isEditing ? '✏️ Modifier l\'utilisateur' : '➕ Nouvel utilisateur'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe * (min. 8 caractères)
                  </label>
                  <input
                    type="password"
                    name="motDePasse"
                    value={formData.motDePasse}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    minLength={8}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="GESTIONNAIRE_IG">Gestionnaire IG</option>
                  <option value="SFD">SFD</option>
                  <option value="ASSUREUR">Assureur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              {formData.role === 'SFD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SFD rattaché *</label>
                  <select
                    name="sfdId"
                    value={formData.sfdId}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">-- Sélectionner un SFD --</option>
                    {sfds.map((s) => (
                      <option key={s._id} value={s._id}>{s.nom} ({s.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.role === 'ASSUREUR' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assureur rattaché *</label>
                  <select
                    name="assureurId"
                    value={formData.assureurId}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">-- Sélectionner un assureur --</option>
                    {assureurs.map((a) => (
                      <option key={a._id} value={a._id}>{a.nom} ({a.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="actif"
                  name="actif"
                  checked={formData.actif}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="actif" className="text-sm text-gray-700">
                  Compte actif
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  {isEditing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal changement de mot de passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">🔑 Changer le mot de passe</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Utilisateur : <strong>{passwordData.userNom}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau mot de passe *
                </label>
                <input
                  type="password"
                  value={passwordData.nouveauMotDePasse}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, nouveauMotDePasse: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  minLength={8}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmation *
                </label>
                <input
                  type="password"
                  value={passwordData.confirmation}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmation: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  minLength={8}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Utilisateurs;