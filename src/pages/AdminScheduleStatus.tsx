import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleStatusListPage } from '@/components/scheduling/ScheduleStatusListPage';
import { ScheduleStatusNavigation } from '@/components/scheduling/ScheduleStatusNavigation';
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

      // Handle different status types with two-step fetches for offer-based statuses
      if (status === 'date-offered') {
        // Step 1: Get offer IDs
        const { data: offersData, error: offersError } = await supabase
          .from('job_offers')
          .select('order_id, offered_date, engineer_id')
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (offersError) {
          console.error('Error fetching offers data:', offersError);
          setOrders([]);
        } else if (offersData && offersData.length > 0) {
          // Step 2: Get orders for those IDs
          const orderIds = offersData.map(offer => offer.order_id);
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select(`
              *,
              client:clients(*),
              quote:quotes(*),
              engineer:engineers(*)
            `)
            .in('id', orderIds)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.error('Error fetching orders data:', ordersError);
            setOrders([]);
          } else {
            // Filter out orders that don't have engineer or are back to awaiting_install_booking
            const validDateOfferedOrders = (ordersData || []).filter(order => 
              order.engineer_id !== null && order.status_enhanced !== 'awaiting_install_booking'
            );
            setOrders(validDateOfferedOrders);
          }
        } else {
          setOrders([]);
        }
      } else if (status === 'ready-to-book') {
        // Filter for orders that are awaiting_install_booking with accepted offers but not scheduled yet
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            client:clients(*),
            quote:quotes(*),
            engineer:engineers(*)
          `)
          .eq('status_enhanced', 'awaiting_install_booking')
          .is('scheduled_install_date', null)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('Error fetching orders data:', ordersError);
          setOrders([]);
        } else {
          // Filter to only orders that have accepted offers
          const { data: acceptedOffers } = await supabase
            .from('job_offers')
            .select('order_id')
            .eq('status', 'accepted');

          const ordersWithAcceptedOffers = new Set(acceptedOffers?.map(offer => offer.order_id) || []);
          const readyToBookOrders = (ordersData || []).filter(order => 
            ordersWithAcceptedOffers.has(order.id)
          );
          setOrders(readyToBookOrders);
        }

      } else if (status === 'date-rejected') {
        // Step 1: Get rejected offer order IDs
        const { data: offersData, error: offersError } = await supabase
          .from('job_offers')
          .select('order_id, offered_date, engineer_id')
          .eq('status', 'rejected')
          .order('rejected_at', { ascending: false });

        if (offersError) {
          console.error('Error fetching rejected offers data:', offersError);
          setOrders([]);
        } else if (offersData && offersData.length > 0) {
          // Step 2: Get orders for those IDs
          const orderIds = offersData.map(offer => offer.order_id);
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select(`
              *,
              client:clients(*),
              quote:quotes(*),
              engineer:engineers(*)
            `)
            .in('id', orderIds)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.error('Error fetching orders data:', ordersError);
            setOrders([]);
          } else {
            setOrders(ordersData || []);
          }
        } else {
          setOrders([]);
        }
      } else if (status === 'offer-expired') {
        // Step 1: Get expired offer order IDs
        const { data: offersData, error: offersError } = await supabase
          .from('job_offers')
          .select('order_id, offered_date, engineer_id')
          .eq('status', 'expired')
          .order('expired_at', { ascending: false });

        if (offersError) {
          console.error('Error fetching expired offers data:', offersError);
          setOrders([]);
        } else if (offersData && offersData.length > 0) {
          // Step 2: Get orders for those IDs
          const orderIds = offersData.map(offer => offer.order_id);
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select(`
              *,
              client:clients(*),
              quote:quotes(*),
              engineer:engineers(*)
            `)
            .in('id', orderIds)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.error('Error fetching orders data:', ordersError);
            setOrders([]);
          } else {
            setOrders(ordersData || []);
          }
        } else {
          setOrders([]);
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

          // For needs-scheduling, filter to only orders that need scheduling (no engineer assigned and no active/pending offers)
          if (status === 'needs-scheduling') {
            const { data: activeOffers } = await supabase
              .from('job_offers')
              .select('order_id')
              .in('status', ['pending', 'accepted'])
              .gt('expires_at', new Date().toISOString());

            const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
            filteredOrders = filteredOrders.filter(order => 
              !ordersWithActiveOffers.has(order.id) && 
              order.engineer_id === null
            );
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
      case 'ready-to-book':
        return 'Ready to Book';
      case 'date-rejected':
        return 'Date Rejected';
      case 'offer-expired':
        return 'Offer Expired';
      case 'on-hold':
        return 'On Hold - Parts/Docs';
      case 'cancelled':
        return 'Cancelled';
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
    <div>
      <ScheduleStatusNavigation currentStatus={status} />
      <ScheduleStatusListPage
        orders={orders}
        engineers={engineers}
        title={getTitle()}
        onUpdate={fetchData}
        showAutoSchedule={status === 'needs-scheduling'}
      />
    </div>
  );
}