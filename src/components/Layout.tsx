
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
      
      if (isNotJustSectionRoot) {
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
      
      // Define section roots that might be default redirects
      const sectionRoots = ['/admin', '/client', '/engineer'];
      
      // Check if we're on a section root and have a saved deeper path
      const isOnSectionRoot = sectionRoots.includes(currentPath);
      const hasSavedDeepPath = savedPath && savedPath !== currentPath && savedPath.startsWith(currentPath + '/');
      
      if (isOnSectionRoot && hasSavedDeepPath) {
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
  }, [user, userRole, location.pathname, navigate]);

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

  // Role-based route protection
  const currentPath = location.pathname;
  console.log('Layout: Current path:', currentPath, 'User role:', userRole);
  
  // Redirect partner users to partner portal if they're not already there
  if (userRole === 'partner' && !currentPath.startsWith('/partner')) {
    console.log('Layout: Partner user accessing non-partner route, redirecting to /partner');
    return <Navigate to="/partner" replace />;
  }
  
  // Protect admin routes from non-admins (but allow admins to access /dashboard)
  if (userRole !== 'admin' && userRole !== 'manager' && currentPath.startsWith('/admin')) {
    const redirectTo = userRole === 'engineer' ? '/engineer' : userRole === 'partner' ? '/partner' : '/client';
    console.log(`Layout: ${userRole} accessing admin route, redirecting to ${redirectTo}`);
    return <Navigate to={redirectTo} replace />;
  }
  
  // Protect client routes from non-clients
  if (userRole !== 'client' && (currentPath.startsWith('/client') || 
      (userRole === 'admin' && ['/quotes', '/orders', '/messages', '/documents', '/payments', '/date-blocking', '/profile'].includes(currentPath)))) {
    const redirectTo = userRole === 'admin' ? '/admin' : userRole === 'engineer' ? '/engineer' : '/partner';
    console.log(`Layout: ${userRole} accessing client route, redirecting to ${redirectTo}`);
    return <Navigate to={redirectTo} replace />;
  }

  // Protect engineer routes from non-engineers
  if (userRole !== 'engineer' && (currentPath.startsWith('/engineer') ||
      (userRole === 'admin' && ['/availability', '/profile'].includes(currentPath)) ||
      (userRole === 'client' && ['/availability', '/profile'].includes(currentPath)))) {
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
