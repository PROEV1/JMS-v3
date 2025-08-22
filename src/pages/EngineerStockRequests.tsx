import React from 'react';
import Layout from '@/components/Layout';
import { StockRequestButton } from '@/components/engineer/StockRequestButton';
import { StockRequestHistory } from '@/components/engineer/StockRequestHistory';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

export default function EngineerStockRequests() {
  const { role: userRole, loading } = useUserRole();
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
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (userRole !== 'engineer') {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available to engineers.
          </p>
        </div>
      </Layout>
    );
  }

  if (!engineer) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Stock Requests</h1>
            <p className="text-muted-foreground">Manage your stock requests and track their status</p>
          </div>
          <StockRequestButton 
            engineerId={engineer.id}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Stock Request
          </StockRequestButton>
        </div>
        <StockRequestHistory engineerId={engineer.id} />
      </div>
    </Layout>
  );
}