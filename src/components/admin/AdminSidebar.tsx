import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  Building2,
  HelpCircle,
  Package,
} from 'lucide-react'

import { NavLink } from 'react-router-dom'


export function AdminSidebar() {
  const sidebarItems = [
    {
      title: 'Dashboard',
      url: '/admin',
      icon: LayoutDashboard,
    },
    {
      title: 'Users',
      url: '/admin/users',
      icon: Users,
    },
    {
      title: 'Scheduling',
      url: '/admin/schedule',
      icon: Calendar,
    },
    {
      title: 'Inventory',
      url: '/admin/inventory',
      icon: Package,
    },
    {
      title: 'Settings',
      url: '/admin/settings',
      icon: Settings,
    },
    {
      title: 'Partners',
      url: '/admin/partners',
      icon: Building2,
    },
    {
      title: 'Help',
      url: '/admin/help',
      icon: HelpCircle,
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      {sidebarItems.map((item) => (
        <NavLink
          key={item.title}
          to={item.url}
          className={({ isActive }) =>
            `flex items-center space-x-2 rounded-md p-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground'
            }`
          }
        >
          {item.icon && (
            <item.icon className="h-4 w-4" />
          )}
          {item.title}
        </NavLink>
      ))}
    </div>
  )
}
