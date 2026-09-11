// frontend/src/pages/PreuvesPaiement.jsx
import React, { useState, useEffect } from 'react';
import { preuvePaiementAPI } from '../api/preuvePaiement';
import { sfdAPI } from '../api/sfd';
import { assureurAPI } from '../api/assureur';

const PreuvesPaiement = () => {
  const [preuves, setPreuves] = useState([]);
  const [sfds, setSfds] = useState([]);
  const [assureurs, setAssureurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [filter, setFilter] = useState({ type: '', statut: '', sfdId: '' });
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'SFD_VERS_ASSUREUR',
    sfdId: '',
    assureurId: '',
    montant: '',
    datePaiement: new Date().toISOString().split('T')[0],
    referencePaiement: '',
    mois: '',
    annee: new Date().getFullYear(),
    commentaire: '',
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    loadRefs();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.type) params.type = filter.type;
      if (filter.statut) params.statut = filter.statut;
      if (filter.sfdId) params.sfdId = filter.sfdId;
      const res = await preuvePaiementAPI.getAll(params);
      setPreuves(res.data.data || []);
    } catch (err) {
      setError('Impossible de charger les preuves');
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
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.montant || !formData.datePaiement) {
      setError('Montant et date obligatoires');
      return;
    }

    try {
      setSaving(true);
      await preuvePaiementAPI.create(formData, file);
      setSuccess('✅ Preuve enregistrée');
      setShowModal(false);
      setFile(null);
      setFormData({
        type: 'SFD_VERS_ASSUREUR',
        sfdId: '',
        assureurId: '',
        montant: '',
        datePaiement: new Date().toISOString().split('T')[0],
        referencePaiement: '',
        mois: '',
        annee: new Date().getFullYear(),
        commentaire: '',
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifier = async (id, statut) => {
    let commentaire = '';
    if (statut === 'REJETEE') {
      commentaire = prompt('Motif du rejet :') || '';
      if (!commentaire) return;
    }
    if (!window.confirm(`Confirmer ${statut === 'VERIFIEE' ? 'la vérification' : 'le rejet'} ?`))
      return;

    try {
      await preuvePaiementAPI.verifier(id, { statut, commentaire });
      setSuccess('✅ Statut mis à jour');
      await loadData();
    } catch (err) {
      setError('Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette preuve ?')) return;
    try {
      await preuvePaiementAPI.delete(id);
      setSuccess('✅ Supprimée');
      await loadData();
    } catch (err) {
      setError('Erreur');
    }
  };

  const getStatusColor = (s) => {
    const c = {
      RECUE: 'bg-yellow-100 text-yellow-600',
      VERIFIEE: 'bg-green-100 text-green-600',
      REJETEE: 'bg-red-100 text-red-600',
    };
    return c[s] || 'bg-gray-100 text-gray-600';
  };

  const getTypeLabel = (t) => {
    const l = {
      SFD_VERS_ASSUREUR: 'SFD → Assureur',
      ASSUREUR_VERS_IG: 'Assureur → IG',
      ASSUREUR_VERS_SFD: 'Assureur → SFD',
    };
    return l[t] || t;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">💰 Preuves de paiement</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          ➕ Enregistrer une preuve
        </button>
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

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="text-sm text-gray-600 block mb-1">Type</label>
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            <option value="SFD_VERS_ASSUREUR">SFD → Assureur</option>
            <option value="ASSUREUR_VERS_IG">Assureur → IG</option>
            <option value="ASSUREUR_VERS_SFD">Assureur → SFD</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">Statut</label>
          <select
            value={filter.statut}
            onChange={(e) => setFilter({ ...filter, statut: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            <option value="RECUE">Reçue</option>
            <option value="VERIFIEE">Vérifiée</option>
            <option value="REJETEE">Rejetée</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1">SFD</label>
          <select
            value={filter.sfdId}
            onChange={(e) => setFilter({ ...filter, sfdId: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {sfds.map((s) => (
              <option key={s._id} value={s._id}>{s.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : preuves.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-2">💰</p>
            <p>Aucune preuve enregistrée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SFD / Assureur</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preuves.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(p.datePaiement).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getTypeLabel(p.type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.sfdId?.nom || p.assureurId?.nom || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-800 font-medium">
                      {new Intl.NumberFormat('fr-FR').format(p.montant)} {p.devise}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {p.referencePaiement || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(p.statut)}`}>
                        {p.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {p.fichier?.chemin && (
                          <a
                            href={preuvePaiementAPI.getFichierUrl(p._id)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm p-1"
                            title="Voir le fichier"
                          >
                            📎
                          </a>
                        )}
                        {p.statut === 'RECUE' && (
                          <>
                            <button
                              onClick={() => handleVerifier(p._id, 'VERIFIEE')}
                              className="text-green-600 hover:text-green-800 text-sm p-1"
                              title="Vérifier"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => handleVerifier(p._id, 'REJETEE')}
                              className="text-red-600 hover:text-red-800 text-sm p-1"
                              title="Rejeter"
                            >
                              ❌
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(p._id)}
                          className="text-gray-400 hover:text-red-600 text-sm p-1"
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

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">💰 Nouvelle preuve de paiement</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-2xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="SFD_VERS_ASSUREUR">SFD → Assureur</option>
                  <option value="ASSUREUR_VERS_IG">Assureur → IG</option>
                  <option value="ASSUREUR_VERS_SFD">Assureur → SFD</option>
                </select>
              </div>

              {formData.type.includes('SFD') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SFD</label>
                  <select
                    value={formData.sfdId}
                    onChange={(e) => setFormData({ ...formData, sfdId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">--</option>
                    {sfds.map((s) => (
                      <option key={s._id} value={s._id}>{s.nom}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assureur</label>
                <select
                  value={formData.assureurId}
                  onChange={(e) => setFormData({ ...formData, assureurId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">--</option>
                  {assureurs.map((a) => (
                    <option key={a._id} value={a._id}>{a.nom}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
                  <input
                    type="number"
                    value={formData.montant}
                    onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.datePaiement}
                    onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mois concerné</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.mois}
                    onChange={(e) => setFormData({ ...formData, mois: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                  <input
                    type="number"
                    value={formData.annee}
                    onChange={(e) => setFormData({ ...formData, annee: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence paiement</label>
                <input
                  type="text"
                  value={formData.referencePaiement}
                  onChange={(e) => setFormData({ ...formData, referencePaiement: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fichier (PDF, image, Excel)</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                  className="w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                <textarea
                  value={formData.commentaire}
                  onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                  rows="2"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:bg-blue-400"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreuvesPaiement;