import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

export function ScheduledListPage() {
  const { pagination, controls } = useServerPagination();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Build search query with enhanced search across related tables
  const buildSearchQuery = useMemo(() => {
    return async (withPagination = true, withCount = true) => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name),
          quote:quote_id(quote_number)
        `, withCount ? { count: 'exact' } : {})
        .eq('status_enhanced', 'scheduled')
        .eq('scheduling_suppressed', false)
        .order('scheduled_install_date', { ascending: true });

      // Apply search filter across all relevant tables
      if (debouncedSearchTerm) {
        const searchPattern = `%${debouncedSearchTerm}%`;
        
        // Find matching client and quote IDs for this search
        const [matchingClients, matchingQuotes] = await Promise.all([
          supabase.from('clients').select('id')
            .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`),
          supabase.from('quotes').select('id')
            .ilike('quote_number', searchPattern)
        ]);
        
        const clientIds = matchingClients.data?.map(c => c.id) || [];
        const quoteIds = matchingQuotes.data?.map(q => q.id) || [];

        const searchConditions = [
          `order_number.ilike.${searchPattern}`,
          `partner_external_url.ilike.${searchPattern}`,
          `job_address.ilike.${searchPattern}`,
          `postcode.ilike.${searchPattern}`
        ];

        if (clientIds.length > 0) {
          searchConditions.push(`client_id.in.(${clientIds.join(',')})`);
        }
        if (quoteIds.length > 0) {
          searchConditions.push(`quote_id.in.(${quoteIds.join(',')})`);
        }

        query = query.or(searchConditions.join(','));
      }

      // Apply pagination if requested
      if (withPagination) {
        query = query.range(pagination.offset, pagination.offset + pagination.pageSize - 1);
      }

      return query;
    };
  }, [debouncedSearchTerm, pagination.offset, pagination.pageSize]);

  const { data: ordersResponse = { data: [], count: 0 }, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'scheduled', pagination.page, pagination.pageSize, debouncedSearchTerm],
    queryFn: async () => {
      try {
        const query = await buildSearchQuery(true, true);
        const { data, error, count } = await query;
        
        if (error) throw error;

        // Transform data
        const transformedData = data?.map(order => ({
          ...order,
          client: order.client || null,
          quote: order.quote || null,
          engineer: order.engineer || null,
          partner: order.partner || null
        })) || [];

        return { data: transformedData, count: count || 0 };
      } catch (error) {
        console.error('Orders query error:', error);
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });

  const orders = ordersResponse?.data || [];
  const totalCount = ordersResponse?.count || 0;

  const { data: engineers = [], isLoading: engineersLoading } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true)
        .order('name');

      if (error) throw error;
      return data || [];
    }
  });

  if (ordersLoading || engineersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleExportQuery = async () => {
    const query = await buildSearchQuery(false, false);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="scheduled" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Scheduled"
            showAutoSchedule={false}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            exportQueryBuilder={handleExportQuery}
          />
        </CardContent>
      </Card>
    </div>
  );
}