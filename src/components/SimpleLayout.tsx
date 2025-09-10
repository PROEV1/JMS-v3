import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ProEVLogo } from '@/components/ProEVLogo';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

interface SimpleLayoutProps {
  children: React.ReactNode;
}

export default function SimpleLayout({ children }: SimpleLayoutProps) {
  const { user, finalRole, signOut, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !finalRole) {
    return null; // RouteGuard will handle redirect
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar userRole={finalRole} />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center border-b bg-white shadow-md px-4">
            <SidebarTrigger className="mr-4" />
            <ProEVLogo size="md" />
            
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <span>{user.email}</span>
                <span className="text-xs text-muted-foreground">({finalRole})</span>
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