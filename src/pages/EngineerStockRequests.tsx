import React from 'react';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { StockRequestButton } from '@/components/engineer/StockRequestButton';
import { StockRequestHistory } from '@/components/engineer/StockRequestHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Package, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function EngineerStockRequests() {
  const { finalRole: userRole, loading } = useAuth();
  const { user } = useAuth();

  // Get engineer profile
  const { data: engineer } = useQuery({
    queryKey: ['engineer-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  if (loading) {
    return (
      <BrandPage>
        <BrandContainer>
          <BrandLoading />
        </BrandContainer>
      </BrandPage>
    );
  }

  if (userRole !== 'standard_office_user' && userRole !== 'admin') {
    return (
      <BrandPage>
        <BrandContainer>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-destructive">Access Denied</h1>
                  <p className="text-sm text-muted-foreground">
                    This page is only available to engineers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </BrandContainer>
      </BrandPage>
    );
  }

  if (!engineer) {
    return (
      <BrandPage>
        <BrandContainer>
          <BrandLoading />
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <BrandHeading1 className="text-2xl sm:text-3xl">Stock Requests</BrandHeading1>
                </div>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage your stock requests and track their status
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <StockRequestButton 
                engineerId={engineer.id}
                variant="default"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Stock Request
              </StockRequestButton>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            <StockRequestHistory engineerId={engineer.id} />
          </div>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}