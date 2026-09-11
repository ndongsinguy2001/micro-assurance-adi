// frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsLoading(true);

    // Validation simple
    if (!email || !motDePasse) {
      setLocalError('Email et mot de passe sont requis');
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(email, motDePasse);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setLocalError(result.error || 'Erreur de connexion');
      }
    } catch (err) {
      setLocalError('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🛡️</div>
          <h1 className="text-2xl font-bold text-gray-800">Micro-Assurance ADI</h1>
          <p className="text-gray-500 text-sm mt-1">Plateforme de gestion</p>
        </div>

        {/* Erreur */}
        {(localError || authError) && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
            {localError || authError}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
              placeholder="exemple@email.com"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              id="motDePasse"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 rounded-lg text-white font-medium transition ${
              isLoading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connexion en cours...
              </span>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        {/* Pied de page */}
        <div className="mt-6 text-center text-sm text-gray-400 border-t border-gray-100 pt-4">
          <p>© 2026 Inclusive Guarantee - Sénégal</p>
        </div>
      </div>
    </div>
  );
};

export default Login;