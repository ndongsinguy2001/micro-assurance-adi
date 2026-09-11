// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

/**
 * Normalise le user pour que sfdId et assureurId soient toujours des strings
 */
const normalizeUser = (rawUser) => {
  if (!rawUser) return null;
  return {
    ...rawUser,
    sfdId: rawUser.sfdId?._id || rawUser.sfdId || null,
    assureurId: rawUser.assureurId?._id || rawUser.assureurId || null,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(normalizeUser(response.data.data));
      setError(null);
    } catch (err) {
      console.error('Erreur chargement utilisateur:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, motDePasse) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/login', { email, motDePasse });
      const { token, user: rawUser } = response.data.data;
      const normalizedUser = normalizeUser(rawUser);

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      return { success: true, user: normalizedUser };
    } catch (err) {
      const message = err.response?.data?.message || 'Erreur de connexion';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};