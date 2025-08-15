import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  total_price?: number; // New main price field
  product_details?: string;
  product_name?: string;
  product_price?: number;
  width_cm?: number;
  finish?: string; // New field
  luxe_upgrade?: boolean; // New field
  accessories_data?: any; // JSONB field from database
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
      
      // Merge external leads with local status overrides
      const mergedLeads = (data.leads || []).map((lead: Lead) => {
        const override = statusOverrides?.find(o => o.external_lead_id === lead.id);
        if (override) {
          return {
            ...lead,
            status: override.status,
            client_id: override.client_id,
            notes: override.notes || lead.notes
          };
        }
        return lead;
      });

      // Apply status filter after merging (since edge function doesn't handle this now)
      let finalLeads = mergedLeads;
      if (options.status) {
        finalLeads = mergedLeads.filter(lead => {
          const matches = lead.status === options.status;
          if (!matches) {
            console.log(`Lead ${lead.id} status '${lead.status}' doesn't match filter '${options.status}'`);
          }
          return matches;
        });
        console.log(`Filtered leads by status '${options.status}':`, finalLeads.length, 'out of', mergedLeads.length);
        console.log('Filtered leads:', finalLeads.map(l => ({ id: l.id, name: l.name, status: l.status })));
      }

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
            external_lead_id: id,
            status: updates.status,
            client_id: updates.client_id || null,
            updated_by: currentUser.user.id,
            notes: updates.notes || null
          }, {
            onConflict: 'external_lead_id'
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
      console.log('Converting lead to client:', lead.name);
      
      // First check if a client with this email already exists
      const { data: existingClients, error: searchError } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('email', lead.email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (searchError) {
        console.error('Error searching for existing client:', searchError);
        throw new Error(`Failed to search for existing client: ${searchError.message}`);
      }

      const existingClient = existingClients?.[0];

      let clientData;
      
      if (existingClient) {
        console.log('Using existing client:', existingClient);
        clientData = existingClient;
      } else {
        // Create a new client record
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            user_id: null, // No user account initially
            full_name: lead.name,
            email: lead.email,
            phone: lead.phone || null,
            address: null
          })
          .select()
          .single();

        if (clientError) {
          console.error('Error creating client record:', clientError);
          throw new Error(`Failed to create client record: ${clientError.message}`);
        }

        console.log('Client created successfully:', newClient);
        clientData = newClient;
      }

      // Save lead data to lead_history table with all new fields
      const { error: historyError } = await supabase
        .from('lead_history')
        .insert({
          client_id: clientData.id,
          original_lead_id: lead.id,
          lead_name: lead.name,
          lead_email: lead.email,
          lead_phone: lead.phone || null,
          lead_notes: lead.notes || null,
          product_name: lead.product_name || null,
          product_price: lead.product_price || null,
          width_cm: lead.width_cm || null,
          lead_created_at: lead.created_at,
          source: lead.source || null,
          status: lead.status,
          total_price: lead.total_price || null,
          accessories_data: lead.accessories_data || null,
          finish: lead.finish || lead.configuration?.finish || null,
          luxe_upgrade: lead.luxe_upgrade || lead.configuration?.luxe_upgrade || null
        });

      if (historyError) {
        console.error('Error saving lead history:', historyError);
        throw new Error(`Failed to save lead history: ${historyError.message}`);
      }
      
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
  }, [updateLead]);

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