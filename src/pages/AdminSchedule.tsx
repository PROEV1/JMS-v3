import React, { useEffect, useState } from 'react';
import { WeekViewCalendar } from '@/components/scheduling/WeekViewCalendar';
import { SchedulingSettingsPanel } from '@/components/admin/SchedulingSettingsPanel';
import { SchedulingHub } from '@/components/scheduling/SchedulingHub';
import { useUserRole } from '@/hooks/useUserRole';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function AdminSchedule() {
  const { role: userRole, loading } = useUserRole();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('hub');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch orders and engineers for the week view
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients!orders_client_id_fkey(
            id,
            full_name,
            email,
            phone
          ),
          engineer:engineers!orders_engineer_id_fkey(
            id,
            name,
            email,
            region
          )
        `)
        .or(`scheduled_install_date.not.is.null,and(status_enhanced.in.(scheduled,in_progress),scheduled_install_date.not.is.null),partner_status.eq.INSTALL_DATE_CONFIRMED`);
      
      if (error) throw error;
      console.log(`AdminSchedule: Found ${data?.length || 0} calendar orders`);
      console.log('AdminSchedule: Orders breakdown:', {
        withScheduledDate: data?.filter(o => o.scheduled_install_date).length || 0,
        statusScheduled: data?.filter(o => o.status_enhanced === 'scheduled').length || 0,
        statusInProgress: data?.filter(o => o.status_enhanced === 'in_progress').length || 0,
        partnerConfirmed: data?.filter(o => o.partner_status === 'INSTALL_DATE_CONFIRMED').length || 0
      });
      if (data && data.length > 0) {
        console.log('AdminSchedule: Sample order:', {
          id: data[0].id,
          order_number: data[0].order_number,
          status_enhanced: data[0].status_enhanced,
          partner_status: data[0].partner_status,
          scheduled_install_date: data[0].scheduled_install_date,
          client: data[0].client?.full_name,
          engineer: data[0].engineer?.name
        });
      }
      return data || [];
    }
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-for-calendar'],  
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    // Check for tab in URL params or navigation state
    const tabFromUrl = searchParams.get('tab');
    const tabFromState = location.state?.tab;
    
    if (tabFromUrl && ['hub', 'week-view', 'settings'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (tabFromState && ['hub', 'week-view', 'settings'].includes(tabFromState)) {
      setActiveTab(tabFromState);
    }
  }, [searchParams, location.state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'manager') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">
          You don't have permission to access the scheduling system.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hub">Scheduling Hub</TabsTrigger>
          <TabsTrigger value="week-view">Engineer Week View</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="hub" className="mt-6">
          <SchedulingHub />
        </TabsContent>
        <TabsContent value="week-view" className="mt-6">
          <WeekViewCalendar
            orders={orders}
            engineers={engineers}
            onOrderClick={(order) => {
              // Handle order click if needed
              console.log('Order clicked:', order);
            }}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SchedulingSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}