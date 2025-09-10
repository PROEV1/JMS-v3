import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';

export function RootRedirect() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  console.log('🔍 ROOTREDIRECT - user:', user?.email, 'role:', role, 'loading:', loading, 'roleLoading:', roleLoading);
  
  // Add specific debugging for lee@proev.co.uk
  if (user?.email === 'lee@proev.co.uk') {
    console.log('🔍 LEE - RootRedirect triggered');
    console.log('🔍 LEE - Role detected:', role);  
    console.log('🔍 LEE - User metadata role:', user?.user_metadata?.role);
    console.log('🔍 LEE - Loading states:', {loading, roleLoading});
    console.log('🔍 LEE - Current URL:', window.location.href);
    
    // Clear any problematic saved paths
    console.log('🔍 LEE - Clearing potentially problematic saved paths');
    sessionStorage.removeItem('lastAuthenticatedPath');
    sessionStorage.removeItem('authRedirectPath');
    
    // Only redirect if we're on problematic paths, but not auth
    if (window.location.pathname === '/partner' && user) {
      console.log('🔍 LEE - FORCE REDIRECTING from /partner to /admin');
      window.location.href = '/admin';
      return null;
    }
  }

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

  // CRITICAL DEBUG: More aggressive logging
  console.log('🔥🔥🔥 ROOTREDIRECT ABOUT TO REDIRECT:', {
    email: user?.email,
    role,
    userMetadataRole: user?.user_metadata?.role,
    currentURL: window.location.href,
    timestamp: new Date().toISOString()
  });

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
  
  console.log('🔍 ROOTREDIRECT - redirecting to:', redirectTo, 'for user:', user?.email);
  
  // Extra logging for lee@proev.co.uk
  if (user?.email === 'lee@proev.co.uk') {
    console.log('🔍 LEE - About to redirect to:', redirectTo);
  }
  
  return <Navigate to={redirectTo} replace />;
}