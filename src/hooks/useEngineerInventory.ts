import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EngineerInventoryItem {
  item_id: string;
  location_id: string;
  on_hand: number;
  item_name: string;
  item_sku: string;
  item_unit: string;
  reorder_point: number;
  location_name: string;
}

export const useEngineerInventory = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['engineer-inventory', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get the engineer's ID
      const { data: engineer, error: engineerError } = await supabase
        .from('engineers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (engineerError) throw engineerError;
      if (!engineer) throw new Error('Engineer profile not found');

      // Get the engineer's van locations
      const { data: locations, error: locationsError } = await supabase
        .from('inventory_locations')
        .select('id, name')
        .eq('engineer_id', engineer.id)
        .eq('is_active', true);

      if (locationsError) throw locationsError;
      if (!locations || locations.length === 0) {
        return [];
      }

      const locationIds = locations.map(loc => loc.id);

      // Get inventory balances using the function
      const { data: balances, error: balancesError } = await supabase
        .rpc('get_item_location_balances');

      if (balancesError) throw balancesError;

      // Filter balances for this engineer's locations and get item details
      const engineerBalances = balances?.filter(balance => 
        locationIds.includes(balance.location_id)
      ) || [];

      if (engineerBalances.length === 0) {
        return [];
      }

      // Get item details for all items in the balances
      const itemIds = engineerBalances.map(balance => balance.item_id);
      
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit, reorder_point')
        .in('id', itemIds);

      if (itemsError) throw itemsError;

      // Combine balances with item details and location names
      const result: EngineerInventoryItem[] = engineerBalances.map(balance => {
        const item = items?.find(i => i.id === balance.item_id);
        const location = locations.find(l => l.id === balance.location_id);
        
        return {
          item_id: balance.item_id,
          location_id: balance.location_id,
          on_hand: balance.on_hand,
          item_name: item?.name || 'Unknown Item',
          item_sku: item?.sku || 'N/A',
          item_unit: item?.unit || 'each',
          reorder_point: item?.reorder_point || 0,
          location_name: location?.name || 'Unknown Location'
        };
      }).filter(item => item.on_hand > 0); // Only show items with stock

      return result;
    },
    enabled: !!user?.id
  });
};