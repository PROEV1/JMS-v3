
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

interface ImportRow {
  job_id?: string;
  lead_id?: string;
  partner_account?: string;
  installation_type?: string;
  type?: string;
  sub_type?: string;
  status?: string;
  assigned_engineers?: string;
  scheduled_date?: string;
  scheduled_duration_hours?: string;
  scheduled_time_of_day?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address_line_1?: string;
  customer_address_line_2?: string;
  customer_address_city?: string;
  customer_address_post_code?: string;
  instruction?: string;
  entered_status?: string;
  quote_currency_code?: string;
  quote_amount?: string;
  sla_overdue_by_days?: string;
  requote_reason?: string;
  on_hold_information_submitted?: string;
}

serve(async (req) => {
  console.log('Processing partner import request with JWT validation');

  try {
    const { partner_name, sheet_id, sheet_name, run_id } = await req.json();
    
    console.log('Processing import for partner:', partner_name);
    
    const startTime = performance.now()

    // Find partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, name')
      .eq('name', partner_name)
      .single();

    if (partnerError || !partner) {
      throw new Error(`Partner '${partner_name}' not found`);
    }

    // Get import profile
    const { data: importProfile, error: profileError } = await supabase
      .from('partner_import_profiles')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('is_active', true)
      .single();

    if (profileError || !importProfile) {
      throw new Error(`No active import profile found for partner '${partner_name}'`);
    }

    console.log('=== CALLING GOOGLE SHEETS PREVIEW FROM PARTNER-IMPORT ===');
    console.log('Sheet ID:', sheet_id + '...');
    console.log('Sheet name:', sheet_name);
    console.log('Auth header present:', !!req.headers.get('Authorization'));

    // Call Google Sheets preview function
    const authHeader = req.headers.get('Authorization');
    const sheetsResponse = await supabase.functions.invoke('google-sheets-preview', {
      body: { sheet_id, sheet_name },
      headers: {
        Authorization: authHeader || '',
        'Content-Type': 'application/json'
      }
    });

    console.log('Sheets response status:', sheetsResponse.status);
    console.log('Sheets response headers:', sheetsResponse.headers);

    if (sheetsResponse.error) {
      throw new Error(`Failed to fetch Google Sheets data: ${sheetsResponse.error.message}`);
    }

    const sheetsData = sheetsResponse.data;
    console.log('Google Sheets response:', JSON.stringify(sheetsData).substring(0, 1000) + '...[truncated]');

    if (!sheetsData.success || !sheetsData.headers || !sheetsData.rows) {
      throw new Error('Invalid Google Sheets response format');
    }

    const headers = sheetsData.headers;
    const rows = sheetsData.rows;

    console.log('Processing', rows.length, 'rows with headers:', headers);

    // Pre-load all engineers for mapping
    const { data: engineers, error: engineersError } = await supabase
      .from('engineers')
      .select('id, name, email')

    if (engineersError) {
      console.error('Error loading engineers:', engineersError);
    }

    const engineerMap = new Map();
    engineers?.forEach(eng => {
      engineerMap.set(eng.name.toLowerCase(), eng.id);
      engineerMap.set(eng.email.toLowerCase(), eng.id);
    });

    // Check for unmapped engineers
    const unmappedEngineers = new Set();
    rows.forEach((row: string[]) => {
      const engineerName = row[headers.indexOf('Assigned Engineers')]?.trim();
      if (engineerName && !engineerMap.has(engineerName.toLowerCase())) {
        unmappedEngineers.add(engineerName);
      }
    });

    console.log('Found', unmappedEngineers.size, 'unmapped engineers:', Array.from(unmappedEngineers));

    // Process rows in batches
    const BATCH_SIZE = 50;
    const results = {
      processed: 0,
      inserted_count: 0,
      updated_count: 0,
      skipped_count: 0,
      errors: [] as any[],
      warnings: [] as any[]
    };

    // Pre-load existing clients and orders for batch processing
    const existingClients = new Map();
    const existingOrders = new Map();

    // Load clients by email
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, email, full_name');

    clientsData?.forEach(client => {
      existingClients.set(client.email.toLowerCase(), client);
    });

    // Load existing orders by partner external ID
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, partner_external_id')
      .eq('partner_id', partner.id);

    ordersData?.forEach(order => {
      if (order.partner_external_id) {
        existingOrders.set(order.partner_external_id, order);
      }
    });

    console.log(`Pre-loaded ${existingClients.size} clients and ${existingOrders.size} orders`);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchStartTime = performance.now();

      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, rows ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)}`);

      // Process batch items
      const batchClients: any[] = [];
      const batchOrders: any[] = [];
      const batchQuotes: any[] = [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNumber = i + j + 1;

        try {
          // Map row data
          const mappedRow: ImportRow = {};
          headers.forEach((header: string, index: number) => {
            const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            mappedRow[key as keyof ImportRow] = row[index]?.toString().trim() || '';
          });

          const clientEmail = mappedRow.customer_email?.toLowerCase().trim();
          if (!clientEmail) {
            results.errors.push({ row: rowNumber, error: 'Missing customer email', data: mappedRow });
            continue;
          }

          // Check for existing order
          const externalId = mappedRow.job_id;
          if (externalId && existingOrders.has(externalId)) {
            results.skipped_count++;
            continue;
          }

          // Prepare client data
          let clientId = existingClients.get(clientEmail)?.id;
          if (!clientId) {
            const newClientId = crypto.randomUUID();
            const clientData = {
              id: newClientId,
              email: clientEmail,
              full_name: mappedRow.customer_name || 'Unknown',
              phone: mappedRow.customer_phone || null,
              address: mappedRow.customer_address_line_1 || null,
              postcode: mappedRow.customer_address_post_code || null,
            };
            batchClients.push(clientData);
            existingClients.set(clientEmail, { id: newClientId, ...clientData });
            clientId = newClientId;
          }

          // Map engineer
          let engineerId = null;
          const engineerName = mappedRow.assigned_engineers?.trim();
          if (engineerName) {
            engineerId = engineerMap.get(engineerName.toLowerCase()) || null;
          }

          // Prepare quote and order
          const quoteAmount = parseFloat(mappedRow.quote_amount || '0') || 0;
          const quoteId = crypto.randomUUID();
          const orderId = crypto.randomUUID();

          batchQuotes.push({
            id: quoteId,
            client_id: clientId,
            quote_number: `${partner.name}-${externalId || rowNumber}`,
            product_details: `Import from ${partner.name}`,
            total_cost: quoteAmount,
            status: 'accepted'
          });

          batchOrders.push({
            id: orderId,
            client_id: clientId,
            quote_id: quoteId,
            total_amount: quoteAmount,
            partner_id: partner.id,
            partner_external_id: externalId,
            is_partner_job: true,
            engineer_id: engineerId,
            scheduled_install_date: mappedRow.scheduled_date ? new Date(mappedRow.scheduled_date).toISOString() : null,
            partner_metadata: {
              import_run_id: run_id,
              original_status: mappedRow.status,
              sub_partner: mappedRow.partner_account
            }
          });

          results.processed++;

        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
          results.errors.push({
            row: rowNumber,
            error: error.message,
            data: row
          });
        }
      }

      // Insert batch data
      try {
        if (batchClients.length > 0) {
          const { error: clientsError } = await supabase
            .from('clients')
            .upsert(batchClients, { onConflict: 'email' });
          
          if (clientsError) {
            console.error('Batch clients insert error:', clientsError);
          }
        }

        if (batchQuotes.length > 0) {
          const { error: quotesError } = await supabase
            .from('quotes')
            .insert(batchQuotes);
          
          if (quotesError) {
            console.error('Batch quotes insert error:', quotesError);
          }
        }

        if (batchOrders.length > 0) {
          const { data: insertedOrders, error: ordersError } = await supabase
            .from('orders')
            .insert(batchOrders)
            .select('id');
          
          if (ordersError) {
            console.error('Batch orders insert error:', ordersError);
          } else {
            results.inserted_count += insertedOrders?.length || 0;
          }
        }

      } catch (batchError) {
        console.error('Batch insert error:', batchError);
        results.errors.push({
          batch: Math.floor(i / BATCH_SIZE) + 1,
          error: batchError.message
        });
      }

      const batchTime = performance.now() - batchStartTime;
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} completed in ${Math.round(batchTime)}ms`);
    }

    const totalTime = performance.now() - startTime;
    console.log(`Import completed in ${Math.round(totalTime)}ms:`, results);

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
