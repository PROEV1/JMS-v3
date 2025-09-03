import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';

export function RootRedirect() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  console.log('RootRedirect - user:', user?.email, 'role:', role, 'loading:', loading, 'roleLoading:', roleLoading);

  if (loading || roleLoading) {
    console.log('RootRedirect - showing loading spinner');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('RootRedirect - no user, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Redirect based on user role
  let redirectTo = '/admin'; // Default fallback
  
  switch (role) {
    case 'admin':
    case 'manager':
    case 'standard_office_user':
      redirectTo = '/admin';
      break;
    case 'client':
      redirectTo = '/client';
      break;
    case 'engineer':
      redirectTo = '/engineer';
      break;
    case 'partner':
      redirectTo = '/partner';
      break;
    default:
      // If no role found, default to admin but this might need adjustment
      redirectTo = '/admin';
  }
  
  console.log('RootRedirect - redirecting to:', redirectTo);
  return <Navigate to={redirectTo} replace />;
}