import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EngineerJob {
  id: string;
  order_number: string;
  client_name: string;
  client_phone: string;
  job_address: string;
  scheduled_install_date: string | null;
  status_enhanced: string;
  product_details: string;
  engineer_signed_off_at: string | null;
  upload_count?: number;
  job_type?: 'installation' | 'assessment' | 'service_call';
  assigned_chargers?: Array<{
    id: string;
    serial_number: string;
    status: string;
    charger_model?: string;
  }>;
}

/**
 * Hook to fetch engineer jobs with their assigned chargers
 * For use in engineer dashboard and job cards
 */
export function useEngineerJobsWithChargers(engineerId?: string) {
  return useQuery({
    queryKey: ['engineer-jobs-with-chargers', engineerId],
    queryFn: async () => {
      if (!engineerId) return [];

      // Get orders assigned to this engineer
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          scheduled_install_date,
          status_enhanced,
          engineer_signed_off_at,
          job_type,
          clients!inner (
            full_name,
            phone,
            address,
            postcode
          )
        `)
        .eq('engineer_id', engineerId)
        .in('status_enhanced', ['scheduled', 'in_progress'])
        .order('scheduled_install_date', { ascending: true });

      if (ordersError) throw ordersError;

      // Get upload counts for these orders
      const orderIds = orders.map(order => order.id);
      
      let uploadCounts: Record<string, number> = {};
      if (orderIds.length > 0) {
        const { data: uploads } = await supabase
          .from('engineer_uploads')
          .select('order_id')
          .in('order_id', orderIds);
        
        uploadCounts = uploads?.reduce((acc, upload) => {
          acc[upload.order_id] = (acc[upload.order_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};
      }

      // Get chargers assigned to these orders
      let chargersByOrderId: Record<string, any[]> = {};
      if (orderIds.length > 0) {
        const { data: chargers, error: chargersError } = await supabase
          .from('charger_inventory')
          .select(`
            id,
            serial_number,
            status,
            assigned_order_id,
            inventory_items!inner (
              name
            )
          `)
          .in('assigned_order_id', orderIds);

        if (!chargersError && chargers) {
          chargersByOrderId = chargers.reduce((acc, charger) => {
            if (!charger.assigned_order_id) return acc;
            
            if (!acc[charger.assigned_order_id]) {
              acc[charger.assigned_order_id] = [];
            }
            
            acc[charger.assigned_order_id].push({
              id: charger.id,
              serial_number: charger.serial_number,
              status: charger.status,
              charger_model: charger.inventory_items?.name
            });
            
            return acc;
          }, {} as Record<string, any[]>);
        }
      }

      // Transform and merge data
      const jobs: EngineerJob[] = orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        client_name: order.clients?.full_name || 'Unknown Client',
        client_phone: order.clients?.phone || '',
        job_address: `${order.clients?.address || ''} ${order.clients?.postcode || ''}`.trim(),
        scheduled_install_date: order.scheduled_install_date,
        status_enhanced: order.status_enhanced as any,
        product_details: 'Installation Job', // Simplified for now
        engineer_signed_off_at: order.engineer_signed_off_at,
        upload_count: uploadCounts[order.id] || 0,
        job_type: order.job_type as any,
        assigned_chargers: chargersByOrderId[order.id] || []
      }));

      return jobs;
    },
    enabled: !!engineerId
  });
}