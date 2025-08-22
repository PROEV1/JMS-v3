import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parse } from 'https://deno.land/std@0.208.0/csv/mod.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ImportProfile {
  id: string;
  partner_id: string;
  gsheet_id?: string;
  gsheet_sheet_name?: string;
  source_type: 'csv' | 'gsheet';
  column_mappings: Record<string, string>;
  status_mappings: Record<string, string>;
  status_actions: Record<string, any>;
  engineer_mapping_rules: Array<{
    partner_identifier: string;
    engineer_id: string;
  }>;
}

interface MappedData {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  customer_address_line_1?: string;
  customer_address_line_2?: string;
  customer_address_city?: string;
  customer_address_post_code?: string;
  job_address?: string;
  postcode?: string;
  partner_status?: string;
  status?: string;
  partner_external_id?: string;
  partner_external_url?: string;
  quote_id?: string;
  quote_amount?: string;
  client_id?: string;
  engineer_identifier?: string;
  engineer_name?: string;
  engineer_email?: string;
  is_partner_job?: boolean;
  sub_partner?: string;
  scheduled_date?: string;
  job_notes?: string;
  job_type?: string;
  type?: string;
}

interface ProcessedRow {
  type: 'insert' | 'update' | 'skip';
  data: any;
  reason?: string;
}

interface Results {
  inserted: ProcessedRow[];
  updated: ProcessedRow[];
  skipped: ProcessedRow[];
  warnings: Array<{ row: number; column?: string; message: string; data?: any }>;
  errors: Array<{ row: number; message: string; data?: any }>;
}

function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }
  
  const trimmed = dateStr.trim();
  
  // If already in YYYY-MM-DD format, return as is
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
    return trimmed.split('T')[0]; // Remove time component if present
  }
  
  // Try to parse DD/MM/YYYY format first
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    
    // Validate date components
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
      return null;
    }
    
    // Convert to YYYY-MM-DD format
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isoDate;
  }
  
  // Fallback: try MM/DD/YYYY format
  const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch;
    
    // Validate date components
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
      return null;
    }
    
    // Convert to YYYY-MM-DD format
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isoDate;
  }
  
  return null;
}

async function fetchImportProfile(supabase: any, partnerImportProfileId: string): Promise<ImportProfile | null> {
  const { data, error } = await supabase
    .from('partner_import_profiles')
    .select('*')
    .eq('id', partnerImportProfileId)
    .single();

  if (error) {
    console.error('Error fetching import profile:', error);
    return null;
  }

  return data;
}

async function fetchPartner(supabase: any, partnerId: string) {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)
    .single();

  if (error) {
    console.error('Error fetching partner:', error);
    return null;
  }

  return data;
}

async function fetchGoogleSheetData(sheetId: string, sheetName: string) {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('Google Service Account Key not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  console.log('Google credentials parsed successfully, client_email:', credentials.client_email);

  const jwt = await createJWT(credentials);
  console.log('JWT generated successfully');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('No access token received');
  }
  console.log('Access token obtained successfully');

  // Fetch sheet data with proper range
  const range = `${sheetName}!A1:ZZ1000`;
  const sheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    }
  );

  if (!sheetResponse.ok) {
    const errorText = await sheetResponse.text();
    console.error('Sheets API error:', errorText);
    if (sheetResponse.status === 403) {
      throw new Error('Permission denied accessing Google Sheet. Check service account permissions.');
    } else if (sheetResponse.status === 404) {
      throw new Error(`Sheet not found: ${sheetId}/${sheetName}`);
    } else {
      throw new Error(`Failed to fetch sheet data: ${errorText}`);
    }
  }

  const sheetData = await sheetResponse.json();
  console.log('Google Sheets: Raw response:', { 
    range: sheetData.range, 
    majorDimension: sheetData.majorDimension,
    rowCount: sheetData.values?.length || 0
  });

  const rows = sheetData.values || [];
  if (rows.length === 0) {
    throw new Error('No data found in the sheet');
  }

  console.log('Sheet data fetched successfully, rows:', rows.length);

  // Convert to objects
  const headers = rows[0];
  const dataRows = rows.slice(1).map((row: any[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });

  return dataRows;
}

async function createJWT(credentials: any) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(JSON.stringify(header));
  const payloadBytes = encoder.encode(JSON.stringify(payload));

  const headerB64 = btoa(String.fromCharCode(...headerBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(String.fromCharCode(...payloadBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const message = `${headerB64}.${payloadB64}`;
  const messageBytes = encoder.encode(message);

  // Import the private key
  const pemKey = credentials.private_key.replace(/\\n/g, '\n');
  const keyData = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, messageBytes);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${message}.${signatureB64}`;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing partner import request...');
    const requestBody = await req.json();
    console.log('Request data received');

    const profileId = requestBody.profile_id || requestBody.partnerImportProfileId;
    const csvData = requestBody.csv_data || requestBody.csvData;
    const dryRun = requestBody.dry_run ?? requestBody.dryRun ?? true;
    const createMissingOrders = requestBody.create_missing_orders ?? requestBody.createMissingOrders ?? true;

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profile_id or partnerImportProfileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Creating Supabase client...');
    const supabase = createClient(
      supabaseUrl!,
      supabaseKey!,
      {
        global: {
          headers: { Authorization: `Bearer ${supabaseKey}` }
        }
      }
    );

    console.log('Fetching import profile...');
    const importProfile = await fetchImportProfile(supabase, profileId);
    if (!importProfile) {
      return new Response(JSON.stringify({ error: 'Import profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const partner = await fetchPartner(supabase, importProfile.partner_id);
    if (!partner) {
      return new Response(JSON.stringify({ error: 'Partner not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Import profile:', {
      id: importProfile.id,
      partner_id: importProfile.partner_id,
      source_type: importProfile.source_type,
      column_mappings_count: Object.keys(importProfile.column_mappings || {}).length,
      status_mappings_count: Object.keys(importProfile.status_mappings || {}).length
    });

    let parsedData: any[] = [];

    // Fetch data based on source type
    if (importProfile.source_type === 'gsheet' && !csvData) {
      if (!importProfile.gsheet_id) {
        return new Response(JSON.stringify({ error: 'Google Sheet ID not configured for this profile' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('Fetching Google Sheet data...');
      parsedData = await fetchGoogleSheetData(importProfile.gsheet_id, importProfile.gsheet_sheet_name || 'Sheet1');
    } else if (csvData) {
      parsedData = parse(csvData, {
        skipFirstRow: true,
        columns: undefined
      }) as any[];
    } else {
      return new Response(JSON.stringify({ error: 'No data source provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${parsedData.length} rows...`);
    
    // Log first and last few Job IDs for reconciliation
    if (parsedData.length > 0) {
      const firstFewIds = parsedData.slice(0, 3).map((row, idx) => 
        `Row ${idx + 1}: ${row['Job ID'] || 'N/A'}`
      ).join(', ');
      const lastFewIds = parsedData.slice(-3).map((row, idx) => 
        `Row ${parsedData.length - 3 + idx + 1}: ${row['Job ID'] || 'N/A'}`
      ).join(', ');
      console.log(`Sheet reconciliation - First rows: ${firstFewIds}`);
      console.log(`Sheet reconciliation - Last rows: ${lastFewIds}`);
    }

    const results: Results = {
      inserted: [],
      updated: [],
      skipped: [],
      warnings: [],
      errors: []
    };

    const columnMappings = importProfile.column_mappings || {};
    const statusMappings = importProfile.status_mappings || {};
    const statusActions = importProfile.status_actions || {};
    const engineerMapping: Record<string, string> = {};

    // Build engineer mapping from rules
    if (importProfile.engineer_mapping_rules) {
      for (const rule of importProfile.engineer_mapping_rules) {
        if (rule.partner_identifier && rule.engineer_id) {
          engineerMapping[rule.partner_identifier.toLowerCase()] = rule.engineer_id;
        }
      }
    }

    // Log first few headers and first mapped row for debugging
    if (parsedData.length > 0) {
      const firstRow = parsedData[0];
      console.log('Available columns:', Object.keys(firstRow));
      console.log('Column mappings:', columnMappings);
    }

    // Process data in batches
    const batchSize = 100;
    for (let batchStart = 0; batchStart < parsedData.length; batchStart += batchSize) {
      const batch = parsedData.slice(batchStart, batchStart + batchSize);
      
      for (const [index, row] of batch.entries()) {
        const rowIndex = batchStart + index;
        
        try {
          // Map columns based on configuration
          const mappedData: MappedData = {};
          
          for (const [dbField, csvColumn] of Object.entries(columnMappings)) {
            if (csvColumn && row[csvColumn] !== undefined) {
              (mappedData as any)[dbField] = row[csvColumn];
            }
          }

          console.log(`Row ${rowIndex + 1} mapped data:`, mappedData);

          // Build consolidated customer address
          const addressParts = [
            mappedData.customer_address_line_1,
            mappedData.customer_address_line_2,
            mappedData.customer_address_city
          ].filter(Boolean);
          const consolidatedCustomerAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

          // Set job_address if not provided but customer address is available
          if (!mappedData.job_address && consolidatedCustomerAddress) {
            mappedData.job_address = consolidatedCustomerAddress;
          }

          // Set postcode from customer fields if not provided
          if (!mappedData.postcode && mappedData.customer_address_post_code) {
            mappedData.postcode = mappedData.customer_address_post_code;
          }

          // Parse and sanitize quote amount
          let sanitizedQuoteAmount = 0;
          if (mappedData.quote_amount) {
            const cleanAmount = String(mappedData.quote_amount)
              .replace(/[£,$\s]/g, '')  // Remove currency symbols, commas, and whitespace
              .trim();
            
            const parsedAmount = parseFloat(cleanAmount);
            
            // Check if the parsed amount is a valid finite number
            if (isFinite(parsedAmount) && !isNaN(parsedAmount)) {
              sanitizedQuoteAmount = parsedAmount;
            } else {
              console.log(`Invalid quote amount '${mappedData.quote_amount}' -> setting to 0`);
              results.warnings.push({
                row: rowIndex + 1,
                column: 'quote_amount',
                message: `Invalid quote amount '${mappedData.quote_amount}' converted to 0`,
                data: { original_amount: mappedData.quote_amount }
              });
            }
          }
          mappedData.quote_amount = sanitizedQuoteAmount.toString();

          // Generate partner external ID if missing
          if (!mappedData.partner_external_id) {
            mappedData.partner_external_id = `${partner.name}-${rowIndex + 1}-${Date.now()}`;
          }

          // Set partner job flag
          mappedData.is_partner_job = true;

          // Map status
          const partnerStatusFromColumn = mappedData.partner_status || mappedData.status;
          const originalPartnerStatus = partnerStatusFromColumn ? String(partnerStatusFromColumn).trim().toUpperCase() : 'UNKNOWN';
          const mappedStatus = statusMappings[originalPartnerStatus] || originalPartnerStatus.toLowerCase();

          console.log(`Processing row ${rowIndex + 1}: Partner Status = '${originalPartnerStatus}'`);

          // Use status actions as primary mapping
          const actionConfig = statusActions[originalPartnerStatus] || {};
          
          let jmsStatus = mappedStatus;
          let suppressScheduling = false;
          let suppressionReason = null;

          // Prefer status_actions over old status_mappings
          if (actionConfig.jms_status) {
            jmsStatus = actionConfig.jms_status;
            console.log(`Using status action mapping: ${originalPartnerStatus} -> ${jmsStatus}`);
          } else {
            // Default mappings for common partner statuses
            const defaultPartnerMappings: Record<string, string> = {
              'AWAITING_INSTALL_DATE': 'awaiting_install_booking',
              'AWAITING_QUOTATION': 'awaiting_install_booking',
              'CANCELLATION_REQUESTED': 'cancelled',
              'CANCELLED': 'cancelled',
              'COMPLETE': 'completed',
              'INSTALL_DATE_CONFIRMED': 'scheduled',
              'INSTALLED': 'install_completed_pending_qa',
              'ON_HOLD': 'on_hold_parts_docs',
              'SWITCH_JOB_SUB_TYPE_REQUESTED': 'awaiting_install_booking',
              'UNKNOWN': 'awaiting_install_booking'
            };
            
            if (defaultPartnerMappings[originalPartnerStatus]) {
              jmsStatus = defaultPartnerMappings[originalPartnerStatus];
              console.log(`Using default mapping: ${originalPartnerStatus} -> ${jmsStatus}`);
            }
          }
          
          if (actionConfig.actions) {
            if (actionConfig.actions.suppress_scheduling === true) {
              suppressScheduling = true;
              suppressionReason = actionConfig.actions.suppression_reason || `partner_status_${originalPartnerStatus.toLowerCase()}`;
            } else if (actionConfig.actions.suppress_scheduling === false) {
              suppressScheduling = false;
              suppressionReason = null;
            }
          } else {
            // Default suppression rules for certain statuses
            const suppressByDefault = ['AWAITING_QUOTATION', 'CANCELLED', 'CANCELLATION_REQUESTED', 'COMPLETE', 'ON_HOLD'];
            suppressScheduling = suppressByDefault.includes(originalPartnerStatus);
            if (suppressScheduling) {
              suppressionReason = `partner_status_${originalPartnerStatus.toLowerCase()}`;
            }
          }

          // Validate JMS status is a valid database enum value
          const validOrderStatuses = [
            'quote_accepted', 'awaiting_payment', 'payment_received', 'awaiting_agreement', 
            'agreement_signed', 'awaiting_install_booking', 'scheduled', 'in_progress',
            'install_completed_pending_qa', 'completed', 'revisit_required', 'cancelled',
            'needs_scheduling', 'date_offered', 'date_accepted', 'date_rejected', 
            'offer_expired', 'on_hold_parts_docs', 'awaiting_final_payment'
          ];
          
          if (!validOrderStatuses.includes(jmsStatus)) {
            const statusDefaults: Record<string, string> = {
              'unknown': 'awaiting_install_booking',
              'pending': 'awaiting_install_booking',
              'confirmed': 'scheduled', 
              'complete': 'completed',
              'completed': 'completed',
              'scheduled': 'scheduled',
              'in_progress': 'in_progress',
              'cancelled': 'cancelled',
              'on_hold': 'on_hold_parts_docs'
            };
            
            const defaultStatus = statusDefaults[jmsStatus.toLowerCase()] || 'awaiting_install_booking';
            console.log(`Status flow: Invalid '${jmsStatus}' -> Default: ${defaultStatus}`);
            
            results.warnings.push({
              row: rowIndex + 1,
              column: 'status',
              message: `Invalid status '${jmsStatus}' mapped to '${defaultStatus}'`,
              data: { original_status: originalPartnerStatus, mapped_status: jmsStatus }
            });
            
            jmsStatus = defaultStatus;
          }

          // Map engineer
          let engineerId = null;
          const engineerIdentifier = mappedData.engineer_identifier || mappedData.engineer_name || mappedData.engineer_email;
          
          if (engineerIdentifier) {
            const engineerKey = String(engineerIdentifier).toLowerCase().trim();
            
            if (engineerMapping[engineerKey]) {
              engineerId = engineerMapping[engineerKey];
            } else {
              console.log(`No engineer mapping found for: '${engineerKey}'`);
              
              results.warnings.push({
                row: rowIndex + 1,
                column: 'engineer_identifier',
                message: `No engineer mapping found for identifier: '${engineerIdentifier}'`,
                data: { engineer_identifier: engineerIdentifier }
              });
            }
          }

          // Create or find client if needed
          let clientId = mappedData.client_id;
          
          if (!clientId && createMissingOrders && (mappedData.client_name || mappedData.client_email)) {
            
            if (!dryRun) {
              // Try to find existing client first
              const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .or(`email.eq.${mappedData.client_email || 'no-email'},full_name.ilike.%${mappedData.client_name || 'no-name'}%`)
                .limit(1)
                .single();

              if (existingClient) {
                clientId = existingClient.id;
              } else {
                // Create new client
                const clientData = {
                  full_name: mappedData.client_name || 'Unknown Client',
                  email: mappedData.client_email || null,
                  phone: mappedData.client_phone || null,
                  address: consolidatedCustomerAddress || null,
                  postcode: mappedData.customer_address_post_code || mappedData.postcode || null,
                  is_partner_client: true,
                  partner_id: partner.id
                };

                const { data: newClient, error: clientError } = await supabase
                  .from('clients')
                  .insert(clientData)
                  .select('id')
                  .single();

                if (clientError) {
                  console.error('Error creating client:', clientError);
                  results.errors.push({
                    row: rowIndex + 1,
                    message: `Failed to create client: ${clientError.message}`,
                    data: clientData
                  });
                  continue;
                } else {
                  clientId = newClient.id;
                  console.log(`Created client: ${clientId}`);
                }
              }
            } else {
              // For dry run, simulate client creation
              clientId = 'placeholder-client-id';
            }
          }

          // Build order data
          const orderData: any = {
            partner_id: partner.id,
            client_id: clientId,
            partner_external_id: mappedData.partner_external_id,
            partner_external_url: mappedData.partner_external_url || null,
            job_address: mappedData.job_address || null,
            postcode: mappedData.postcode || null,
            status_enhanced: jmsStatus,
            is_partner_job: true,
            engineer_id: engineerId,
            job_type: (mappedData.job_type || mappedData.type || 'installation').toLowerCase(),
            installation_notes: mappedData.job_notes || null,
            sub_partner: mappedData.sub_partner || null,
            total_amount: sanitizedQuoteAmount,
            scheduling_suppressed: suppressScheduling,
            scheduling_suppressed_reason: suppressionReason,
            order_number: `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            status: 'awaiting_payment',
            deposit_amount: 0,
            amount_paid: 0
          };

          // Handle scheduled date
          if (mappedData.scheduled_date) {
            const parsedDate = parseDate(mappedData.scheduled_date);
            if (parsedDate) {
              orderData.scheduled_install_date = parsedDate;
            } else {
              results.warnings.push({
                row: rowIndex + 1,
                column: 'scheduled_date',
                message: `Invalid date format: '${mappedData.scheduled_date}'. Expected DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD`,
                data: { scheduled_date: mappedData.scheduled_date }
              });
            }
          }

          const processedRow: ProcessedRow = {
            type: 'insert',
            data: orderData
          };
          
          if (!dryRun) {
            try {
              // Check for existing order with same partner_external_id
              const { data: existingOrder } = await supabase
                .from('orders')
                .select('id, partner_external_id')
                .eq('partner_external_id', processedRow.data.partner_external_id)
                .eq('partner_id', partner.id)
                .single();

              if (existingOrder) {
                // Update existing order
                const { error: updateError } = await supabase
                  .from('orders')
                  .update(processedRow.data)
                  .eq('id', existingOrder.id);

                if (updateError) {
                  console.error('Error updating order:', updateError);
                  results.errors.push({
                    row: rowIndex + 1,
                    message: `Failed to update order: ${updateError.message}`,
                    data: processedRow.data
                  });
                } else {
                  results.updated.push({
                    ...processedRow,
                    type: 'update',
                    data: { ...processedRow.data, id: existingOrder.id }
                  });
                  console.log(`Updated order: ${existingOrder.id}`);
                }
              } else {
                // Insert new order
                const { data: newOrder, error: insertError } = await supabase
                  .from('orders')
                  .insert(processedRow.data)
                  .select('id')
                  .single();

                if (insertError) {
                  console.error('Error inserting order:', insertError);
                  results.errors.push({
                    row: rowIndex + 1,
                    message: `Failed to insert order: ${insertError.message}`,
                    data: processedRow.data
                  });
                } else {
                  results.inserted.push({
                    ...processedRow,
                    data: { ...processedRow.data, id: newOrder.id }
                  });
                  console.log(`Inserted order: ${newOrder.id}`);
                }
              }
            } catch (dbError: any) {
              console.error('Database error:', dbError);
              results.errors.push({
                row: rowIndex + 1,
                message: `Database error: ${dbError.message}`,
                data: processedRow.data
              });
            }
          } else {
            // For dry run, just add to results
            results.inserted.push(processedRow);
          }

        } catch (error: any) {
          console.error(`Error processing row ${rowIndex + 1}:`, error);
          results.errors.push({
            row: rowIndex + 1,
            message: `Processing error: ${error.message}`,
            data: row
          });
        }
      }
    }

    // Log results summary
    console.log('Import completed:', {
      total_rows: parsedData.length,
      inserted: results.inserted.length,
      updated: results.updated.length,
      skipped: results.skipped.length,
      warnings: results.warnings.length,
      errors: results.errors.length,
      dry_run: dryRun
    });

    // Log import run to database (only if not dry run)
    if (!dryRun) {
      try {
        await supabase.rpc('log_partner_import', {
          p_run_id: `import-${Date.now()}`,
          p_partner_id: partner.id,
          p_profile_id: importProfile.id,
          p_dry_run: dryRun,
          p_total_rows: parsedData.length,
          p_inserted_count: results.inserted.length,
          p_updated_count: results.updated.length,
          p_skipped_count: results.skipped.length,
          p_warnings: results.warnings,
          p_errors: results.errors
        });
      } catch (logError) {
        console.error('Failed to log import run:', logError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      total_rows: parsedData.length,
      results: {
        inserted: results.inserted.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        warnings: results.warnings.length,
        errors: results.errors.length
      },
      // Add backward compatibility for UI
      summary: {
        processed: parsedData.length,
        inserted_count: results.inserted.length,
        updated_count: results.updated.length,
        skipped_count: results.skipped.length,
        errors: results.errors,
        warnings: results.warnings,
        dry_run: dryRun
      },
      details: {
        inserted: results.inserted,
        updated: results.updated,
        skipped: results.skipped,
        warnings: results.warnings,
        errors: results.errors
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Partner import error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      details: error.stack || null,
      results: {
        inserted: 0,
        updated: 0,
        skipped: 0,
        warnings: 0,
        errors: 1
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});