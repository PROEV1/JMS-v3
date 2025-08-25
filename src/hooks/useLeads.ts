import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createOrFindClient, saveLeadHistory } from '@/utils/leadConversionUtils';
import { useAuth } from '@/hooks/useAuth';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status: string; // Changed from union type to string to match database
  created_at: string;
  updated_at: string;
  source?: string;
  notes?: string;
  quote_number?: string;
  quote_id?: string; // Add quote_id to track converted quotes
  total_cost?: number;
  total_price?: number;
  product_details?: string;
  product_name?: string;
  product_price?: number;
  accessories_data?: any;
  accessories?: Array<{
    name: string;
    price: number;
  }>;
  configuration?: any;
  client_id?: string;
  created_by?: string;
  address?: string;
}

interface UseLeadsOptions {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const useLeads = (options: UseLeadsOptions = {}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, session } = useAuth();

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
      setLeads((data || []) as Lead[]);

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
      
      // Use the auth context instead of making a fresh auth call
      if (!user || !session) {
        console.error('Authentication check failed - user or session missing:', { 
          hasUser: !!user, 
          hasSession: !!session 
        });
        throw new Error('Please sign in to create leads');
      }

      console.log('User authenticated, proceeding with lead creation:', user.id);

      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          ...leadData,
          created_by: user.id
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
  }, [fetchLeads, user, session]);

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

  const deleteLead = useCallback(async (id: string) => {
    try {
      console.log('Deleting lead:', id);
      
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting lead:', deleteError);
        throw new Error(`Failed to delete lead: ${deleteError.message}`);
      }

      console.log('Lead deleted successfully:', id);
      
      // Update local state immediately
      setLeads(prev => prev.filter(lead => lead.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting lead:', err);
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

  const convertToQuote = useCallback(async (lead: Lead) => {
    try {
      if (!lead.client_id) {
        throw new Error('Lead must have a client to convert to quote');
      }

      // Create basic quote data from lead
      const productDetails = lead.product_name || 'Lead product details';

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          client_id: lead.client_id,
          product_details: productDetails,
          materials_cost: 0,
          install_cost: 0,
          extras_cost: 0,
          total_cost: lead.total_price || lead.product_price || 0,
          warranty_period: '5 years',
          includes_installation: true,
          notes: `Created from lead: ${lead.name} (${lead.email})${lead.notes ? ` - ${lead.notes}` : ''}`,
          status: 'sent',
          quote_number: '' // Will be auto-generated by trigger
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // If we have product details, create a quote item
      if (lead.product_name && lead.product_price) {
        const { error: itemError } = await supabase
          .from('quote_items')
          .insert({
            quote_id: quote.id,
            product_name: lead.product_name,
            quantity: 1,
            unit_price: lead.product_price,
            total_price: lead.total_price || lead.product_price,
            configuration: lead.configuration || {}
          });

        if (itemError) {
          console.error('Error creating quote item:', itemError);
          // Don't throw here, the quote was created successfully
        }
      }

      // Update the lead status to converted
      await updateLead(lead.id, { 
        status: 'converted',
        quote_id: quote.id,
        notes: `${lead.notes || ''} - Converted to quote #${quote.quote_number}`
      });

      // Refresh leads to show updated status
      setTimeout(() => fetchLeads(), 100);

      return { id: quote.id, quote_number: quote.quote_number };
    } catch (err) {
      console.error('Error converting lead to quote:', err);
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
    deleteLead,
    convertToClient,
    convertToQuote,
  };
};
