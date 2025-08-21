import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { parse } from "https://deno.land/std@0.192.0/csv/parse.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface ImportProfile {
  id: string;
  partner_id: string;
  name: string;
  source_type: 'csv' | 'gsheet';
  gsheet_id: string | null;
  gsheet_sheet_name: string | null;
  column_mappings: Record<string, string>;
  status_mappings: Record<string, string>;
  status_override_rules: Record<string, string>;
  status_actions: Record<string, any>;
  engineer_mapping_rules: Array<{ partner_identifier: string; engineer_id: string }>;
  created_at: string;
  updated_at: string;
}

interface MappedData {
  partner_external_id: string;
  status?: string;
  job_type?: string;
  postcode?: string;
  address?: string;
  city?: string;
  county?: string;
  country?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  engineer_name?: string;
  engineer_email?: string;
  fault_description?: string;
  reported_fault?: string;
  job_notes?: string;
  created_at?: string;
  scheduled_date?: string;
  product_description?: string;
  product_model?: string;
  serial_number?: string;
  warranty_status?: string;
  purchase_date?: string;
  supplier?: string;
  sub_partner?: string;
  priority?: string;
  contact_method?: string;
  internal_notes?: string;
  customer_ref?: string;
  engineer_id?: string;
  is_partner_job?: boolean;
  partner_id?: string;
  partner_status?: string;
  partner_confirmed_externally?: boolean;
  partner_confirmed_at?: string;
  external_confirmation_source?: string;
  scheduling_suppressed?: boolean;
  scheduling_suppressed_reason?: string;
  status_enhanced?: string;
}

interface ProcessedRow {
  success: boolean;
  data?: MappedData;
  error?: string;
}

interface Results {
  data: MappedData[];
  errors: { row: number; message: string; data: any }[];
  warnings: { row: number; message: string; data: any }[];
  skipped: number;
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

// Helper function to fetch Google Sheets data
async function fetchGoogleSheetData(sheetId: string, sheetName: string) {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('Google Service Account Key not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  console.log('Google Sheets: Using service account email:', credentials.client_email);
  
  // Get access token
  console.log('Google Sheets: Creating JWT for authentication...');
  const jwt = await createJWT(credentials);
  
  console.log('Google Sheets: Requesting access token...');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Google Sheets: Token request failed:', tokenResponse.status, errorText);
    throw new Error(`Failed to get Google access token: ${tokenResponse.status} - ${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    console.error('Google Sheets: No access token in response:', tokenData);
    throw new Error('No access token received from Google');
  }
  
  console.log('Google Sheets: Access token obtained, fetching sheet data...');
  
  // Fetch sheet data
  const sheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  
  if (!sheetResponse.ok) {
    const errorText = await sheetResponse.text();
    console.error('Google Sheets: Sheet fetch failed:', sheetResponse.status, errorText);
    
    if (sheetResponse.status === 403) {
      throw new Error(`Access denied to Google Sheet. Please ensure the sheet is shared with the service account email: ${credentials.client_email}`);
    } else if (sheetResponse.status === 404) {
      throw new Error(`Google Sheet not found. Please check the Sheet ID: ${sheetId}`);
    } else {
      throw new Error(`Failed to fetch Google Sheet: ${sheetResponse.status} - ${errorText}`);
    }
  }
  
  const sheetData = await sheetResponse.json();
  console.log('Google Sheets: Raw response:', { 
    hasValues: !!sheetData.values, 
    rowCount: sheetData.values?.length || 0 
  });
  
  const rows = sheetData.values || [];
  
  if (rows.length === 0) {
    console.warn('Google Sheets: No data found in sheet');
    return [];
  }
  
  console.log('Google Sheets: Processing', rows.length, 'rows (including header)');
  
  // Convert to objects with header keys
  const headers = rows[0];
  const dataRows = rows.slice(1).map((row: any[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
  
  console.log('Google Sheets: Successfully processed', dataRows.length, 'data rows');
  return dataRows;
}

// Helper function to create JWT for Google API
async function createJWT(credentials: any) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(JSON.stringify(header));
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  
  const headerB64 = btoa(String.fromCharCode(...headerBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(String.fromCharCode(...payloadBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${headerB64}.${payloadB64}`;
  const messageBytes = encoder.encode(message);
  
  // Import private key and sign
  const pemKey = credentials.private_key.replace(/\\n/g, '\n');
  const keyData = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
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
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json();
    
    // Support both camelCase and snake_case parameters
    const profileId = requestBody.profile_id || requestBody.partnerImportProfileId;
    const csvData = requestBody.csv_data || requestBody.csvData;
    const dryRun = requestBody.dry_run ?? requestBody.dryRun ?? true;
    const createMissingOrders = requestBody.create_missing_orders ?? requestBody.createMissingOrders ?? true;

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profile_id or partnerImportProfileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        },
      }
    )

    const importProfile = await fetchImportProfile(supabase, profileId);
    if (!importProfile) {
      return new Response(JSON.stringify({ error: 'Import profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const partner = await fetchPartner(supabase, importProfile.partner_id);
    if (!partner) {
      return new Response(JSON.stringify({ error: 'Partner not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Import profile:', {
      id: importProfile.id,
      source_type: importProfile.source_type,
      gsheet_id: importProfile.gsheet_id,
      status_actions_count: Object.keys(importProfile.status_actions || {}).length
    });

    // Get data source - either CSV or Google Sheets
    let parsedData: any[] = [];
    
    if (importProfile.source_type === 'gsheet' && !csvData) {
      if (!importProfile.gsheet_id) {
        return new Response(JSON.stringify({ error: 'Google Sheet ID not configured for this profile' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('Fetching Google Sheet data:', importProfile.gsheet_id, importProfile.gsheet_sheet_name);
      parsedData = await fetchGoogleSheetData(importProfile.gsheet_id, importProfile.gsheet_sheet_name || 'Sheet1');
      console.log('Fetched', parsedData.length, 'rows from Google Sheets');
    } else if (csvData) {
      parsedData = parse(csvData, {
        skipFirstRow: true,
        header: true,
      });
      console.log('Parsed', parsedData.length, 'rows from CSV');
    } else {
      return new Response(JSON.stringify({ error: 'No data source provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Results = {
      data: [],
      errors: [],
      warnings: [],
      skipped: 0,
    };

    const columnMapping = importProfile.column_mappings || {};
    const statusMapping = importProfile.status_mappings || {};
    const statusOverrideRules = importProfile.status_override_rules || {};
    const statusActions = importProfile.status_actions || {};
    
    // Build engineer mapping from rules
    const engineerMapping: Record<string, string> = {};
    if (importProfile.engineer_mapping_rules) {
      for (const rule of importProfile.engineer_mapping_rules) {
        if (rule.partner_identifier && rule.engineer_id) {
          engineerMapping[rule.partner_identifier] = rule.engineer_id;
        }
      }
    }
    
    // Pre-fetch all engineers to check for unmapped ones
    const unmappedEngineers = new Set<string>();

    const batchSize = 100;
    for (let batchStart = 0; batchStart < parsedData.length; batchStart += batchSize) {
      const batch = parsedData.slice(batchStart, batchStart + batchSize);

      for (const [index, row] of batch.entries()) {
        const actualRowIndex = batchStart + index;
        
        const processRow = (row: any, rowIndex: number): ProcessedRow => {
          try {
            const mappedData: MappedData = {
              partner_external_id: row[columnMapping['partner_external_id']]?.toString()?.trim() || null,
              status: row[columnMapping['status']]?.toString()?.trim() || null,
              job_type: row[columnMapping['job_type']]?.toString()?.trim() || null,
              postcode: row[columnMapping['postcode']]?.toString()?.trim() || null,
              address: row[columnMapping['address']]?.toString()?.trim() || null,
              city: row[columnMapping['city']]?.toString()?.trim() || null,
              county: row[columnMapping['county']]?.toString()?.trim() || null,
              country: row[columnMapping['country']]?.toString()?.trim() || null,
              client_name: row[columnMapping['client_name']]?.toString()?.trim() || null,
              client_email: row[columnMapping['client_email']]?.toString()?.trim() || null,
              client_phone: row[columnMapping['client_phone']]?.toString()?.trim() || null,
              engineer_name: row[columnMapping['engineer_name']]?.toString()?.trim() || null,
              engineer_email: row[columnMapping['engineer_email']]?.toString()?.trim() || null,
              fault_description: row[columnMapping['fault_description']]?.toString()?.trim() || null,
              reported_fault: row[columnMapping['reported_fault']]?.toString()?.trim() || null,
              job_notes: row[columnMapping['job_notes']]?.toString()?.trim() || null,
              created_at: row[columnMapping['created_at']]?.toString()?.trim() || null,
              scheduled_date: row[columnMapping['scheduled_date']]?.toString()?.trim() || null,
              product_description: row[columnMapping['product_description']]?.toString()?.trim() || null,
              product_model: row[columnMapping['product_model']]?.toString()?.trim() || null,
              serial_number: row[columnMapping['serial_number']]?.toString()?.trim() || null,
              warranty_status: row[columnMapping['warranty_status']]?.toString()?.trim() || null,
              purchase_date: row[columnMapping['purchase_date']]?.toString()?.trim() || null,
              supplier: row[columnMapping['supplier']]?.toString()?.trim() || null,
              sub_partner: row[columnMapping['sub_partner']]?.toString()?.trim() || null,
              priority: row[columnMapping['priority']]?.toString()?.trim() || null,
              contact_method: row[columnMapping['contact_method']]?.toString()?.trim() || null,
              internal_notes: row[columnMapping['internal_notes']]?.toString()?.trim() || null,
              customer_ref: row[columnMapping['customer_ref']]?.toString()?.trim() || null,
              partner_status: row[columnMapping['partner_status']]?.toString()?.trim() || null,
            };

            if (!mappedData.partner_external_id) {
              results.skipped++;
              return { success: false, error: 'Missing partner_external_id' };
            }

            let mappedStatus = mappedData.status || 'unknown';
            
            // Apply status mapping from profile
            const statusMapping = importProfile.status_mappings || {};
            if (statusMapping[mappedStatus]) {
              mappedStatus = statusMapping[mappedStatus];
            }
            
            // Apply status override rules
            const statusOverrides = importProfile.status_override_rules || {};
            if (statusOverrides[mappedStatus]) {
              mappedStatus = statusOverrides[mappedStatus];
            }

            // Use status actions as primary mapping (new approach)
            const originalPartnerStatus = mappedData.partner_status || mappedData.status || 'unknown';
            const actionConfig = statusActions[originalPartnerStatus] || {};
            
            let jmsStatus = mappedStatus; // fallback to old mapping
            let suppressScheduling = false;
            let suppressionReason = null;
            
            // Prefer status_actions over old status_mappings
            if (actionConfig.jms_status) {
              jmsStatus = actionConfig.jms_status;
            }
            
            if (actionConfig.actions) {
              if (actionConfig.actions.suppress_scheduling === true) {
                suppressScheduling = true;
                suppressionReason = actionConfig.actions.suppression_reason || `partner_status_${originalPartnerStatus.toLowerCase()}`;
              } else if (actionConfig.actions.suppress_scheduling === false) {
                suppressScheduling = false;
                suppressionReason = null;
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
              console.warn(`Invalid status '${jmsStatus}' mapped to default: ${defaultStatus}`);
              
              results.warnings.push({
                row: rowIndex + 1,
                message: `Invalid mapped status '${jmsStatus}' - using default '${defaultStatus}' instead`,
                data: mappedData
              });
              
              jmsStatus = defaultStatus;
            }

            console.log(`Status flow: ${originalPartnerStatus} -> JMS: ${jmsStatus}, Suppressed: ${suppressScheduling}`);

            let mappedEngineerId: string | null = null;
            
            // Check for engineer mapping - use multiple possible fields
            const engineerIdentifier = row[columnMapping['engineer_name']] || 
                                     row[columnMapping['engineer_email']] ||
                                     row['engineer_name'] || 
                                     row['engineer_email'] ||
                                     null;
            
            if (engineerIdentifier) {
              const engineerKey = engineerIdentifier.toString().trim();
              
              if (engineerMapping[engineerKey]) {
                mappedEngineerId = engineerMapping[engineerKey];
              } else {
                unmappedEngineers.add(engineerKey);
                console.warn(`Unmapped engineer: ${engineerKey}`);
                results.warnings.push({
                  row: rowIndex + 1,
                  message: `Engineer '${engineerKey}' not mapped to internal engineer`,
                  data: mappedData
                });
              }
            }

            return {
              success: true,
              data: {
                ...mappedData,
                status_enhanced: jmsStatus,
                scheduling_suppressed: suppressScheduling,
                scheduling_suppressed_reason: suppressionReason,
                engineer_id: mappedEngineerId,
                is_partner_job: true,
                partner_id: importProfile.partner_id,
                partner_confirmed_externally: false,
                external_confirmation_source: 'partner_import',
              }
            };

          } catch (error) {
            console.error('Error processing row:', error);
            results.errors.push({
              row: rowIndex + 1,
              message: error.message,
              data: row,
            });
            return { success: false, error: error.message };
          }
        };

        const processedRow = processRow(row, actualRowIndex);

        if (processedRow.success && processedRow.data) {
          results.data.push(processedRow.data);
        } else {
          results.errors.push({
            row: actualRowIndex + 1,
            message: processedRow.error || 'Unknown error',
            data: row,
          });
        }
      }
    }

    // Check for unmapped engineers and block if found
    if (unmappedEngineers.size > 0) {
      console.log('Found unmapped engineers, blocking import:', Array.from(unmappedEngineers));
      return new Response(
        JSON.stringify({
          success: false,
          unmapped_engineers: Array.from(unmappedEngineers),
          summary: {
            processed: results.data.length,
            inserted_count: 0,
            updated_count: 0,
            skipped_count: results.skipped,
            errors: results.errors,
            warnings: results.warnings,
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build response
    const totalProcessed = results.data.length;
    let insertCount = 0;
    let updateCount = 0;
    const preview: any = { updates: [], inserts: [], skips: [] };

    if (dryRun) {
      // For dry run, check which orders already exist
      const externalIds = results.data.map(d => d.partner_external_id).filter(Boolean);
      
      if (externalIds.length > 0) {
        const { data: existingOrders } = await supabase
          .from('orders')
          .select('partner_external_id, status_enhanced, partner_status')
          .eq('partner_id', importProfile.partner_id)
          .in('partner_external_id', externalIds);

        const existingMap = new Map(existingOrders?.map(o => [o.partner_external_id, o]) || []);
        
        results.data.forEach((item, index) => {
          const existing = existingMap.get(item.partner_external_id);
          if (existing) {
            updateCount++;
            preview.updates.push({
              row: index + 1,
              external_id: item.partner_external_id,
              current_status: existing.status_enhanced,
              new_status: item.status_enhanced,
              reason: `Status update from ${existing.partner_status || 'unknown'} to ${item.partner_status || 'unknown'}`,
              data: item
            });
          } else if (createMissingOrders) {
            insertCount++;
            preview.inserts.push({
              row: index + 1,
              external_id: item.partner_external_id,
              status: item.status_enhanced,
              reason: `New order for partner status: ${item.partner_status || 'unknown'}`,
              data: item
            });
          } else {
            preview.skips.push({
              row: index + 1,
              external_id: item.partner_external_id,
              reason: 'Order does not exist and create_missing_orders is disabled',
              data: item
            });
          }
        });
      } else {
        insertCount = createMissingOrders ? results.data.length : 0;
      }
    } else {
      // Live import
      if (results.data.length > 0) {
        const { error: upsertError, count } = await supabase
          .from('orders')
          .upsert(results.data.map(item => ({
            ...item,
            updated_at: new Date().toISOString()
          })), {
            onConflict: 'partner_external_id,partner_id',
            count: 'estimated'
          });

        if (upsertError) {
          throw upsertError;
        }
        
        updateCount = count || results.data.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          processed: totalProcessed,
          inserted_count: insertCount,
          updated_count: updateCount,
          skipped_count: results.skipped,
          errors: results.errors,
          warnings: results.warnings,
          dry_run: dryRun,
          ...(dryRun ? { preview_inserted_count: insertCount, preview_updated_count: updateCount } : {})
        },
        ...(dryRun ? { preview } : {})
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Partner Import Error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      summary: {
        processed: 0,
        inserted_count: 0,
        updated_count: 0,
        skipped_count: 0,
        errors: [{ row: 0, error: error.message }],
        warnings: []
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
});
