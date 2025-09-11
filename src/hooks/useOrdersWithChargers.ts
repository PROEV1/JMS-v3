import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch orders with their assigned chargers
 * This replaces or enhances existing order queries to include charger information
 */
export function useOrdersWithChargers() {
  return useQuery({
    queryKey: ['orders-with-chargers'],
    queryFn: async () => {
      // First, get all orders with basic info
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          clients!inner (
            id,
            full_name,
            name,
            email,
            phone,
            address,
            postcode
          ),
          engineer:engineers (
            id,
            name,
            email,
            region
          ),
          partners (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Get chargers assigned to these orders
      const orderIds = orders.map(order => order.id);
      
      if (orderIds.length === 0) return orders;

      const { data: chargers, error: chargersError } = await supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          status,
          assigned_order_id,
          charger_item_id,
          inventory_items!inner (
            name
          )
        `)
        .in('assigned_order_id', orderIds);

      if (chargersError) throw chargersError;

      // Group chargers by order ID
      const chargersByOrderId = chargers.reduce((acc, charger) => {
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

      // Merge chargers with orders
      const ordersWithChargers = orders.map(order => ({
        ...order,
        assigned_chargers: chargersByOrderId[order.id] || []
      }));

      return ordersWithChargers;
    }
  });
}