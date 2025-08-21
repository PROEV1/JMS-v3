
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

    // Create header resolver function using column mappings
    const resolveHeader = (logicalKey: string): string | null => {
      // First try to use the column mapping from the import profile
      if (importProfile.column_mappings?.[logicalKey]) {
        const mappedHeader = importProfile.column_mappings[logicalKey];
        console.log(`Resolved ${logicalKey} => '${mappedHeader}'`);
        return mappedHeader;
      }

      // Fallback to normalized header matching for backwards compatibility
      const fallbackMappings: Record<string, string[]> = {
        'partner_external_id': ['Job ID', 'job_id'],
        'partner_status': ['Status', 'status'],
        'engineer_identifier': ['Assigned Engineers', 'assigned_engineers'],
        'scheduled_date': ['Scheduled Date', 'scheduled_date'],
        'estimated_duration_hours': ['Duration', 'Estimated Duration', 'Duration Hours', 'estimated_duration_hours'],
        'client_name': ['Customer Name', 'customer_name'],
        'client_email': ['Customer Email', 'customer_email'],
        'client_phone': ['Customer Phone', 'customer_phone'],
        'customer_address_line_1': ['Customer Address Line 1', 'customer_address_line_1'],
        'customer_address_line_2': ['Customer Address Line 2', 'customer_address_line_2'],
        'customer_address_city': ['Customer Address City', 'customer_address_city'],
        'customer_address_post_code': ['Customer Address Post Code', 'customer_address_post_code'],
        'type': ['Type', 'Installation Type', 'type'],
        'quote_amount': ['Quote Amount', 'quote_amount']
      };

      const possibleHeaders = fallbackMappings[logicalKey] || [];
      for (const possibleHeader of possibleHeaders) {
        if (headers.includes(possibleHeader)) {
          console.log(`Fallback resolved ${logicalKey} => '${possibleHeader}'`);
          return possibleHeader;
        }
      }

      return null;
    };

    // Load engineers for mapping
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

    // Check for unmapped engineers using resolved header
    const unmappedEngineers = new Set();
    const engineerHeader = resolveHeader('engineer_identifier');
    if (engineerHeader) {
      rows.forEach((row: string[]) => {
        const engineerName = row[headers.indexOf(engineerHeader)]?.trim();
        if (engineerName && !engineerMap.has(engineerName.toLowerCase())) {
          unmappedEngineers.add(engineerName);
        }
      });
    }

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

    // Load engineer mappings and existing orders for idempotent processing
    console.log('\n=== Loading Engineer Mappings ===');
    const { data: engineerMappings } = await supabase
      .from('partner_engineer_mappings')
      .select('partner_engineer_name, engineer_id, engineers(id, name)')
      .eq('partner_id', partner.id)
      .eq('is_active', true);
      
    console.log(`Loaded ${engineerMappings?.length || 0} engineer mappings`);
    
    // Clear the engineer map and repopulate with partner mappings
    engineerMap.clear();
    engineerMappings?.forEach(mapping => {
      engineerMap.set(mapping.partner_engineer_name.toLowerCase(), mapping.engineer_id);
    });
    
    // Get status mappings from profile
    const statusMapping = importProfile.status_mappings || {};
    const statusOverrides = importProfile.status_override_rules || {};
    
    console.log('Status mapping:', statusMapping);
    console.log('Status overrides:', statusOverrides);
    
    // Process data in batches with idempotent upserts
    console.log(`\n=== PROCESSING ${rows.length} ROWS ===`);
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(rows.length/BATCH_SIZE)}: ${batch.length} rows`);
    
    for (const row of batch) {
      try {
        console.log(`\n--- Processing Row ${batch.indexOf(row) + 1 + i} ---`);
        
        // Extract data using resolved headers
        const getValue = (logicalKey: string): string => {
          const header = resolveHeader(logicalKey);
          if (!header) return '';
          const headerIndex = headers.indexOf(header);
          return headerIndex >= 0 ? (row[headerIndex]?.toString().trim() || '') : '';
        };

        const mappedData = {
          job_id: getValue('partner_external_id'),
          status: getValue('partner_status'),
          engineer_name: getValue('engineer_identifier'),
          install_date: getValue('scheduled_date'),
          time_slot: getValue('time_slot'),
          client_name: getValue('client_name'),
          client_email: getValue('client_email'),
          client_phone: getValue('client_phone'),
          client_address: [
            getValue('customer_address_line_1'),
            getValue('customer_address_line_2'),
            getValue('customer_address_city')
          ].filter(Boolean).join(', ') || null,
          postcode: getValue('customer_address_post_code'),
          total_amount: getValue('quote_amount'),
          sub_partner: getValue('sub_partner'),
          deep_link: getValue('deep_link')
        };
        
        console.log('Mapped data:', JSON.stringify(mappedData, null, 2));
        
        // Apply status mapping
        let mappedStatus = mappedData.status || 'pending';
        if (statusMapping[mappedStatus]) {
          mappedStatus = statusMapping[mappedStatus];
        }
        
        // Apply status override rules
        if (statusOverrides[mappedStatus]) {
          mappedStatus = statusOverrides[mappedStatus];
        }
        
        console.log(`Status mapping: ${mappedData.status} -> ${mappedStatus}`);
        
        // Skip rows with missing required data
        if (!mappedData.client_name || !mappedData.client_email) {
          results.skipped_count++;
          results.warnings.push({
            row: i + batch.indexOf(row) + 1,
            message: 'Missing required client data (name/email)',
            data: mappedData
          });
          continue;
        }
        
        // Skip if job_id is missing (required for idempotent processing)
        if (!mappedData.job_id) {
          results.skipped_count++;
          results.warnings.push({
            row: i + batch.indexOf(row) + 1,
            message: 'Missing job_id - required for partner imports',
            data: mappedData
          });
          continue;
        }
        
        let client_id: string;
        let isExistingClient = false;
        
        // Check if client exists
        const { data: existingClient, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('email', mappedData.client_email)
          .maybeSingle();
          
        if (clientError && clientError.code !== 'PGRST116') {
          console.error('Client lookup error:', clientError);
          results.skipped_count++;
          results.errors.push({
            row: i + batch.indexOf(row) + 1,
            error: `Client lookup failed: ${clientError.message}`,
            data: mappedData
          });
          continue;
        }
        
        if (existingClient) {
          client_id = existingClient.id;
          isExistingClient = true;
          console.log(`Found existing client: ${client_id}`);
        } else {
          // Create new client
          if (!dry_run && create_missing_orders) {
            const { data: newClient, error: createClientError } = await supabase
              .from('clients')
              .insert({
                full_name: mappedData.client_name,
                email: mappedData.client_email,
                phone: mappedData.client_phone || null,
                address: mappedData.client_address || null,
                postcode: mappedData.postcode || null,
              })
              .select('id')
              .single();
              
            if (createClientError) {
              console.error('Client creation error:', createClientError);
              results.skipped_count++;
              results.errors.push({
                row: i + batch.indexOf(row) + 1,
                error: `Client creation failed: ${createClientError.message}`,
                data: mappedData
              });
              continue;
            }
            
            client_id = newClient.id;
            console.log(`Created new client: ${client_id}`);
          } else {
            client_id = 'dry-run-client-id';
            console.log('DRY RUN: Would create new client');
          }
          results.inserted_count++;
        }
        
        // Check for existing order with same partner_id + partner_external_id
        const { data: existingOrder, error: orderLookupError } = await supabase
          .from('orders')
          .select('id, status_enhanced, engineer_id, scheduled_install_date, partner_status')
          .eq('partner_id', partner.id)
          .eq('partner_external_id', mappedData.job_id)
          .maybeSingle();
          
        if (orderLookupError && orderLookupError.code !== 'PGRST116') {
          console.error('Order lookup error:', orderLookupError);
          results.skipped_count++;
          results.errors.push({
            row: i + batch.indexOf(row) + 1,
            error: `Order lookup failed: ${orderLookupError.message}`,
            data: mappedData
          });
          continue;
        }
        
        let order_id: string;
        let quote_id: string;
        
        if (existingOrder) {
          // Handle overrides: On Hold, Cancellation, Completed
          if (['on_hold', 'cancelled', 'completed'].includes(mappedStatus)) {
            if (!dry_run) {
              // Update order status and clear scheduling if needed
              const updateData: any = {
                partner_status: mappedStatus,
                partner_metadata: {
                  ...existingOrder.partner_metadata,
                  status_updated_at: new Date().toISOString(),
                  import_run_id: run_id
                }
              };
              
              // Clear scheduling for cancelled/completed jobs
              if (['cancelled', 'completed'].includes(mappedStatus)) {
                updateData.engineer_id = null;
                updateData.scheduled_install_date = null;
                updateData.scheduling_suppressed = true;
                updateData.scheduling_suppressed_reason = `Partner marked as ${mappedStatus}`;
              }
              
              const { error: updateError } = await supabase
                .from('orders')
                .update(updateData)
                .eq('id', existingOrder.id);
                
              if (updateError) {
                console.error('Order update error:', updateError);
                results.skipped_count++;
                results.errors.push({
                  row: i + batch.indexOf(row) + 1,
                  error: `Order update failed: ${updateError.message}`,
                  data: mappedData
                });
                continue;
              }
              
              console.log(`Updated existing order ${existingOrder.id} with ${mappedStatus} status`);
            } else {
              console.log(`DRY RUN: Would update order ${existingOrder.id} with ${mappedStatus} status`);
            }
            
            results.updated_count++;
            continue;
          }
          
          // Update existing order
          order_id = existingOrder.id;
          console.log(`Found existing order: ${order_id}`);
          
          // Map engineer if provided
          let mapped_engineer_id = existingOrder.engineer_id;
          if (mappedData.engineer_name) {
            const engineerKey = mappedData.engineer_name.toLowerCase().trim();
            if (engineerMap.has(engineerKey)) {
              mapped_engineer_id = engineerMap.get(engineerKey);
              console.log(`Mapped engineer: ${mappedData.engineer_name} -> ${mapped_engineer_id}`);
            } else {
              results.warnings.push({
                row: i + batch.indexOf(row) + 1,
                message: `Unknown engineer: ${mappedData.engineer_name}`,
                data: mappedData
              });
            }
          }
          
          // Update order with new data
          if (!dry_run) {
            const updateData: any = {
              partner_status: mappedStatus,
              partner_metadata: {
                updated_at: new Date().toISOString(),
                import_run_id: run_id,
                source_row: i + batch.indexOf(row) + 1,
                sub_partner: mappedData.sub_partner || null,
                partner_url: mappedData.deep_link || null
              },
            };
            
            // Update engineer assignment if mapped
            if (mapped_engineer_id && mapped_engineer_id !== existingOrder.engineer_id) {
              updateData.engineer_id = mapped_engineer_id;
            }
            
            // Handle date/slot mapping for confirmed jobs
            if (mappedStatus === 'confirmed' && mappedData.install_date) {
              const installDate = new Date(mappedData.install_date);
              if (!isNaN(installDate.getTime())) {
                updateData.scheduled_install_date = installDate.toISOString();
                updateData.scheduling_suppressed = false; // Allow scheduling
              }
            }
            
            const { error: updateError } = await supabase
              .from('orders')
              .update(updateData)
              .eq('id', existingOrder.id);
              
            if (updateError) {
              console.error('Order update error:', updateError);
              results.skipped_count++;
              results.errors.push({
                row: i + batch.indexOf(row) + 1,
                error: `Order update failed: ${updateError.message}`,
                data: mappedData
              });
              continue;
            }
            
            console.log(`Updated order: ${existingOrder.id}`);
          } else {
            console.log('DRY RUN: Would update existing order');
          }
          
          results.updated_count++;
        } else {
          // Create new order if create_missing_orders is true
          if (!create_missing_orders) {
            results.skipped_count++;
            results.warnings.push({
              row: i + batch.indexOf(row) + 1,
              message: 'Order not found and create_missing_orders is false',
              data: mappedData
            });
            continue;
          }
          
          // Create quote first
          const quoteData = {
            client_id,
            quote_number: `PARTNER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            total_amount: parseFloat(mappedData.total_amount) || 0,
            status: 'accepted',
            is_shareable: true,
            products_data: [],
          };
          
          if (!dry_run) {
            const { data: newQuote, error: quoteError } = await supabase
              .from('quotes')
              .insert(quoteData)
              .select('id')
              .single();
              
            if (quoteError) {
              console.error('Quote creation error:', quoteError);
              results.skipped_count++;
              results.errors.push({
                row: i + batch.indexOf(row) + 1,
                error: `Quote creation failed: ${quoteError.message}`,
                data: mappedData
              });
              continue;
            }
            
            quote_id = newQuote.id;
            console.log(`Created quote: ${quote_id}`);
          } else {
            quote_id = 'dry-run-quote-id';
            console.log('DRY RUN: Would create quote');
          }
          
          // Map engineer if provided
          let mapped_engineer_id = null;
          if (mappedData.engineer_name) {
            const engineerKey = mappedData.engineer_name.toLowerCase().trim();
            if (engineerMap.has(engineerKey)) {
              mapped_engineer_id = engineerMap.get(engineerKey);
              console.log(`Mapped engineer: ${mappedData.engineer_name} -> ${mapped_engineer_id}`);
            } else {
              results.warnings.push({
                row: i + batch.indexOf(row) + 1,
                message: `Unknown engineer: ${mappedData.engineer_name}`,
                data: mappedData
              });
            }
          }
          
          // Create order
          const orderData: any = {
            client_id,
            quote_id,
            total_amount: parseFloat(mappedData.total_amount) || 0,
            amount_paid: 0,
            deposit_amount: 0,
            status: 'awaiting_payment',
            is_partner_job: true,
            partner_id: partner.id,
            partner_external_id: mappedData.job_id,
            partner_status: mappedStatus,
            partner_metadata: {
              imported_at: new Date().toISOString(),
              import_run_id: run_id,
              source_row: i + batch.indexOf(row) + 1,
              sub_partner: mappedData.sub_partner || null,
              partner_url: mappedData.deep_link || null
            },
            postcode: mappedData.postcode || null,
            engineer_id: mapped_engineer_id,
          };
          
          // Handle date/slot for confirmed jobs
          if (mappedStatus === 'confirmed' && mappedData.install_date) {
            const installDate = new Date(mappedData.install_date);
            if (!isNaN(installDate.getTime())) {
              orderData.scheduled_install_date = installDate.toISOString();
              orderData.scheduling_suppressed = false;
            }
          } else {
            orderData.scheduling_suppressed = true; // Suppress until confirmed
          }
          
          if (!dry_run) {
            const { data: newOrder, error: orderError } = await supabase
              .from('orders')
              .insert(orderData)
              .select('id')
              .single();
              
            if (orderError) {
              console.error('Order creation error:', orderError);
              results.skipped_count++;
              results.errors.push({
                row: i + batch.indexOf(row) + 1,
                error: `Order creation failed: ${orderError.message}`,
                data: mappedData
              });
              continue;
            }
            
            console.log(`Created order: ${newOrder.id}`);
            order_id = newOrder.id;
          } else {
            console.log('DRY RUN: Would create order');
            order_id = 'dry-run-order-id';
          }
          
          results.inserted_count++;
        }
        
        // Handle calendar blocking for confirmed installs
        if (mappedStatus === 'confirmed' && mappedData.install_date && mappedData.engineer_name) {
          const installDate = new Date(mappedData.install_date);
          const engineerKey = mappedData.engineer_name.toLowerCase().trim();
          
          if (!isNaN(installDate.getTime()) && engineerMap.has(engineerKey)) {
            const engineer_id = engineerMap.get(engineerKey);
            const timeSlot = mappedData.time_slot || 'full_day';
            
            if (!dry_run) {
              // Upsert calendar block
              const { error: blockError } = await supabase
                .from('partner_calendar_blocks')
                .upsert({
                  partner_id: partner.id,
                  engineer_id: engineer_id,
                  blocked_date: installDate.toISOString().split('T')[0],
                  time_slot: timeSlot,
                  block_status: 'confirmed',
                  partner_job_id: mappedData.job_id,
                  order_id: order_id,
                  notes: `Imported from partner system - ${mappedData.sub_partner || 'main'}`
                }, {
                  onConflict: 'partner_id,engineer_id,blocked_date,time_slot'
                });
                
              if (blockError) {
                console.error('Calendar block error:', blockError);
                results.warnings.push({
                  row: i + batch.indexOf(row) + 1,
                  message: `Failed to create calendar block: ${blockError.message}`,
                  data: mappedData
                });
              } else {
                console.log(`Created calendar block for ${installDate.toISOString().split('T')[0]}`);
              }
            } else {
              console.log('DRY RUN: Would create calendar block');
            }
          }
        }
        
      } catch (error) {
        console.error(`Error processing row ${i + batch.indexOf(row) + 1}:`, error);
        results.skipped_count++;
        results.errors.push({
          row: i + batch.indexOf(row) + 1,
          error: error.message,
          data: row
        });
      }
    }
    }
    
    // Update processed count
    results.processed = rows.length;

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
