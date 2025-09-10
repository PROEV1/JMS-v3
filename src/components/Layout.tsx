
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ProEVLogo } from '@/components/ProEVLogo';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading, signOut } = useAuth();
  const { role: userRole, loading: roleLoading } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();

  // Persist current path for redirect after auth (including search params and hash)
  useEffect(() => {
    if (user) {
      const fullPath = location.pathname + location.search + location.hash;
      console.log('Layout: Persisting current authenticated path:', fullPath);
      
      // HARDENED: Only persist if it's a meaningful deep path, not just section roots
      const sectionRoots = ['/admin', '/client', '/engineer'];
      const isNotJustSectionRoot = !sectionRoots.includes(location.pathname);
      // Also persist order detail pages and other deep paths
      const isDeepPath = isNotJustSectionRoot || location.pathname.match(/^\/orders\/[^\/]+$/);
      
      if (isDeepPath) {
        console.log('Layout: Persisting deep path:', fullPath);
        sessionStorage.setItem('lastAuthenticatedPath', fullPath);
      } else {
        console.log('Layout: Skipping section root persistence:', fullPath);
      }
    }
  }, [location, user]);

  // STRENGTHENED Self-heal mechanism: restore user to exact page after refresh redirect
  useEffect(() => {
    if (user && userRole) {
      const currentPath = location.pathname;
      const savedPath = sessionStorage.getItem('lastAuthenticatedPath');
      
      // Check if navigation was explicitly bypassed (user clicked Dashboard)
      const bypassRestore = location.state?.bypassRestore;
      if (bypassRestore) {
        console.log('Layout: Bypassing self-heal due to explicit dashboard navigation');
        return;
      }
      
      // Define section roots that might be default redirects
      const sectionRoots = ['/admin', '/client', '/engineer'];
      
      // Check if we're on a section root and have a saved deeper path
      const isOnSectionRoot = sectionRoots.includes(currentPath);
      const hasSavedDeepPath = savedPath && savedPath !== currentPath;
      
      // Also handle cases where user was on an order page but got redirected to admin
      const wasOnOrderPage = savedPath && savedPath.match(/^\/orders\/[^\/]+$/);
      const isOnAdminRoot = currentPath === '/admin';
      
      if ((isOnSectionRoot && hasSavedDeepPath && savedPath.startsWith(currentPath + '/')) || 
          (wasOnOrderPage && isOnAdminRoot)) {
        console.log('Layout: STRENGTHENED Self-heal detected - redirecting from', currentPath, 'to saved path:', savedPath);
        
        // Navigate to the saved deeper path
        navigate(savedPath, { replace: true });
        
        // Clear the saved path ONLY after successful navigation to prevent loops
        setTimeout(() => {
          console.log('Layout: Clearing lastAuthenticatedPath after successful navigation');
          sessionStorage.removeItem('lastAuthenticatedPath');
        }, 100);
      }
    }
  }, [user, userRole, location.pathname, location.state, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Save current path for redirect after auth (including search params and hash)
    const fullPath = location.pathname + location.search + location.hash;
    console.log('Layout: Saving current path for redirect after auth:', fullPath);
    sessionStorage.setItem('authRedirectPath', fullPath);
    return <Navigate to="/auth" replace />;
  }

  // Centralized role-based routing and protection
  const currentPath = location.pathname;
  console.log('Layout: Current path:', currentPath, 'User role:', userRole, 'User ID:', user?.id);
  
  // DEBUGGING: Check if there's a role mismatch
  if (userRole === 'partner' && currentPath.startsWith('/client')) {
    console.warn('⚠️ Role mismatch detected: Partner user accessing client route', {
      userRole,
      currentPath,
      userEmail: user?.email,
      userId: user?.id
    });
  }
  
  // CRITICAL FIX: Special handling for lee@proev.co.uk
  if (user?.email === 'lee@proev.co.uk') {
    console.log('🔥 LAYOUT - Lee detected:', {
      email: user?.email,
      userRole,
      currentPath,
      shouldBeAdmin: userRole === 'standard_office_user' || userRole === 'admin'
    });
    
    // Force lee to admin section regardless of other conditions
    if (currentPath === '/' || currentPath === '/partner') {
      console.log('🔥 LAYOUT - Force redirecting Lee to /admin from:', currentPath);
      return <Navigate to="/admin" replace />;
    }
  }

  // Handle root path - redirect to role-appropriate section
  if (currentPath === '/') {
    let redirectTo = '/client'; // default fallback
    
    if (userRole === 'partner') {
      redirectTo = '/partner';
    } else if (userRole === 'admin' || userRole === 'manager' || userRole === 'standard_office_user') {
      redirectTo = '/admin';
    } else if (userRole === 'engineer') {
      redirectTo = '/engineer';
    } else if (userRole === 'client') {
      redirectTo = '/client';
    }
    
    console.log(`Layout: Redirecting from root to ${redirectTo} for role ${userRole}`);
    return <Navigate to={redirectTo} replace />;
  }
  
  // Partner users should be able to access client routes if they're viewing their own data
  // CRITICAL FIX: Don't redirect partners who are accessing client order views
  // ALSO: Don't redirect lee@proev.co.uk to partner
  if (userRole === 'partner' && 
      user?.email !== 'lee@proev.co.uk' &&
      !currentPath.startsWith('/partner') && 
      !currentPath.startsWith('/client') && 
      !currentPath.startsWith('/survey') && 
      !currentPath.startsWith('/offers') && 
      !currentPath.startsWith('/quotes') &&
      !currentPath.startsWith('/dashboard') && 
      currentPath !== '/') {
    console.log('Layout: Partner user accessing restricted route, redirecting to /partner');
    return <Navigate to="/partner" replace />;
  }
  
  // Protect admin routes (including /orders/:id) - only admin/manager/standard_office_user can access
  if (currentPath.startsWith('/admin') || currentPath.match(/^\/orders\/[^\/]+$/)) {
    if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'standard_office_user') {
      const redirectTo = userRole === 'engineer' ? '/engineer' : userRole === 'partner' ? '/partner' : '/client';
      console.log(`Layout: ${userRole} accessing admin route, redirecting to ${redirectTo}`);
      return <Navigate to={redirectTo} replace />;
    }
  }
  
  // Protect client routes from non-clients (but allow partners to access)
  if (userRole !== 'client' && userRole !== 'partner' && currentPath.startsWith('/client')) {
    const redirectTo = userRole === 'admin' ? '/admin' : userRole === 'engineer' ? '/engineer' : '/partner';
    console.log(`Layout: ${userRole} accessing client route, redirecting to ${redirectTo}`);
    return <Navigate to={redirectTo} replace />;
  }

  // Protect engineer routes from non-engineers
  if (userRole !== 'engineer' && currentPath.startsWith('/engineer')) {
    const redirectTo = userRole === 'admin' ? '/admin' : userRole === 'partner' ? '/partner' : '/client';
    console.log(`Layout: ${userRole} accessing engineer route, redirecting to ${redirectTo}`);
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar userRole={userRole || 'client'} />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center border-b bg-white shadow-md px-4">
            <SidebarTrigger className="mr-4" />
            <ProEVLogo size="md" />
            
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <span>{user?.email}</span>
                {userRole && (
                  <span className="text-xs text-muted-foreground">({userRole})</span>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </header>
          
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
