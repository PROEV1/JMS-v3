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

      console.log('🔍 ENGINEER INVENTORY: Starting for user:', user.id);
      
      // Get the engineer's ID
      const { data: engineer, error: engineerError } = await supabase
        .from('engineers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('👤 ENGINEER DATA:', engineer, engineerError);
      
      if (engineerError) throw engineerError;
      if (!engineer) {
        console.log('❌ No engineer profile found for user:', user.id);
        return [];
      }

      // Get the engineer's van locations
      const { data: locations, error: locationsError } = await supabase
        .from('inventory_locations')
        .select('id, name')
        .eq('engineer_id', engineer.id)
        .eq('is_active', true);

      console.log('📍 ENGINEER LOCATIONS QUERY for engineer:', engineer.id);
      
      if (locationsError) throw locationsError;
      
      console.log('📍 ENGINEER LOCATIONS:', locations);
      
      if (!locations || locations.length === 0) {
        console.log('❌ No van locations found for engineer:', engineer.id);
        return [];
      }

      const locationIds = locations.map(loc => loc.id);
      console.log('📍 LOCATION IDS:', locationIds);

      // Get inventory balances using the function
      console.log('📦 GETTING BALANCES...');
      const { data: balances, error: balancesError } = await supabase
        .rpc('get_item_location_balances');

      console.log('📦 BALANCES RESULT:', balances, balancesError);

      if (balancesError) throw balancesError;

      // Filter balances for this engineer's locations and get item details
      const engineerBalances = balances?.filter(balance => 
        locationIds.includes(balance.location_id)
      ) || [];

      console.log('📦 ENGINEER BALANCES:', engineerBalances);

      if (engineerBalances.length === 0) {
        console.log('❌ No balances found for engineer locations');
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