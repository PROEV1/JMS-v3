import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, BarChart3, LogOut, Building2 } from 'lucide-react';
import { PartnerJobUpload } from './PartnerJobUpload';
import { PartnerJobsList } from './PartnerJobsList';
import { PartnerMetrics } from './PartnerMetrics';

interface PartnerUser {
  id: string;
  user_id: string;
  partner_id: string;
  role: 'partner_manufacturer' | 'partner_dealer' | 'partner_charger_manufacturer';
  permissions: any;
  partner: {
    id: string;
    name: string;
    partner_type: string;
    logo_url?: string;
    brand_colors: any;
    parent_partner_id?: string;
  };
}

interface PartnerDashboardProps {
  partnerUser: PartnerUser;
}

export function PartnerDashboard({ partnerUser }: PartnerDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'partner_manufacturer':
        return 'Manufacturer';
      case 'partner_dealer':
        return 'Dealer';
      case 'partner_charger_manufacturer':
        return 'Charger Manufacturer';
      default:
        return role;
    }
  };

  const brandColors = partnerUser.partner.brand_colors || { primary: '#3b82f6', secondary: '#1e293b' };

  return (
    <div className="min-h-screen bg-background">
      {/* Co-branded Header */}
      <header 
        className="border-b bg-card/50"
        style={{
          background: `linear-gradient(90deg, ${brandColors.primary}10 0%, ${brandColors.secondary}10 100%)`
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {partnerUser.partner.logo_url && (
                <img 
                  src={partnerUser.partner.logo_url} 
                  alt={`${partnerUser.partner.name} logo`}
                  className="h-10 w-auto"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {partnerUser.partner.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Powered by ProEV
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {getRoleDisplayName(partnerUser.role)}
                </p>
                <Badge variant="secondary" className="text-xs">
                  <Building2 className="mr-1 h-3 w-3" />
                  {partnerUser.partner.partner_type}
                </Badge>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="upload" disabled={!partnerUser.permissions.can_upload}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload Jobs
            </TabsTrigger>
            <TabsTrigger value="jobs" disabled={!partnerUser.permissions.can_view_jobs}>
              Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Welcome back!</CardTitle>
                  <CardDescription>
                    Manage your EV charging installation jobs and track progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <PartnerMetrics partnerUser={partnerUser} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <PartnerJobUpload partnerUser={partnerUser} />
          </TabsContent>

          <TabsContent value="jobs">
            <PartnerJobsList partnerUser={partnerUser} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}