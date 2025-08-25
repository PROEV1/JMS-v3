
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/hooks/useLeads';

export const createOrFindClient = async (lead: Lead) => {
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

  if (existingClient) {
    console.log('Using existing client:', existingClient);
    return existingClient;
  }

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
  return newClient;
};

export const saveLeadHistory = async (lead: Lead, clientId: string) => {
  const { error: historyError } = await supabase
    .from('lead_history')
    .insert({
      client_id: clientId,
      original_lead_id: lead.id,
      lead_name: lead.name,
      lead_email: lead.email,
      lead_phone: lead.phone || null,
      lead_notes: lead.notes || null,
      product_name: lead.product_name || null,
      product_price: lead.product_price || null,
      lead_created_at: lead.created_at,
      source: lead.source || null,
      status: lead.status,
      total_price: lead.total_price || null,
      accessories_data: lead.accessories_data || null
    });

  if (historyError) {
    console.error('Error saving lead history:', historyError);
    throw new Error(`Failed to save lead history: ${historyError.message}`);
  }
};
