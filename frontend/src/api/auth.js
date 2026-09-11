// frontend/src/api/auth.js
import api from './axios';

export const authAPI = {
  // Connexion
  login: (email, motDePasse) => 
    api.post('/auth/login', { email, motDePasse }),
  
  // Inscription
  register: (userData) => 
    api.post('/auth/register', userData),
  
  // Récupérer le profil
  getMe: () => 
    api.get('/auth/me'),
  
  // Déconnexion
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userData');
  },
};