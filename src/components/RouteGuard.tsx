import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles?: Array<'admin' | 'standard_office_user' | 'partner_user'>;
  redirectTo?: string;
}

export function RouteGuard({ 
  children, 
  allowedRoles,
  redirectTo 
}: RouteGuardProps) {
  const { user, finalRole, loading } = useAuth();
  const location = useLocation();

  // Show loading while auth is resolving
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect unauthenticated users to auth page
  if (!user) {
    // Save current path for redirect after auth
    const fullPath = location.pathname + location.search + location.hash;
    sessionStorage.setItem('authRedirectPath', fullPath);
    return <Navigate to="/auth" replace />;
  }

  // If no role resolved, something is wrong - redirect to auth
  if (!finalRole) {
    return <Navigate to="/auth" replace />;
  }

  // Check role-based access if allowedRoles is specified
  if (allowedRoles && !allowedRoles.includes(finalRole)) {
    const defaultRedirect = finalRole === 'partner_user' ? '/partner' : '/admin';
    return <Navigate to={redirectTo || defaultRedirect} replace />;
  }

  return <>{children}</>;
}