
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  created_by?: string;
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
      
      console.log('Fetching leads from local database with options:', options);

      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply status filter
      if (options.status) {
        query = query.eq('status', options.status);
      }

      // Apply search filter
      if (options.search) {
        query = query.or(
          `name.ilike.%${options.search}%,email.ilike.%${options.search}%,product_details.ilike.%${options.search}%`
        );
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching leads:', fetchError);
        throw new Error(fetchError.message);
      }

      console.log('Successfully fetched leads:', data?.length || 0);
      setLeads(data || []);

    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [options.status, options.search, options.limit, options.offset]);

  const createLead = useCallback(async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('Creating new lead:', leadData);
      
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('User not authenticated');
      }

      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          ...leadData,
          created_by: currentUser.user.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating lead:', createError);
        throw new Error(`Failed to create lead: ${createError.message}`);
      }

      console.log('Lead created successfully:', newLead);
      
      // Refresh leads to show the new one
      await fetchLeads();
      
      return newLead;
    } catch (err) {
      console.error('Error creating lead:', err);
      throw err;
    }
  }, [fetchLeads]);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    try {
      console.log('Updating lead:', id, updates);
      
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating lead:', updateError);
        throw new Error(`Failed to update lead: ${updateError.message}`);
      }

      console.log('Lead updated successfully:', updatedLead);
      
      // Update local state immediately
      setLeads(prev => prev.map(lead => 
        lead.id === id ? { ...lead, ...updates } : lead
      ));

      return updatedLead;
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
    createLead,
    updateLead,
    convertToClient,
  };
};
