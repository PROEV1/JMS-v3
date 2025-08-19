
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
      // Fetch from Google Sheets - INLINE IMPLEMENTATION
      console.log('=== FETCHING GOOGLE SHEETS DATA INLINE ===');
      console.log('Sheet ID:', importProfile.gsheet_id);
      console.log('Sheet name:', importProfile.gsheet_sheet_name);

      // Get Google Service Account credentials
      const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
      console.log('Google Service Account Key configured:', !!serviceAccountKey);
      
      if (!serviceAccountKey) {
        throw new Error('Google Service Account credentials not configured. Please add the GOOGLE_SERVICE_ACCOUNT_KEY secret in Supabase.');
      }

      let credentials;
      try {
        credentials = JSON.parse(serviceAccountKey);
        console.log('Google credentials parsed successfully, client_email:', credentials.client_email);
        
        // Validate required fields
        const requiredFields = ['client_email', 'private_key', 'token_uri', 'project_id'];
        const missingFields = requiredFields.filter(field => !credentials[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Invalid Google Service Account credentials: missing ${missingFields.join(', ')}`);
        }
      } catch (parseError) {
        throw new Error(`Invalid Google Service Account credentials format: ${parseError.message}`);
      }

      // Generate JWT for Google API authentication
      console.log('Generating JWT for Google API...');
      
      const header = { alg: 'RS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
      };

      const encoder = new TextEncoder();
      const headerB64 = btoa(JSON.stringify(header)).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
      const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
      const signatureInput = `${headerB64}.${payloadB64}`;

      // Import private key and sign JWT
      let privateKey;
      try {
        console.log('Importing private key...');
        privateKey = await crypto.subtle.importKey(
          'pkcs8',
          new Uint8Array(atob(credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')).split('').map(c => c.charCodeAt(0))),
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['sign']
        );
        console.log('Private key imported successfully');
      } catch (keyError) {
        throw new Error(`Failed to process Google Service Account private key: ${keyError.message}`);
      }

      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoder.encode(signatureInput));
      const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
      const jwt = `${signatureInput}.${signatureB64}`;
      console.log('JWT generated successfully');

      // Get access token
      console.log('Requesting access token from Google...');
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        console.error('Failed to get access token:', tokenData);
        throw new Error(`Failed to authenticate with Google API: ${tokenData.error || 'Unknown error'}`);
      }
      console.log('Access token obtained successfully');

      // Get spreadsheet metadata
      console.log('Getting spreadsheet metadata...');
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${importProfile.gsheet_id}`;
      const metadataResponse = await fetch(metadataUrl, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      if (!metadataResponse.ok) {
        const metadataError = await metadataResponse.json();
        console.error('Failed to get spreadsheet metadata:', metadataError);
        if (metadataResponse.status === 404) {
          throw new Error('Google Sheet not found. Please check the Sheet ID and ensure the sheet exists.');
        } else if (metadataResponse.status === 403) {
          throw new Error(`Access denied to Google Sheet. Please share the sheet with the service account email: ${credentials.client_email}`);
        }
        throw new Error('Failed to access spreadsheet metadata. Please check Sheet ID and permissions.');
      }

      const metadata = await metadataResponse.json();
      console.log('Available sheets:', metadata.sheets?.map((s: any) => s.properties.title));
      
      // Find the correct sheet name (case-insensitive)
      const availableSheets = metadata.sheets?.map((s: any) => s.properties.title) || [];
      let actualSheetName = importProfile.gsheet_sheet_name;
      
      if (!availableSheets.includes(importProfile.gsheet_sheet_name)) {
        // Try to find a case-insensitive match
        const lowerSheetName = importProfile.gsheet_sheet_name.toLowerCase();
        const matchedSheet = availableSheets.find((name: string) => name.toLowerCase() === lowerSheetName);
        
        if (matchedSheet) {
          actualSheetName = matchedSheet;
          console.log(`Sheet name corrected from "${importProfile.gsheet_sheet_name}" to "${actualSheetName}"`);
        } else {
          throw new Error(`Sheet "${importProfile.gsheet_sheet_name}" not found. Available sheets: ${availableSheets.join(', ')}`);
        }
      }

      // Fetch sheet data
      let range;
      const previewRows = 1000; // Get more rows for import processing
      if (actualSheetName.includes(' ') || actualSheetName.includes("'")) {
        range = `'${actualSheetName.replace(/'/g, "''")}'!A1:ZZ${previewRows + 1}`;
      } else {
        range = `${actualSheetName}!A1:ZZ${previewRows + 1}`;
      }
      
      console.log(`Fetching range: "${range}"`);
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${importProfile.gsheet_id}/values/${encodeURIComponent(range)}`;
      
      const sheetsResponse = await fetch(sheetsUrl, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      const sheetsData = await sheetsResponse.json();
      console.log('Sheets API response status:', sheetsResponse.status);
      
      if (!sheetsResponse.ok) {
        console.error('Sheets API error:', sheetsData);
        
        let errorMessage = 'Failed to fetch Google Sheets data';
        if (sheetsResponse.status === 404) {
          errorMessage = 'Google Sheet not found. Please check the Sheet ID and ensure the sheet exists.';
        } else if (sheetsResponse.status === 403) {
          errorMessage = `Access denied to Google Sheet. Please share the sheet with the service account email: ${credentials.client_email}`;
        } else if (sheetsData.error?.message) {
          errorMessage = sheetsData.error.message;
        }
        
        throw new Error(errorMessage);
      }

      const values = sheetsData.values || [];
      console.log('Sheet data fetched successfully, rows:', values.length);
      
      if (values.length < 2) {
        throw new Error('Google Sheet must have at least a header row and one data row');
      }

      headers = values[0] || [];
      rows = values.slice(1) || [];
      
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
              user_id: null, // Partner clients don't have user accounts initially
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            batchClients.push(clientData);
            existingClients.set(clientEmail, { id: newClientId, email: clientEmail, full_name: clientData.full_name });
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

          // Parse date in DD/MM/YYYY format
          let scheduledInstallDate = null;
          if (mappedRow.scheduled_date && mappedRow.scheduled_date.trim()) {
            try {
              const dateStr = mappedRow.scheduled_date.trim();
              // Check if it's in DD/MM/YYYY format
              if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const [day, month, year] = dateStr.split('/');
                // Create date in ISO format (YYYY-MM-DD)
                const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                scheduledInstallDate = new Date(isoDate).toISOString();
              } else {
                // Try parsing as-is for other formats
                scheduledInstallDate = new Date(dateStr).toISOString();
              }
              
              // Validate the date
              if (isNaN(new Date(scheduledInstallDate).getTime())) {
                console.warn(`Invalid date for row ${rowNumber}: ${dateStr}`);
                scheduledInstallDate = null;
              }
            } catch (dateError) {
              console.warn(`Date parsing error for row ${rowNumber}: ${mappedRow.scheduled_date}, error: ${dateError.message}`);
              scheduledInstallDate = null;
            }
          }

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
            scheduled_install_date: scheduledInstallDate,
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
          // Insert clients first - check for duplicates and only insert new ones
          const validClientIds = new Set();
          
          if (batchClients.length > 0) {
            console.log(`Processing ${batchClients.length} clients...`);
            
            // Get emails to check for existing clients
            const emailsToCheck = batchClients.map(c => c.email);
            const { data: existingClientsInBatch } = await supabase
              .from('clients')
              .select('id, email')
              .in('email', emailsToCheck);
            
            // Track existing clients from this batch
            const existingEmailMap = new Map();
            existingClientsInBatch?.forEach(client => {
              existingEmailMap.set(client.email, client.id);
              validClientIds.add(client.id);
            });
            
            // Only insert clients that don't already exist
            const newClients = batchClients.filter(client => !existingEmailMap.has(client.email));
            
            if (newClients.length > 0) {
              console.log(`Inserting ${newClients.length} new clients...`);
              const { data: insertedClients, error: clientsError } = await supabase
                .from('clients')
                .insert(newClients)
                .select('id, email');
              
              if (clientsError) {
                console.error('Batch clients insert error:', clientsError);
                throw clientsError;
              } else {
                console.log(`Successfully inserted ${insertedClients?.length || 0} clients`);
                // Track newly inserted clients
                insertedClients?.forEach(client => {
                  validClientIds.add(client.id);
                });
              }
            } else {
              console.log('All clients already exist, skipping insert');
            }
            
            // Add all batch client IDs to valid set (existing + new)
            batchClients.forEach(client => {
              const existingId = existingEmailMap.get(client.email);
              if (existingId) {
                validClientIds.add(existingId);
              } else {
                validClientIds.add(client.id);
              }
            });
          }

          // Add any existing clients from the pre-loaded data that are used in this batch
          batchOrders.forEach(order => {
            // Check if this client was already in our existing clients map
            for (const [email, clientData] of existingClients.entries()) {
              if (clientData.id === order.client_id) {
                validClientIds.add(order.client_id);
              }
            }
          });

          // Only insert quotes and orders for clients that are valid
          const validQuotes = batchQuotes.filter(quote => validClientIds.has(quote.client_id));
          const validOrders = batchOrders.filter(order => validClientIds.has(order.client_id));

          if (validQuotes.length > 0) {
            console.log(`Inserting ${validQuotes.length} quotes...`);
            const { error: quotesError } = await supabase
              .from('quotes')
              .insert(validQuotes);
            
            if (quotesError) {
              console.error('Batch quotes insert error:', quotesError);
              throw quotesError;
            }
          }

          if (validOrders.length > 0) {
            console.log(`Inserting ${validOrders.length} orders...`);
            const { data: insertedOrders, error: ordersError } = await supabase
              .from('orders')
              .insert(validOrders)
              .select('id');
            
            if (ordersError) {
              console.error('Batch orders insert error:', ordersError);
              throw ordersError;
            } else {
              results.inserted_count += insertedOrders?.length || 0;
              console.log(`Successfully inserted ${insertedOrders?.length || 0} orders`);
            }
          }

          // Track any skipped items due to client creation failures
          const skippedQuotes = batchQuotes.length - validQuotes.length;
          const skippedOrders = batchOrders.length - validOrders.length;
          if (skippedQuotes > 0 || skippedOrders > 0) {
            console.log(`Skipped ${skippedQuotes} quotes and ${skippedOrders} orders due to client creation issues`);
            results.skipped_count += skippedOrders;
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
