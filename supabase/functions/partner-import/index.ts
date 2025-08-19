
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
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      });
    }

    // Validate request method
    if (req.method !== 'POST') {
      throw new Error('Only POST requests are allowed');
    }

    // Parse and validate request body
    let body;
    try {
      const text = await req.text();
      console.log('Request body text length:', text.length);
      
      if (!text || text.trim() === '') {
        throw new Error('Request body is empty');
      }
      
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      throw new Error(`Invalid JSON in request body: ${parseError.message}`);
    }

    const { profile_id, dry_run = true, create_missing_orders = true, csv_data } = body;
    
    // Validate required parameters
    if (!profile_id) {
      throw new Error('Missing required parameter: profile_id');
    }
    
    console.log('Processing import for profile_id:', profile_id);
    console.log('Dry run mode:', dry_run);
    console.log('CSV data provided:', !!csv_data);
    
    const startTime = performance.now();
    const run_id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get import profile
    const { data: importProfile, error: profileError } = await supabase
      .from('partner_import_profiles')
      .select('*, partners!inner(id, name)')
      .eq('id', profile_id)
      .eq('is_active', true)
      .single();

    if (profileError || !importProfile) {
      throw new Error(`Import profile not found or inactive: ${profile_id}`);
    }

    const partner = importProfile.partners;
    console.log('Found partner:', partner.name);

    let headers: string[] = [];
    let rows: string[][] = [];

    // Handle data source - CSV data or Google Sheets
    if (csv_data) {
      // Parse CSV data
      console.log('Processing CSV data');
      const lines = csv_data.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV data must have at least a header row and one data row');
      }
      
      headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      rows = lines.slice(1).map(line => 
        line.split(',').map(cell => cell.trim().replace(/"/g, ''))
      );
      
    } else if ((importProfile.source_type === 'google_sheets' || importProfile.source_type === 'gsheet') && importProfile.gsheet_id && importProfile.gsheet_sheet_name) {
      // Fetch from Google Sheets
      console.log('=== CALLING GOOGLE SHEETS PREVIEW FROM PARTNER-IMPORT ===');
      console.log('Sheet ID:', importProfile.gsheet_id);
      console.log('Sheet name:', importProfile.gsheet_sheet_name);
      console.log('Auth header present:', !!req.headers.get('Authorization'));

      const authHeader = req.headers.get('Authorization');
      const sheetsResponse = await supabase.functions.invoke('google-sheets-preview', {
        body: { 
          sheet_id: importProfile.gsheet_id, 
          sheet_name: importProfile.gsheet_sheet_name 
        },
        headers: {
          Authorization: authHeader || '',
          'Content-Type': 'application/json'
        }
      });

      console.log('Sheets response status:', sheetsResponse.status);
      
      if (sheetsResponse.error) {
        throw new Error(`Failed to fetch Google Sheets data: ${sheetsResponse.error.message}`);
      }

      const sheetsData = sheetsResponse.data;
      console.log('Google Sheets response preview:', JSON.stringify(sheetsData).substring(0, 500) + '...[truncated]');

      if (!sheetsData.success || !sheetsData.headers || !sheetsData.rows) {
        throw new Error('Invalid Google Sheets response format');
      }

      headers = sheetsData.headers;
      rows = sheetsData.rows;
      
    } else {
      throw new Error('No data source available - provide csv_data or configure Google Sheets in the profile');
    }

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

      // Insert batch data (only if not a dry run)
      try {
        if (!dry_run) {
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
        } else {
          // Dry run - just count what would be inserted
          results.inserted_count += batchOrders.length;
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
    console.log(`Import ${dry_run ? 'dry run' : 'execution'} completed in ${Math.round(totalTime)}ms:`, results);

    // Log the import
    try {
      await supabase.rpc('log_partner_import', {
        p_run_id: run_id,
        p_partner_id: partner.id,
        p_profile_id: profile_id,
        p_dry_run: dry_run,
        p_total_rows: results.processed,
        p_inserted_count: results.inserted_count,
        p_updated_count: results.updated_count,
        p_skipped_count: results.skipped_count,
        p_warnings: JSON.stringify(results.warnings),
        p_errors: JSON.stringify(results.errors)
      });
    } catch (logError) {
      console.error('Failed to log import:', logError);
    }

    // Format response to match frontend expectations
    const response = {
      success: true,
      summary: {
        processed: results.processed,
        inserted_count: dry_run ? 0 : results.inserted_count,
        updated_count: dry_run ? 0 : results.updated_count,
        skipped_count: results.skipped_count,
        errors: results.errors,
        warnings: results.warnings,
        run_id: run_id,
        partner_name: partner.name,
        total_time_ms: Math.round(totalTime),
        dry_run: dry_run
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        }
      }
    );
  }
});
