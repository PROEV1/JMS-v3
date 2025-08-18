import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleStatusListPage } from '@/components/scheduling/ScheduleStatusListPage';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/utils/schedulingUtils';

interface Engineer {
  id: string;
  name: string;
  email: string;
  availability: boolean;
}

export default function AdminScheduleStatus() {
  const { status } = useParams<{ status: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch engineers
      const { data: engineersData, error: engineersError } = await supabase
        .from('engineers')
        .select('*')
        .order('name');

      if (engineersError) {
        console.error('Error fetching engineers:', engineersError);
      } else {
        setEngineers(engineersData?.map(engineer => ({
          ...engineer,
          availability: engineer.availability ?? true
        })) || []);
      }

      // Handle different status types
      if (status === 'date-offered') {
        // For date-offered, query job_offers and get corresponding orders
        const { data: offersData, error: offersError } = await supabase
          .from('job_offers')
          .select(`
            order_id,
            orders!inner(
              *,
              client:clients(*),
              quote:quotes(*),
              engineer:engineers(*)
            )
          `)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (offersError) {
          console.error('Error fetching offers data:', offersError);
          setOrders([]);
        } else {
          // Extract orders from the offers data and flatten
          const ordersWithOffers = offersData?.map(offer => offer.orders).filter(Boolean) || [];
          setOrders(ordersWithOffers);
        }
      } else {
        // For other statuses, query orders normally
        let statusFilter: string;
        switch (status) {
          case 'needs-scheduling':
            statusFilter = 'awaiting_install_booking';
            break;
          case 'scheduled':
            statusFilter = 'scheduled';
            break;
          case 'in-progress':
            statusFilter = 'in_progress';
            break;
          case 'completed':
            statusFilter = 'completed';
            break;
          default:
            statusFilter = status || 'awaiting_install_booking';
        }

        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            client:clients(*),
            quote:quotes(*),
            engineer:engineers(*)
          `)
          .eq('status_enhanced', statusFilter as any)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
          setOrders([]);
        } else {
          let filteredOrders = ordersData || [];

          // For needs-scheduling, filter out orders that have active offers
          if (status === 'needs-scheduling') {
            const { data: activeOffers } = await supabase
              .from('job_offers')
              .select('order_id')
              .eq('status', 'pending')
              .gt('expires_at', new Date().toISOString());

            const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
            filteredOrders = filteredOrders.filter(order => !ordersWithActiveOffers.has(order.id));
          }

          setOrders(filteredOrders);
        }
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status) {
      fetchData();
    }
  }, [status]);

  const getTitle = () => {
    switch (status) {
      case 'needs-scheduling':
        return 'Jobs Needing Scheduling';
      case 'date-offered':
        return 'Date Offered';
      case 'scheduled':
        return 'Scheduled Jobs';
      case 'in-progress':
        return 'In Progress Jobs';
      case 'completed':
        return 'Completed Jobs';
      default:
        return 'Jobs';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ScheduleStatusListPage
      orders={orders}
      engineers={engineers}
      title={getTitle()}
      onUpdate={fetchData}
      showAutoSchedule={status === 'needs-scheduling'}
    />
  );
}