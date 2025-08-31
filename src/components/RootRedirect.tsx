import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect based on authentication status
  return user ? <Navigate to="/admin" replace /> : <Navigate to="/auth" replace />;
}