import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  CreditCard
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
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { canManageUsers } = usePermissions();

  // Define navigation items based on user role - keeping exact same functionality as original Layout
  const adminMenuItems = [
    { icon: Home, label: 'Dashboard', href: '/admin', action: () => navigate('/admin') },
    { icon: FileText, label: 'Quotes', href: '/admin/quotes', action: () => navigate('/admin/quotes') },
    { icon: ShoppingCart, label: 'Orders', href: '/admin/orders', action: () => navigate('/admin/orders') },
    { icon: Calendar, label: 'Schedule', href: '/admin/schedule', action: () => navigate('/admin/schedule') },
    { icon: Package, label: 'Inventory', href: '/admin/inventory', action: () => navigate('/admin/inventory') },
    { icon: User, label: 'Engineers', href: '/admin/engineers', action: () => navigate('/admin/engineers') },
    { icon: Users, label: 'Clients', href: '/admin/clients', action: () => navigate('/admin/clients') },
    { icon: Users, label: 'Leads', href: '/admin/leads', action: () => navigate('/admin/leads') },
    { icon: Package, label: 'Products', href: '/admin/products', action: () => navigate('/admin/products') },
    { icon: MessageCircle, label: 'Messages', href: '/admin/messages', action: () => navigate('/admin/messages') },
    { icon: Users, label: 'Partners', href: '/admin/partners', action: () => navigate('/admin/partners') },
    ...(canManageUsers ? [{ icon: UserCog, label: 'Users', href: '/admin/users', action: () => navigate('/admin/users') }] : []),
    { icon: Settings, label: 'Settings', href: '/admin/settings', action: () => navigate('/admin/settings') },
  ];

  const clientMenuItems = [
    { icon: Home, label: 'Dashboard', href: '/client', action: () => navigate('/client') },
    { icon: FileText, label: 'Quotes', href: '/client/quotes', action: () => navigate('/client/quotes') },
    { icon: ShoppingCart, label: 'Orders', href: '/client/orders', action: () => navigate('/client/orders') },
    { icon: MessageCircle, label: 'Messages', href: '/client/messages', action: () => navigate('/client/messages') },
    { icon: FolderOpen, label: 'Documents', href: '/client/documents', action: () => navigate('/client/documents') },
    { icon: CreditCard, label: 'Payments', href: '/client/payments', action: () => navigate('/client/payments') },
    { icon: Calendar, label: 'Availability', href: '/client/date-blocking', action: () => navigate('/client/date-blocking') },
    { icon: User, label: 'Profile', href: '/client/profile', action: () => navigate('/client/profile') },
  ];

  const engineerMenuItems = [
    { icon: FileText, label: 'Dashboard', href: '/engineer', action: () => navigate('/engineer') },
    { icon: FolderOpen, label: 'My Jobs', href: '/engineer/jobs', action: () => navigate('/engineer/jobs') },
    { icon: Package, label: 'Stock Requests', href: '/engineer/stock-requests', action: () => navigate('/engineer/stock-requests') },
    { icon: User, label: 'Profile', href: '/engineer/profile', action: () => navigate('/engineer/profile') },
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
  }

  const isActive = (item: any) => {
    return location.pathname === item.href || 
      (item.href !== '/' && location.pathname.startsWith(item.href));
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
                  <SidebarMenuButton 
                    onClick={item.action}
                    className={isActive(item) 
                      ? "bg-accent text-accent-foreground font-medium" 
                      : "hover:bg-accent/50"
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
