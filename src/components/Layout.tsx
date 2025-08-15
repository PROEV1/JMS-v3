
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, FileText, MessageCircle, FolderOpen, Users, Package, ChevronDown, ShoppingCart, UserCog, Calendar, Clock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { ProEVLogo } from '@/components/ProEVLogo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  const { canManageUsers } = usePermissions();

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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-teal"></div>
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-teal"></div>
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

  const adminMenuItems = [
    { icon: FileText, label: 'Dashboard', href: '/dashboard', action: () => navigate('/dashboard') },
    { icon: FileText, label: 'Quotes', href: '/admin/quotes', action: () => navigate('/admin/quotes') },
    { icon: ShoppingCart, label: 'Orders', href: '/admin/orders', action: () => navigate('/admin/orders') },
    { icon: Calendar, label: 'Schedule', href: '/admin/schedule', action: () => navigate('/admin/schedule') },
    { icon: User, label: 'Engineers', href: '/admin/engineers', action: () => navigate('/admin/engineers') },
    { icon: Users, label: 'Clients', href: '/admin/clients', action: () => navigate('/admin/clients') },
    { icon: Users, label: 'Leads', href: '/admin/leads', action: () => navigate('/admin/leads') },
    { icon: Package, label: 'Products', href: '/admin/products', action: () => navigate('/admin/products') },
    { icon: MessageCircle, label: 'Messages', href: '/admin/messages', action: () => navigate('/admin/messages') },
    ...(canManageUsers ? [{ icon: UserCog, label: 'Users', href: '/admin/users', action: () => navigate('/admin/users') }] : []),
    { icon: Settings, label: 'Settings', href: '/admin/settings', action: () => navigate('/admin/settings') },
  ];

  const clientMenuItems = [
    { icon: FileText, label: 'Dashboard', href: '/client', action: () => { navigate('/client'); window.history.replaceState(null, '', '/client'); window.dispatchEvent(new HashChangeEvent('hashchange')); } },
    { icon: FileText, label: 'Quotes', href: '/client#quotes', action: () => { navigate('/client'); setTimeout(() => window.location.hash = 'quotes', 0); } },
    { icon: Calendar, label: 'Availability', href: '/client/date-blocking', action: () => navigate('/client/date-blocking') },
    { icon: MessageCircle, label: 'Messages', href: '/client#messages', action: () => { navigate('/client'); setTimeout(() => window.location.hash = 'messages', 0); } },
    { icon: FolderOpen, label: 'Documents', href: '/client#documents', action: () => { navigate('/client'); setTimeout(() => window.location.hash = 'documents', 0); } },
    { icon: User, label: 'Profile', href: '/client#profile', action: () => { navigate('/client'); setTimeout(() => window.location.hash = 'profile', 0); } },
  ];

  const engineerMenuItems = [
    { icon: FileText, label: 'Dashboard', href: '/engineer', action: () => navigate('/engineer') },
    { icon: FolderOpen, label: 'My Jobs', href: '/engineer', action: () => {
      console.log('My Jobs clicked - refreshing engineer dashboard');
      navigate('/engineer');
      // Force a page refresh to reload all data
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }},
    { icon: Clock, label: 'Availability', href: '/engineer/availability', action: () => navigate('/engineer/availability') },
    { icon: User, label: 'Profile', href: '/engineer/profile', action: () => navigate('/engineer/profile') },
  ];

  const menuItems = userRole === 'admin' ? adminMenuItems : userRole === 'engineer' ? engineerMenuItems : clientMenuItems;
  const dashboardLink = userRole === 'admin' ? '/dashboard' : userRole === 'engineer' ? '/engineer' : '/client';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to={dashboardLink} className="flex items-center">
              <ProEVLogo variant="main" size="md" />
            </Link>
            
            {/* Navigation Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 hover:bg-brand-teal/10 hover:text-brand-teal">
                  <span className="brand-body font-medium">Menu</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-white border border-border shadow-lg z-50">
                {menuItems.map((item, index) => (
                  <DropdownMenuItem key={index} asChild>
                    <button
                      onClick={item.action}
                      className={`flex items-center space-x-3 px-3 py-2 text-sm transition-colors hover:bg-brand-teal/10 hover:text-brand-teal brand-body w-full text-left ${
                        location.pathname === item.href || 
                        (item.href.includes('#') && location.pathname === item.href.split('#')[0] && window.location.hash === '#' + item.href.split('#')[1])
                          ? 'bg-brand-teal/10 text-brand-teal font-semibold' 
                          : 'text-muted-foreground'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground brand-body">
              <User className="h-4 w-4" />
              <span>{user.email}</span>
              <span className="text-xs bg-brand-cream px-2 py-1 rounded text-primary">({userRole})</span>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="hover:bg-brand-teal hover:text-white">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto py-6">
        {children}
      </main>
    </div>
  );
}
