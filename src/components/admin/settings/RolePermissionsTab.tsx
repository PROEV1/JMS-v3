import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Eye, 
  Edit, 
  X, 
  Check,
  Home,
  FileText,
  BarChart3,
  ShoppingCart,
  Calendar,
  Package,
  User,
  Users,
  Settings,
  MessageCircle,
  FolderOpen,
  CreditCard,
  UserCog,
  FileCheck,
  FormInput,
  Zap,
  Warehouse,
  Clock,
  LucideIcon
} from 'lucide-react';

interface RoleAccess {
  level: 'none' | 'read' | 'write' | 'full';
  permissions?: string[];
}

interface PageAccess {
  page: string;
  icon: LucideIcon;
  category: string;
  admin: RoleAccess;
  manager: RoleAccess;
  standard_office_user: RoleAccess;
  engineer: RoleAccess;
  client: RoleAccess;
  partner: RoleAccess;
  description: string;
}

const ACCESS_LEVELS = {
  none: { color: 'destructive', icon: X, label: 'No Access' },
  read: { color: 'outline', icon: Eye, label: 'Read Only' },
  write: { color: 'secondary', icon: Edit, label: 'Read & Write' },
  full: { color: 'default', icon: Check, label: 'Full Access' }
} as const;

const PAGE_PERMISSIONS: PageAccess[] = [
  // Dashboard & Analytics
  {
    page: 'Admin Dashboard',
    icon: Home,
    category: 'Dashboard & Analytics',
    admin: { level: 'full', permissions: ['*'] },
    manager: { level: 'full', permissions: ['*'] },
    standard_office_user: { level: 'read', permissions: ['dashboard.view'] },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Main administrative dashboard with system overview'
  },
  {
    page: 'Quote Dashboard',
    icon: BarChart3,
    category: 'Dashboard & Analytics',
    admin: { level: 'full', permissions: ['quotes.manage'] },
    manager: { level: 'full', permissions: ['quotes.manage'] },
    standard_office_user: { level: 'read', permissions: ['quotes.view'] },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Analytics and insights for quotes pipeline'
  },
  
  // Core Business
  {
    page: 'Quotes Management',
    icon: FileText,
    category: 'Core Business',
    admin: { level: 'full', permissions: ['quotes.manage'] },
    manager: { level: 'full', permissions: ['quotes.manage'] },
    standard_office_user: { level: 'write', permissions: ['quotes.create', 'quotes.update'] },
    engineer: { level: 'read', permissions: ['quotes.view_assigned'] },
    client: { level: 'read', permissions: ['quotes.view_own'] },
    partner: { level: 'read', permissions: ['quotes.view_partner'] },
    description: 'Create, edit and manage customer quotes'
  },
  {
    page: 'Orders Management',
    icon: ShoppingCart,
    category: 'Core Business',
    admin: { level: 'full', permissions: ['orders.manage'] },
    manager: { level: 'full', permissions: ['orders.manage'] },
    standard_office_user: { level: 'write', permissions: ['orders.create', 'orders.update'] },
    engineer: { level: 'write', permissions: ['jobs.assigned', 'jobs.complete'] },
    client: { level: 'read', permissions: ['orders.view_own'] },
    partner: { level: 'read', permissions: ['orders.view_partner'] },
    description: 'Manage customer orders and job processing'
  },
  {
    page: 'Clients Management',
    icon: Users,
    category: 'Core Business',
    admin: { level: 'full', permissions: ['clients.manage'] },
    manager: { level: 'full', permissions: ['clients.manage'] },
    standard_office_user: { level: 'write', permissions: ['clients.create', 'clients.update'] },
    engineer: { level: 'read', permissions: ['clients.view_assigned'] },
    client: { level: 'write', permissions: ['profile.update_own'] },
    partner: { level: 'read', permissions: ['clients.view_partner'] },
    description: 'Manage customer information and profiles'
  },
  {
    page: 'Leads Management',
    icon: User,
    category: 'Core Business',
    admin: { level: 'full', permissions: ['leads.manage'] },
    manager: { level: 'full', permissions: ['leads.manage'] },
    standard_office_user: { level: 'write', permissions: ['leads.create', 'leads.convert'] },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Manage sales leads and conversion pipeline'
  },

  // Operations
  {
    page: 'Schedule Management',
    icon: Calendar,
    category: 'Operations',
    admin: { level: 'full', permissions: ['schedule.manage'] },
    manager: { level: 'full', permissions: ['schedule.manage'] },
    standard_office_user: { level: 'write', permissions: ['schedule.book', 'schedule.update'] },
    engineer: { level: 'read', permissions: ['schedule.view_own'] },
    client: { level: 'read', permissions: ['availability.manage_own'] },
    partner: { level: 'none' },
    description: 'Schedule installations and manage engineer calendars'
  },
  {
    page: 'Inventory Management',
    icon: Package,
    category: 'Operations',
    admin: { level: 'full', permissions: ['inventory.manage'] },
    manager: { level: 'full', permissions: ['inventory.manage'] },
    standard_office_user: { level: 'read', permissions: ['inventory.view'] },
    engineer: { level: 'read', permissions: ['inventory.view_van'] },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Manage stock levels and inventory tracking'
  },
  {
    page: 'Charger Management',
    icon: Zap,
    category: 'Operations',
    admin: { level: 'full', permissions: ['chargers.manage'] },
    manager: { level: 'full', permissions: ['chargers.manage'] },
    standard_office_user: { level: 'write', permissions: ['chargers.dispatch'] },
    engineer: { level: 'write', permissions: ['chargers.install'] },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Manage charger inventory and dispatching'
  },
  {
    page: 'Engineers Management',
    icon: UserCog,
    category: 'Operations',
    admin: { level: 'full', permissions: ['engineers.manage'] },
    manager: { level: 'full', permissions: ['engineers.manage'] },
    standard_office_user: { level: 'read', permissions: ['engineers.view'] },
    engineer: { level: 'write', permissions: ['profile.update_own'] },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Manage engineer profiles and assignments'
  },
  {
    page: 'Partners Management',
    icon: Users,
    category: 'Operations',
    admin: { level: 'full', permissions: ['partners.manage'] },
    manager: { level: 'full', permissions: ['partners.manage'] },
    standard_office_user: { level: 'read', permissions: ['partners.view'] },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'write', permissions: ['partner.manage_own'] },
    description: 'Manage business partner relationships'
  },

  // Communication
  {
    page: 'Messages',
    icon: MessageCircle,
    category: 'Communication',
    admin: { level: 'full', permissions: ['messages.manage'] },
    manager: { level: 'full', permissions: ['messages.manage'] },
    standard_office_user: { level: 'write', permissions: ['messages.send', 'messages.receive'] },
    engineer: { level: 'write', permissions: ['messages.job_related'] },
    client: { level: 'write', permissions: ['messages.own_projects'] },
    partner: { level: 'none' },
    description: 'Internal messaging and client communication'
  },

  // System Management
  {
    page: 'Survey Forms',
    icon: FormInput,
    category: 'System Management',
    admin: { level: 'full', permissions: ['surveys.manage'] },
    manager: { level: 'write', permissions: ['surveys.create'] },
    standard_office_user: { level: 'read', permissions: ['surveys.view'] },
    engineer: { level: 'none' },
    client: { level: 'write', permissions: ['surveys.submit_own'] },
    partner: { level: 'none' },
    description: 'Manage customer survey forms and responses'
  },
  {
    page: 'QA Review',
    icon: FileCheck,
    category: 'System Management',
    admin: { level: 'full', permissions: ['qa.manage'] },
    manager: { level: 'full', permissions: ['qa.review'] },
    standard_office_user: { level: 'read', permissions: ['qa.view'] },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Quality assurance and job review process'
  },
  {
    page: 'User Management',
    icon: Users,
    category: 'System Management',
    admin: { level: 'full', permissions: ['users.manage', 'users.create', 'users.delete'] },
    manager: { level: 'write', permissions: ['users.create'] },
    standard_office_user: { level: 'none' },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Manage system users and access permissions'
  },
  {
    page: 'System Settings',
    icon: Settings,
    category: 'System Management',
    admin: { level: 'full', permissions: ['settings.manage'] },
    manager: { level: 'read', permissions: ['settings.view'] },
    standard_office_user: { level: 'none' },
    engineer: { level: 'none' },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Configure system-wide settings and integrations'
  },

  // Client Portal
  {
    page: 'Client Dashboard',
    icon: Home,
    category: 'Client Portal',
    admin: { level: 'full' },
    manager: { level: 'read' },
    standard_office_user: { level: 'none' },
    engineer: { level: 'none' },
    client: { level: 'full', permissions: ['dashboard.own'] },
    partner: { level: 'none' },
    description: 'Client personal dashboard and overview'
  },
  {
    page: 'Client Documents',
    icon: FolderOpen,
    category: 'Client Portal',
    admin: { level: 'full' },
    manager: { level: 'read' },
    standard_office_user: { level: 'none' },
    engineer: { level: 'none' },
    client: { level: 'full', permissions: ['documents.own'] },
    partner: { level: 'none' },
    description: 'Access to client documents and files'
  },
  {
    page: 'Client Payments',
    icon: CreditCard,
    category: 'Client Portal',
    admin: { level: 'full' },
    manager: { level: 'read' },
    standard_office_user: { level: 'none' },
    engineer: { level: 'none' },
    client: { level: 'full', permissions: ['payments.own'] },
    partner: { level: 'none' },
    description: 'Client payment processing and history'
  },

  // Engineer Tools
  {
    page: 'Engineer Dashboard',
    icon: Home,
    category: 'Engineer Tools',
    admin: { level: 'full' },
    manager: { level: 'read' },
    standard_office_user: { level: 'none' },
    engineer: { level: 'full', permissions: ['dashboard.own'] },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Engineer personal dashboard and job overview'
  },
  {
    page: 'My Jobs',
    icon: Clock,
    category: 'Engineer Tools',
    admin: { level: 'full' },
    manager: { level: 'read' },
    standard_office_user: { level: 'none' },
    engineer: { level: 'full', permissions: ['jobs.assigned', 'jobs.complete'] },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Assigned jobs and task management for engineers'
  },
  {
    page: 'Van Inventory',
    icon: Warehouse,
    category: 'Engineer Tools',
    admin: { level: 'full' },
    manager: { level: 'read' },
    standard_office_user: { level: 'none' },
    engineer: { level: 'full', permissions: ['inventory.van_stock'] },
    client: { level: 'none' },
    partner: { level: 'none' },
    description: 'Manage van stock and inventory levels'
  },
];

const ROLE_DESCRIPTIONS = {
  admin: 'Full system administrator with unrestricted access to all features',
  manager: 'Management role with access to most features and oversight capabilities',
  standard_office_user: 'Office staff with access to day-to-day operational functions',
  engineer: 'Field engineer with access to job management and completion tools',
  client: 'Customer access limited to their own projects and account management',
  partner: 'Business partner with limited access to partner-specific functionality'
};

export function RolePermissionsTab() {
  const categories = [...new Set(PAGE_PERMISSIONS.map(p => p.category))];

  const AccessBadge = ({ level }: { level: 'none' | 'read' | 'write' | 'full' }) => {
    const config = ACCESS_LEVELS[level];
    const IconComponent = config.icon;
    
    return (
      <Badge 
        variant={config.color as any} 
        className="flex items-center gap-1.5 text-xs font-medium min-w-[90px] justify-center"
      >
        <IconComponent className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-Based Access Control Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
              <div key={role} className="p-4 border rounded-lg">
                <h4 className="font-semibold capitalize mb-2">{role.replace('_', ' ')}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {categories.map(category => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {PAGE_PERMISSIONS.filter(p => p.category === category).map(page => {
                const IconComponent = page.icon;
                return (
                  <div key={page.page} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <IconComponent className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1">
                        <h4 className="font-medium">{page.page}</h4>
                        <p className="text-sm text-muted-foreground">{page.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {(['admin', 'manager', 'standard_office_user', 'engineer', 'client', 'partner'] as const).map(role => (
                        <div key={role} className="text-center">
                          <div className="text-xs font-medium mb-1 capitalize">
                            {role.replace('_', ' ')}
                          </div>
                          <AccessBadge level={page[role].level} />
                          {page[role].permissions && page[role].permissions!.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {page[role].permissions!.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Permission Key Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Access Levels</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li><strong>None:</strong> No access to the feature</li>
                <li><strong>Read:</strong> Can view but not modify</li>
                <li><strong>Write:</strong> Can view and modify</li>
                <li><strong>Full:</strong> Complete access including admin functions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Permission Notes</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Admin role has full access to all features</li>
                <li>• Engineers can only access their assigned jobs</li>
                <li>• Clients can only view their own data</li>
                <li>• Partners have limited access to partner-specific data</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}