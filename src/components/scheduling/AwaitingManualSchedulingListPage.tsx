import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserCheck, Search, Calendar, Wrench, Users, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AwaitingManualSchedulingListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', 'awaiting-manual-scheduling'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineers!engineer_id(name, email, region),
          partner:partner_id(name),
          quote:quote_id(quote_number),
          specific_engineer:specific_engineer_id(name, email, region)
        `)
        .eq('status_enhanced', 'awaiting_manual_scheduling')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  const getManualRequirements = (order: any) => {
    const requirements = [];
    if (order.groundworks_required) requirements.push('Groundworks');
    if (order.multiple_engineers_required) requirements.push('Multiple Engineers');
    if (order.specific_engineer_required) requirements.push('Specific Engineer');
    return requirements;
  };

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="awaiting-manual-scheduling" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Manual Scheduling Required</h1>
          <Badge variant="outline" className="ml-2">
            {orders.length}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jobs Requiring Manual Scheduling</CardTitle>
          <p className="text-sm text-muted-foreground">
            These orders require manual scheduling by the office team and will not appear in the Smart Assign system.
            Schedule these jobs manually by assigning dates and engineers directly.
          </p>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Manual Scheduling Required"
            showAutoSchedule={false}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onUpdate={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}