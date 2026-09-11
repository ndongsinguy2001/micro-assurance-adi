// frontend/src/App.jsx
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reportings from './pages/Reportings';
import Sinistres from './pages/Sinistres';
import SFDList from './pages/SFDList';
import Assureurs from './pages/Assureurs';
import Contrats from './pages/Contrats';
import Factures from './pages/Factures';
import PreuvesPaiement from './pages/PreuvesPaiement';
import Statistiques from './pages/Statistiques';
import ComptesResultat from './pages/ComptesResultat';
import Utilisateurs from './pages/Utilisateurs';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout>
                <Outlet />
              </Layout>
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportings"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG', 'SFD']}>
                <Reportings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sinistres"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG', 'SFD']}>
                <Sinistres />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sfd"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG']}>
                <SFDList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assureurs"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG']}>
                <Assureurs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contrats"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG']}>
                <Contrats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/factures"
            element={
              <ProtectedRoute
                requiredRoles={['ADMIN', 'GESTIONNAIRE_IG', 'SFD', 'ASSUREUR']}
              >
                <Factures />
              </ProtectedRoute>
            }
          />
          <Route
            path="/preuves-paiement"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'GESTIONNAIRE_IG', 'SFD']}>
                <PreuvesPaiement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistiques"
            element={
              <ProtectedRoute
                requiredRoles={['ADMIN', 'GESTIONNAIRE_IG', 'ASSUREUR']}
              >
                <Statistiques />
              </ProtectedRoute>
            }
          />
          <Route
            path="/comptes-resultat"
            element={
              <ProtectedRoute
                requiredRoles={['ADMIN', 'GESTIONNAIRE_IG', 'ASSUREUR']}
              >
                <ComptesResultat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/utilisateurs"
            element={
              <ProtectedRoute requiredRoles={['ADMIN']}>
                <Utilisateurs />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;