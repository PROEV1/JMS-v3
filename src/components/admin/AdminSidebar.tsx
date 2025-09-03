import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  File,
  Calendar,
  Settings,
  User,
  HelpCircle,
  LogOut,
  Plus,
  ChevronsUpDown,
  Quote
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  permission: string | null;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sidebarItems = [
  {
    title: "Main",
    items: [
      { name: "Ops Command Centre", href: "/admin", icon: LayoutDashboard, permission: null },
    ]
  },
  {
    title: "Data",
    items: [
      { name: "Quotes", href: "/admin/quotes", icon: Quote, permission: "quotes.manage" },
      { name: "Orders", href: "/admin/orders", icon: File, permission: "orders.manage" },
    ]
  },
  {
    title: "Operations",
    items: [
      { name: "Partner Quotes", href: "/ops/quotes", icon: Quote, permission: "quotes.manage" },
      { name: "Schedule", href: "/admin/schedule", icon: Calendar, permission: null },
    ]
  },
  {
    title: "Settings",
    items: [
      { name: "Users", href: "/admin/users", icon: User, permission: "users.manage" },
      { name: "Settings", href: "/admin/settings", icon: Settings, permission: "settings.manage" },
    ]
  },
];

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="flex flex-col h-full space-y-4 py-4 border-r bg-secondary text-secondary-foreground">
      <div className="px-3 py-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-md px-2">
              <User className="mr-2 h-4 w-4" />
              <span>{user?.email}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col space-y-1 text-sm">
                <SheetHeader className="place-items-start px-5 pt-5">
                  <SheetTitle>Account</SheetTitle>
                  <SheetDescription>
                    Manage your account settings.
                  </SheetDescription>
                </SheetHeader>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {role ? role : 'No role'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
      <div className="flex-1 space-y-2">
        <ScrollArea className="h-full">
          <div className="space-y-1">
            {sidebarItems.map((section, index) => (
              <Accordion type="single" collapsible key={index}>
                <AccordionItem value={section.title}>
                  <AccordionTrigger className="font-medium">{section.title}</AccordionTrigger>
                  <AccordionContent>
                    {section.items.map((item) => (
                      <Button
                        key={item.name}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start rounded-md px-2",
                          isActive(item.href) ? "bg-accent text-accent-foreground" : ""
                        )}
                        onClick={() => navigate(item.href)}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.name}</span>
                      </Button>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
