
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ProEVLogo } from '@/components/ProEVLogo';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setRoleLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      console.log('Layout: Fetching role for user:', user?.id);
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user?.id)
        .single();
      
      console.log('Layout: User profile data:', data);
      
      if (data) {
        setUserRole(data.role);
        console.log('Layout: Set user role to:', data.role);
      }
    } catch (error) {
      console.error('Layout: Error fetching user role:', error);
      setUserRole('client'); // Default to client on error
    } finally {
      setRoleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show loading while we fetch the user role
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only do role-based protection after user role is fully loaded
  const currentPath = location.pathname;
  console.log('Layout: Current path:', currentPath, 'User role:', userRole);
  
  // Only apply route protection if userRole is set (not loading)
  if (userRole) {
    // Protect admin routes from non-admins
    if (userRole !== 'admin' && (currentPath.startsWith('/admin') || currentPath === '/dashboard')) {
      const redirectTo = userRole === 'engineer' ? '/engineer' : '/client';
      console.log(`Layout: ${userRole} accessing admin route, redirecting to ${redirectTo}`);
      return <Navigate to={redirectTo} replace />;
    }
    
    // Protect client routes from non-clients
    if (userRole !== 'client' && currentPath === '/client') {
      const redirectTo = userRole === 'admin' ? '/dashboard' : '/engineer';
      console.log(`Layout: ${userRole} accessing client route, redirecting to ${redirectTo}`);
      return <Navigate to={redirectTo} replace />;
    }

    // Protect engineer routes from non-engineers
    if (userRole !== 'engineer' && currentPath.startsWith('/engineer')) {
      const redirectTo = userRole === 'admin' ? '/dashboard' : '/client';
      console.log(`Layout: ${userRole} accessing engineer route, redirecting to ${redirectTo}`);
      return <Navigate to={redirectTo} replace />;
    }
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
