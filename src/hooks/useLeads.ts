
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { transformLeadData, mergeLeadWithStatusOverride, filterLeadsByStatus } from '@/utils/leadUtils';
import { createOrFindClient, saveLeadHistory } from '@/utils/leadConversionUtils';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'unqualified' | 'closed';
  created_at: string;
  updated_at: string;
  source?: string;
  notes?: string;
  quote_number?: string;
  total_cost?: number;
  total_price?: number;
  product_details?: string;
  product_name?: string;
  product_price?: number;
  width_cm?: number;
  finish?: string;
  luxe_upgrade?: boolean;
  accessories_data?: any;
  accessories?: Array<{
    name: string;
    price: number;
  }>;
  configuration?: {
    width?: string;
    finish?: string;
    luxe_upgrade?: boolean;
    installation?: string;
    stud_wall_removal?: boolean;
  };
  client_id?: string;
}

interface UseLeadsOptions {
  status?: Lead['status'];
  search?: string;
  limit?: number;
  offset?: number;
}

export const useLeads = (options: UseLeadsOptions = {}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching leads via edge function with options:', options);

      // Use the edge function to fetch leads
      const { data, error: functionError } = await supabase.functions.invoke('get-leads', {
        body: {
          limit: options.limit,
          offset: options.offset,
          search: options.search,
          status: options.status,
        }
      });

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error(functionError.message || 'Failed to fetch leads');
      }

      if (!data) {
        setLeads([]);
        return;
      }

      console.log('Received leads from edge function:', data.leads?.length || 0);
      console.log('Sample lead data structure:', data.leads?.[0] ? Object.keys(data.leads[0]) : 'No leads');
      console.log('First lead sample:', data.leads?.[0]);
      console.log('Debug info from edge function:', data.debug);
      
      // Fetch local status overrides and merge with external leads
      const { data: statusOverrides } = await supabase
        .from('lead_status_overrides')
        .select('*');

      console.log('Status overrides:', statusOverrides?.length || 0);
      
      // Transform and merge external leads with local status overrides
      const transformedLeads = (data.leads || []).map((lead: any) => transformLeadData(lead));
      const mergedLeads = transformedLeads.map((lead: Lead) => 
        mergeLeadWithStatusOverride(lead, statusOverrides || [])
      );

      // Apply status filter after merging
      const finalLeads = filterLeadsByStatus(mergedLeads, options.status);
      setLeads(finalLeads);

    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [options.status, options.search, options.limit, options.offset]);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    try {
      console.log('Updating lead:', id, updates);
      
      // If status is being updated, save it to lead_status_overrides
      if (updates.status) {
        const { data: currentUser } = await supabase.auth.getUser();
        if (!currentUser.user) {
          throw new Error('User not authenticated');
        }

        console.log('Saving status override for lead:', id, 'status:', updates.status);

        const { data: overrideData, error: overrideError } = await supabase
          .from('lead_status_overrides')
          .upsert({
            lead_id: id, // Fixed: using lead_id instead of external_lead_id
            status: updates.status,
            created_by: currentUser.user.id,
            notes: updates.notes || null
          }, {
            onConflict: 'lead_id'
          })
          .select();

        if (overrideError) {
          console.error('Error saving lead status override:', overrideError);
          throw new Error(`Failed to save lead status: ${overrideError.message}`);
        }

        console.log('Status override saved successfully:', overrideData);
      }
      
      // Update local state immediately
      setLeads(prev => prev.map(lead => 
        lead.id === id ? { ...lead, ...updates } : lead
      ));

      return { id, ...updates };
    } catch (err) {
      console.error('Error updating lead:', err);
      throw err;
    }
  }, []);

  const convertToClient = useCallback(async (lead: Lead) => {
    try {
      const clientData = await createOrFindClient(lead);
      await saveLeadHistory(lead, clientData.id);
      
      // Update the lead status to converted with the actual client_id
      await updateLead(lead.id, { 
        status: 'converted',
        client_id: clientData.id,
        notes: `Converted: ${lead.name} converted to client (ID: ${clientData.id})`
      });

      // Refresh leads to show updated status
      setTimeout(() => fetchLeads(), 100);

      return { id: clientData.id, name: lead.name };
    } catch (err) {
      console.error('Error converting lead to client:', err);
      throw err;
    }
  }, [updateLead, fetchLeads]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return {
    leads,
    loading,
    error,
    fetchLeads,
    updateLead,
    convertToClient,
  };
};
