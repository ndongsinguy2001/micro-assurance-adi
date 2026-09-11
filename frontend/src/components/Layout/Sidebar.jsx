// frontend/src/components/Layout/Sidebar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ✅ Menu avec rôles autorisés
  const menuItems = [
    {
      path: '/dashboard',
      icon: '📊',
      label: 'Tableau de bord',
      roles: ['ADMIN', 'GESTIONNAIRE_IG'],
    },
    {
      path: '/reportings',
      icon: '📋',
      label: 'Reportings',
      roles: ['ADMIN', 'GESTIONNAIRE_IG', 'SFD'],
    },
    {
      path: '/sinistres',
      icon: '🚨',
      label: 'Sinistres',
      roles: ['ADMIN', 'GESTIONNAIRE_IG', 'SFD'],
    },
    {
      path: '/sfd',
      icon: '🏦',
      label: 'SFD',
      roles: ['ADMIN', 'GESTIONNAIRE_IG'],
    },
    {
      path: '/assureurs',
      icon: '🏢',
      label: 'Assureurs',
      roles: ['ADMIN', 'GESTIONNAIRE_IG'],
    },
    {
      path: '/contrats',
      icon: '📜',
      label: 'Contrats',
      roles: ['ADMIN', 'GESTIONNAIRE_IG'],
    },
    {
      path: '/factures',
      icon: '📄',
      label: 'Factures',
      roles: ['ADMIN', 'GESTIONNAIRE_IG', 'SFD', 'ASSUREUR'],
    },
    {
      path: '/preuves-paiement',
      icon: '💰',
      label: 'Preuves de paiement',
      roles: ['ADMIN', 'GESTIONNAIRE_IG', 'SFD'],
    },
    {
      path: '/statistiques',
      icon: '📈',
      label: 'Statistiques',
      roles: ['ADMIN', 'GESTIONNAIRE_IG', 'ASSUREUR'],
    },
    {
      path: '/comptes-resultat',
      icon: '💰',
      label: 'Comptes de résultat',
      roles: ['ADMIN', 'GESTIONNAIRE_IG', 'ASSUREUR'],
    },
    {
      path: '/utilisateurs',
      icon: '👥',
      label: 'Utilisateurs',
      roles: ['ADMIN'],
    },
  ];

  // Filtrer selon le rôle
  const itemsFiltres = menuItems.filter((item) => item.roles.includes(user?.role));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-800 text-white z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-700">
          <span className="text-xl font-bold">🛡️ Micro-Assurance</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {itemsFiltres.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center px-6 py-3 mx-2 rounded-lg transition
                ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
              onClick={onClose}
            >
              <span className="text-xl mr-3">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {user?.nom?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.nom || 'Utilisateur'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role || 'Rôle'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition"
          >
            <span>🚪</span> Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;