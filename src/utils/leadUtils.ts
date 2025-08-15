
import { Lead } from '@/hooks/useLeads';

export const transformLeadData = (lead: any): Lead => {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    status: lead.status || 'new',
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    source: lead.source,
    notes: lead.notes,
    quote_number: lead.quote_number,
    total_cost: lead.total_cost,
    total_price: lead.total_price,
    product_details: lead.product_details,
    product_name: lead.product_name,
    product_price: lead.product_price,
    width_cm: lead.width_cm,
    finish: lead.finish,
    luxe_upgrade: lead.luxe_upgrade,
    accessories_data: lead.accessories_data,
    accessories: lead.accessories,
    configuration: lead.configuration,
    client_id: lead.client_id,
    created_by: lead.created_by
  };
};

export const filterLeadsByStatus = (leads: Lead[], status?: Lead['status']): Lead[] => {
  if (!status) return leads;
  
  const filtered = leads.filter(lead => {
    const matches = lead.status === status;
    if (!matches) {
      console.log(`Lead ${lead.id} status '${lead.status}' doesn't match filter '${status}'`);
    }
    return matches;
  });
  
  console.log(`Filtered leads by status '${status}':`, filtered.length, 'out of', leads.length);
  console.log('Filtered leads:', filtered.map(l => ({ id: l.id, name: l.name, status: l.status })));
  
  return filtered;
};

export const validateLeadData = (leadData: Partial<Lead>): string[] => {
  const errors: string[] = [];
  
  if (!leadData.name?.trim()) {
    errors.push('Name is required');
  }
  
  if (!leadData.email?.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email)) {
    errors.push('Valid email is required');
  }
  
  if (leadData.phone && leadData.phone.trim() && !/^[\+]?[0-9\s\-\(\)]+$/.test(leadData.phone)) {
    errors.push('Valid phone number is required');
  }
  
  return errors;
};
