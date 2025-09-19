import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  FileText, 
  Settings, 
  Calendar,
  MessageSquare,
  ShoppingCart,
  Package,
  UserCheck,
  ClipboardList,
  Home,
  User,
  Clock,
  MessageCircle,
  FolderOpen,
  UserCog,
  CreditCard,
  FormInput,
  Zap,
  FileCheck,
  Warehouse,
  Truck
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { usePermissions } from '@/hooks/usePermissions';

interface AppSidebarProps {
  userRole: string;
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { canManageUsers } = usePermissions();
  
  // Debug logging for role and permissions
  console.log('AppSidebar render:', { userRole, canManageUsers });

  // Define navigation items based on user role - keeping exact same functionality as original Layout
  const adminMenuItems = [
    { icon: Home, label: 'Dashboard', href: '/admin' },
    { icon: FileText, label: 'Quotes', href: '/admin/quotes' },
    { icon: BarChart3, label: 'Quote Dashboard', href: '/ops/quotes' },
    { icon: ShoppingCart, label: 'Orders', href: '/admin/orders' },
    { icon: Calendar, label: 'Schedule', href: '/admin/schedule' },
    { icon: FileCheck, label: 'QA Review', href: 'https://main.d11c44f8r7qjmh.amplifyapp.com/dashboard', external: true },
    { icon: FormInput, label: 'Surveys', href: '/admin/survey-forms' },
    { icon: Package, label: 'Inventory', href: '/admin/inventory' },
    { icon: Zap, label: 'Chargers', href: '/admin/chargers' },
    { icon: Truck, label: 'Dispatch', href: '/admin/dispatch' },
    { icon: User, label: 'Engineers', href: '/admin/engineers' },
    { icon: Users, label: 'Clients', href: '/admin/clients' },
    { icon: Users, label: 'Leads', href: '/admin/leads' },
    { icon: Package, label: 'Products', href: '/admin/products' },
    { icon: MessageCircle, label: 'Messages', href: '/admin/messages' },
    { icon: Users, label: 'Partners', href: '/admin/partners' },
    ...(canManageUsers ? [{ icon: UserCog, label: 'Users', href: '/admin/users' }] : []),
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  const clientMenuItems = [
    { icon: Home, label: 'Dashboard', href: '/client' },
    { icon: FileText, label: 'Quotes', href: '/client/quotes' },
    { icon: ShoppingCart, label: 'Orders', href: '/client/orders' },
    { icon: MessageCircle, label: 'Messages', href: '/client/messages' },
    { icon: FolderOpen, label: 'Documents', href: '/client/documents' },
    { icon: CreditCard, label: 'Payments', href: '/client/payments' },
    { icon: Calendar, label: 'Availability', href: '/client/date-blocking' },
    { icon: User, label: 'Profile', href: '/client/profile' },
  ];

  const engineerMenuItems = [
    { icon: FileText, label: 'Dashboard', href: '/engineer' },
    { icon: FolderOpen, label: 'My Jobs', href: '/engineer/jobs' },
    { icon: Package, label: 'Stock Requests', href: '/engineer/stock-requests' },
    { icon: Warehouse, label: 'Van Inventory', href: '/engineer/van-stock' },
    { icon: User, label: 'Profile', href: '/engineer/profile' },
  ];

  // Select appropriate menu items based on user role
  let menuItems = [];
  let groupLabel = '';

  if (userRole === 'admin') {
    menuItems = adminMenuItems;
    groupLabel = 'Admin';
  } else if (userRole === 'client') {
    menuItems = clientMenuItems;
    groupLabel = 'Client';
  } else if (userRole === 'engineer') {
    menuItems = engineerMenuItems;
    groupLabel = 'Engineer';
  } else if (userRole === 'partner') {
    // Partner users don't use the sidebar - they have their own portal interface
    menuItems = [];
    groupLabel = 'Partner';
  }

  const isActive = (item: any) => {
    // Exact match for dashboard routes
    if (item.href === '/admin' || item.href === '/client' || item.href === '/engineer') {
      return location.pathname === item.href;
    }
    // For other routes, check exact match or if it's a sub-route
    return location.pathname === item.href || 
      (item.href !== '/' && location.pathname.startsWith(item.href + '/'));
  };

  return (
    <Sidebar className="w-60" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => (
                <SidebarMenuItem key={index}>
                  {item.external ? (
                    <SidebarMenuButton 
                      onClick={() => window.open(item.href, '_blank')}
                      className="hover:bg-accent/50"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild>
                      <Link
                        to={item.href}
                        state={item.label === 'Dashboard' ? { bypassRestore: true } : undefined}
                        className={isActive(item) 
                          ? "bg-accent text-accent-foreground font-medium" 
                          : "hover:bg-accent/50"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
