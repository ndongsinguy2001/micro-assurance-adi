// frontend/src/components/Layout/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute - protège une route selon :
 *   - authentification
 *   - rôle(s) autorisé(s) optionnel(s)
 *
 * @param {ReactNode} children
 * @param {string[]} [requiredRoles] - rôles autorisés
 * @param {boolean} [allowAdminBypass=true] - ADMIN passe toujours
 */
const ProtectedRoute = ({
  children,
  requiredRoles = null,
  allowAdminBypass = true,
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const role = user?.role;
    const isAllowed =
      requiredRoles.includes(role) || (allowAdminBypass && role === 'ADMIN');

    if (!isAllowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;