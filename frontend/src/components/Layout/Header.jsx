// frontend/src/components/Layout/Header.jsx
import React from 'react';

const Header = ({ toggleSidebar }) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Bouton menu mobile */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition"
        aria-label="Menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-800">Plateforme de gestion</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 hidden sm:inline">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </span>
        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
          IG
        </span>
      </div>
    </header>
  );
};

export default Header;