import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, UserCheck } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

export function NeedsSchedulingListPage() {
  console.log('NeedsSchedulingListPage: Starting component render');
  const queryClient = useQueryClient();
  const { pagination, controls } = useServerPagination();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get include assigned engineers setting from URL
  const [includeAssigned, setIncludeAssigned] = useState(() => {
    return searchParams.get('includeAssigned') === 'true';
  });

  // Update URL when toggle changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (includeAssigned) {
      newSearchParams.set('includeAssigned', 'true');
    } else {
      newSearchParams.delete('includeAssigned');
    }
    setSearchParams(newSearchParams, { replace: true });
  }, [includeAssigned, searchParams, setSearchParams]);
  
  const { data: ordersResponse = { data: [], count: 0, unassignedCount: 0, assignedCount: 0 }, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'needs-scheduling', pagination.page, pagination.pageSize, includeAssigned],
    queryFn: async () => {
      console.log('NeedsSchedulingListPage: Fetching orders...');
      
      // Base query for orders that need scheduling
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `, { count: 'exact' })
        .eq('status_enhanced', 'awaiting_install_booking')
        .eq('scheduling_suppressed', false)
        .order('created_at', { ascending: false });

      // Conditionally filter by engineer assignment
      if (!includeAssigned) {
        query = query.is('engineer_id', null);
      }

      // Apply pagination
      query = query.range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      const { data: ordersData, error: ordersError, count } = await query;

      if (ordersError) {
        console.error('NeedsSchedulingListPage: Error fetching orders:', ordersError);
        throw ordersError;
      }
      
      console.log('NeedsSchedulingListPage: Got orders:', ordersData?.length);
      
      if (!ordersData?.length) return { data: [], count: count || 0 };

      // Get active offers to exclude orders that have them (for the paginated results only)
      const orderIds = ordersData.map(order => order.id);
      const { data: activeOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .in('order_id', orderIds);

      const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
      
      // Filter out orders that have active offers
      const filteredOrders = ordersData.filter(order => !ordersWithActiveOffers.has(order.id));
      console.log('NeedsSchedulingListPage: Filtered orders:', filteredOrders.length);
      
      // Get counts for assigned vs unassigned
      const unassignedCount = filteredOrders.filter(order => !order.engineer_id).length;
      const assignedCount = filteredOrders.filter(order => order.engineer_id).length;
      
      return { 
        data: filteredOrders, 
        count: count || 0,
        unassignedCount,
        assignedCount
      };
    },
    placeholderData: keepPreviousData,
  });

  const orders = ordersResponse?.data || [];
  const totalCount = ordersResponse?.count || 0;
  const unassignedCount = ordersResponse?.unassignedCount || 0;
  const assignedCount = ordersResponse?.assignedCount || 0;

  const { data: engineers = [], isLoading: engineersLoading, error: engineersError } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      console.log('NeedsSchedulingListPage: Fetching engineers...');
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true)
        .order('name');

      if (error) {
        console.error('NeedsSchedulingListPage: Error fetching engineers:', error);
        throw error;
      }
      console.log('NeedsSchedulingListPage: Got engineers:', data?.length);
      return data || [];
    }
  });

  // Listen for scheduling refresh events and real-time updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('NeedsSchedulingListPage: Received refresh event, refetching data...');
      refetchOrders();
    };
    
    // Listen for custom refresh events
    window.addEventListener('scheduling:refresh', handleRefresh);
    
    // Set up real-time subscriptions for orders and job_offers
    const ordersChannel = supabase
      .channel('needs-scheduling-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('NeedsSchedulingListPage: Orders real-time update:', payload);
          refetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_offers'
        },
        (payload) => {
          console.log('NeedsSchedulingListPage: Job offers real-time update:', payload);
          refetchOrders();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('scheduling:refresh', handleRefresh);
      supabase.removeChannel(ordersChannel);
    };
  }, [refetchOrders]);

  console.log('NeedsSchedulingListPage - Orders count:', orders?.length, 'Engineers count:', engineers?.length);
  
  // Show errors if any
  if (ordersError || engineersError) {
    console.error('NeedsSchedulingListPage: Errors occurred:', { ordersError, engineersError });
    return (
      <div className="space-y-6">
        <ScheduleStatusNavigation currentStatus="needs-scheduling" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Calendar className="h-5 w-5" />
              Needs Scheduling - Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600">
              <p>Error loading data:</p>
              {ordersError && <p>Orders: {ordersError.message}</p>}
              {engineersError && <p>Engineers: {engineersError.message}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (ordersLoading || engineersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="needs-scheduling" />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Needs Scheduling ({totalCount})
              <div className="flex items-center gap-2 ml-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Unassigned: {unassignedCount}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Assigned: {assignedCount}
                </Badge>
              </div>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Switch
                id="include-assigned"
                checked={includeAssigned}
                onCheckedChange={setIncludeAssigned}
              />
              <Label htmlFor="include-assigned" className="text-sm font-medium">
                Include assigned engineers
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Needs Scheduling"
            showAutoSchedule={true}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
            onUpdate={() => {
              console.log('NeedsSchedulingListPage: Manual update requested, refetching...');
              refetchOrders();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}