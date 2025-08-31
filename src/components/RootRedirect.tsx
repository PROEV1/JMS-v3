import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export function RootRedirect() {
  const { user, loading } = useAuth();

  console.log('RootRedirect - user:', user?.email, 'loading:', loading);

  if (loading) {
    console.log('RootRedirect - showing loading spinner');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect based on authentication status
  const redirectTo = user ? '/admin' : '/auth';
  console.log('RootRedirect - redirecting to:', redirectTo);
  return <Navigate to={redirectTo} replace />;
}