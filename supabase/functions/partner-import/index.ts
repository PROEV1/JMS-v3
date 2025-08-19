
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to parse dates more tolerantly
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Handle common date formats
    const cleaned = dateStr.trim();
    
    // Try DD/MM/YYYY or DD/MM/YYYY HH:MM format
    const ddmmPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/;
    const ddmmMatch = cleaned.match(ddmmPattern);
    if (ddmmMatch) {
      const [, day, month, year, hour = '0', minute = '0'] = ddmmMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
      if (!isNaN(date.getTime())) return date;
    }
    
    // Try MM/DD/YYYY format
    const mmddPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const mmddMatch = cleaned.match(mmddPattern);
    if (mmddMatch) {
      const [, month, day, year] = mmddMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
    
    // Try ISO format or other standard formats
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) return date;
    
    return null;
  } catch (error) {
    console.error(`Date parsing error for "${dateStr}":`, error);
    return null;
  }
}

interface ImportRequest {
  profile_id: string;
  csv_data?: string;
  dry_run?: boolean;
  create_missing_orders?: boolean;
}

interface ImportResult {
  success: boolean;
  summary: {
    processed: number;
    inserted_count: number;
    updated_count: number;
    skipped_count: number;
    errors: Array<{ row: number; error: string; data?: any }>;
    warnings: Array<{ row: number; warning: string; data?: any }>;
  };
  unmapped_engineers?: Array<string>; // Add this for blocking imports
  preview?: {
    updates: Array<{ 
      row: number; 
      external_id: string; 
      current_status: string; 
      new_status: string; 
      reason: string;
      data?: any;
    }>;
    skips: Array<{ 
      row: number; 
      external_id: string; 
      reason: string; 
      data?: any;
    }>;
    inserts: Array<{ 
      row: number; 
      external_id: string; 
      status: string; 
      reason: string;
      data?: any;
    }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  try {
    console.log('Processing partner import request with JWT validation');

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Authorization required',
        message: 'Please log in to import partner data' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication',
        message: 'Please log in again' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ 
        error: 'Access denied',
        message: 'Admin access required for partner import' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ImportRequest = await req.json();
    const { profile_id, csv_data, dry_run = true, create_missing_orders = true } = body;

    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get import profile
    const { data: importProfile, error: profileFetchError } = await supabaseAdmin
      .from('partner_import_profiles')
      .select('*, partners(*)')
      .eq('id', profile_id)
      .single();

    if (profileFetchError || !importProfile) {
      return new Response(JSON.stringify({ error: 'Import profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing import for partner: ${importProfile.partners.name}`);

    const result: ImportResult = {
      success: true,
      summary: {
        processed: 0,
        inserted_count: 0,
        updated_count: 0,
        skipped_count: 0,
        errors: [],
        warnings: []
      },
      preview: dry_run ? {
        updates: [],
        skips: [],
        inserts: []
      } : undefined
    };

    let csvRows: string[][] = [];

    // Parse CSV data (simplified - in production you'd want a proper CSV parser)
    if (csv_data) {
      const lines = csv_data.trim().split('\n');
      csvRows = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
    } else if (importProfile.source_type === 'gsheet' && importProfile.gsheet_id) {
      // Fetch Google Sheets data
      console.log('=== CALLING GOOGLE SHEETS PREVIEW FROM PARTNER-IMPORT ===');
      console.log('Auth header present:', !!authHeader);
      console.log('Sheet ID:', importProfile.gsheet_id?.substring(0, 10) + '...');
      console.log('Sheet name:', importProfile.gsheet_sheet_name);
      
      const sheetsResponse = await fetch(`https://qvppvstgconmzzjsryna.supabase.co/functions/v1/google-sheets-preview`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gsheet_id: importProfile.gsheet_id,
          sheet_name: importProfile.gsheet_sheet_name || 'Sheet1',
          preview_rows: 10000 // Get all data for import
        })
      });

      console.log('Sheets response status:', sheetsResponse.status);
      console.log('Sheets response headers:', Object.fromEntries(sheetsResponse.headers.entries()));
      
      const sheetsData = await sheetsResponse.json();
      console.log('Google Sheets response:', JSON.stringify(sheetsData, null, 2));
      
      if (!sheetsData.success) {
        result.summary.errors.push({
          row: 0,
          error: `Google Sheets fetch failed: ${sheetsData.error}`
        });
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Convert Google Sheets data to CSV format
      const headers = sheetsData.headers;
      const rows = sheetsData.rows;
      csvRows = [headers, ...rows];
    } else {
      return new Response(JSON.stringify({ error: 'No data source provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (csvRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No data to process' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = csvRows[0];
    const dataRows = csvRows.slice(1);

    console.log(`Processing ${dataRows.length} rows with headers:`, headers);

    // Generate unique run_id for this import
    const runId = `${importProfile.partners.slug || importProfile.partners.name}-${Date.now()}`;
    
    // Create engineer mapping lookup from the import profile
    const engineerMappingLookup: Record<string, string> = {};
    if (importProfile.engineer_mapping_rules) {
      importProfile.engineer_mapping_rules.forEach((rule: any) => {
        if (rule.partner_identifier && rule.engineer_id) {
          engineerMappingLookup[rule.partner_identifier] = rule.engineer_id;
        }
      });
    }
    
    // Preflight check: Collect all partner engineer identifiers and check for unmapped ones
    const uniquePartnerEngineers = new Set<string>();
    const engineerIdentifierColumn = importProfile.column_mappings['engineer_identifier'];
    
    if (engineerIdentifierColumn) {
      dataRows.forEach((row, index) => {
        const rowData: Record<string, string> = {};
        headers.forEach((header, headerIndex) => {
          rowData[header] = row[headerIndex] || '';
        });
        
        const engineerIdentifier = rowData[engineerIdentifierColumn]?.trim();
        if (engineerIdentifier) {
          uniquePartnerEngineers.add(engineerIdentifier);
        }
      });
      
      // Check for unmapped engineers
      const unmappedEngineers = Array.from(uniquePartnerEngineers).filter(
        engineerIdentifier => !engineerMappingLookup[engineerIdentifier]
      );
      
      if (unmappedEngineers.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          unmapped_engineers: unmappedEngineers,
          summary: {
            processed: 0,
            inserted_count: 0,
            updated_count: 0,
            skipped_count: 0,
            errors: [{
              row: 0,
              error: `Found ${unmappedEngineers.length} unmapped engineers: ${unmappedEngineers.join(', ')}. Please map these engineers before importing.`
            }],
            warnings: []
          }
        } as ImportResult), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because we skip header and 0-indexed

      try {
        result.summary.processed++;
        
        // Convert row to object using headers
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });

        // Apply column mappings
        const mappedData: Record<string, any> = {};
        Object.entries(importProfile.column_mappings).forEach(([ourField, partnerField]) => {
          if (partnerField && rowData[partnerField] !== undefined) {
            mappedData[ourField] = rowData[partnerField];
          }
        });

        // Resolve engineer ID if engineer identifier is provided
        let resolvedEngineerId: string | null = null;
        if (mappedData.engineer_identifier) {
          const engineerIdentifier = mappedData.engineer_identifier.trim();
          resolvedEngineerId = engineerMappingLookup[engineerIdentifier] || null;
          
          if (!resolvedEngineerId && engineerIdentifier) {
            result.summary.warnings.push({
              row: rowNumber,
              warning: `Engineer identifier "${engineerIdentifier}" not mapped to any internal engineer`,
              data: mappedData
            });
          }
        }

        // Validate required fields for order creation
        if (!mappedData.partner_external_id) {
          result.summary.errors.push({
            row: rowNumber,
            error: 'Missing partner_external_id',
            data: mappedData
          });
          continue;
        }

        // Check if order already exists
        const { data: existingOrder } = await supabaseAdmin
          .from('orders')
          .select('id, status_enhanced, partner_status')
          .eq('partner_id', importProfile.partner_id)
          .eq('partner_external_id', mappedData.partner_external_id)
          .single();

        // Validate required fields for order creation if order doesn't exist
        if (!existingOrder && create_missing_orders) {
          if (!mappedData.client_name || !mappedData.client_email) {
            result.summary.errors.push({
              row: rowNumber,
              error: 'Missing required fields for order creation: client_name and client_email are required',
              data: mappedData
            });
            continue;
          }
        }

        // Apply status mapping
        let internalStatus = 'awaiting_install_booking';
        if (mappedData.partner_status && importProfile.status_mappings[mappedData.partner_status]) {
          internalStatus = importProfile.status_mappings[mappedData.partner_status];
        }

        // Check for status overrides (ON_HOLD, CANCELLATION_REQUESTED)
        const shouldSuppress = importProfile.status_override_rules[mappedData.partner_status] === true;

        const orderData = {
          partner_id: importProfile.partner_id,
          partner_external_id: mappedData.partner_external_id,
          partner_status: mappedData.partner_status,
          partner_status_raw: mappedData.partner_status,
          sub_partner: mappedData.sub_partner || null,
          partner_external_url: mappedData.partner_external_url || null,
          scheduling_suppressed: shouldSuppress,
          scheduling_suppressed_reason: shouldSuppress ? `Partner status: ${mappedData.partner_status}` : null,
          is_partner_job: true,
          partner_metadata: {
            import_profile_id: profile_id,
            import_run_id: runId,
            raw_data: rowData
          }
        };

        // Handle special status: INSTALL_DATE_CONFIRMED
        if (mappedData.partner_status === 'INSTALL_DATE_CONFIRMED' && mappedData.scheduled_date) {
          const parsedDate = parseDate(mappedData.scheduled_date);
          if (parsedDate) {
            orderData.partner_confirmed_externally = true;
            orderData.partner_confirmed_at = new Date().toISOString();
            orderData.external_confirmation_source = 'partner_jms';
            orderData.scheduled_install_date = parsedDate.toISOString();
            orderData.status_enhanced = 'scheduled';
            
            // Assign engineer if we have one mapped
            if (resolvedEngineerId) {
              orderData.engineer_id = resolvedEngineerId;
            }
          } else {
            result.summary.warnings.push({
              row: rowNumber,
              warning: `Invalid scheduled_date format: ${mappedData.scheduled_date}`,
              data: mappedData
            });
          }
        } else if (mappedData.scheduled_date && resolvedEngineerId) {
          // Handle proposed scheduled date with engineer assignment (create job offer)
          const parsedDate = parseDate(mappedData.scheduled_date);
          if (parsedDate) {
            orderData.scheduled_install_date = parsedDate.toISOString();
            orderData.engineer_id = resolvedEngineerId;
            orderData.status_enhanced = 'scheduled';
          }
        } else if (!shouldSuppress) {
          orderData.status_enhanced = internalStatus;
        }

        if (!dry_run) {
          if (existingOrder) {
            // Update existing order - but don't move backwards in our flow
            const updateData = { ...orderData };
            
            // Don't regress status if we've moved forward
            const statusProgression = ['awaiting_payment', 'awaiting_agreement', 'awaiting_install_booking', 'scheduled', 'in_progress', 'install_completed_pending_qa', 'completed'];
            const currentIndex = statusProgression.indexOf(existingOrder.status_enhanced);
            const newIndex = statusProgression.indexOf(internalStatus);
            
            if (currentIndex > newIndex && !shouldSuppress && mappedData.partner_status !== 'INSTALL_DATE_CONFIRMED') {
              delete updateData.status_enhanced;
              result.summary.warnings.push({
                row: rowNumber,
                warning: `Not regressing status from ${existingOrder.status_enhanced} to ${internalStatus}`,
                data: mappedData
              });
            }

            const { error: updateError } = await supabaseAdmin
              .from('orders')
              .update(updateData)
              .eq('id', existingOrder.id);

            if (updateError) {
              result.summary.errors.push({
                row: rowNumber,
                error: `Update failed: ${updateError.message}`,
                data: mappedData
              });
            } else {
              result.summary.updated_count++;
            }
          } else if (create_missing_orders) {
            // Create new order with client and quote
            try {
              // 1. Find or create client
              let clientId: string;
              const { data: existingClient } = await supabaseAdmin
                .from('clients')
                .select('id')
                .eq('email', mappedData.client_email)
                .single();

              if (existingClient) {
                clientId = existingClient.id;
              } else {
                // Create new client (no auth user needed for partner jobs)
                const { data: newClient, error: clientError } = await supabaseAdmin
                  .from('clients')
                  .insert({
                    full_name: mappedData.client_name,
                    email: mappedData.client_email,
                    phone: mappedData.client_phone || null,
                    address: mappedData.job_address || null,
                    postcode: mappedData.postcode || null,
                    user_id: null // Set to null for partner clients (no auth user)
                  })
                  .select('id')
                  .single();

                if (clientError) {
                  result.summary.errors.push({
                    row: rowNumber,
                    error: `Failed to create client: ${clientError.message}`,
                    data: mappedData
                  });
                  continue;
                }
                clientId = newClient.id;
              }

              // 2. Create quote (tagged as partner import)
              const { data: newQuote, error: quoteError } = await supabaseAdmin
                .from('quotes')
                .insert({
                  client_id: clientId,
                  product_details: `Partner Job: ${mappedData.sub_partner || 'Unknown'}`,
                  total_cost: 0, // Partner jobs typically don't have cost data
                  materials_cost: 0,
                  install_cost: 0,
                  extras_cost: 0,
                  status: 'accepted',
                  quote_template: 'partner_import',
                  notes: `Auto-generated placeholder quote for partner import. Partner: ${importProfile.partner_id}, Run: ${runId}`
                })
                .select('id')
                .single();

              if (quoteError) {
                result.summary.errors.push({
                  row: rowNumber,
                  error: `Failed to create quote: ${quoteError.message}`,
                  data: mappedData
                });
                continue;
              }

              // 3. Create order
              const newOrderData = {
                ...orderData,
                client_id: clientId,
                quote_id: newQuote.id,
                total_amount: 0,
                deposit_amount: 0,
                amount_paid: 0,
                status: 'awaiting_payment',
                job_address: mappedData.job_address || null,
                postcode: mappedData.postcode || null
              };

              const { error: orderError } = await supabaseAdmin
                .from('orders')
                .insert(newOrderData);

              if (orderError) {
                result.summary.errors.push({
                  row: rowNumber,
                  error: `Failed to create order: ${orderError.message}`,
                  data: mappedData
                });
              } else {
                result.summary.inserted_count++;
              }
            } catch (createError) {
              result.summary.errors.push({
                row: rowNumber,
                error: `Order creation failed: ${createError.message}`,
                data: mappedData
              });
            }
          } else {
            // Skip creation of new orders
            result.summary.skipped_count++;
            result.summary.warnings.push({
              row: rowNumber,
              warning: 'Order does not exist - skipped (create_missing_orders disabled)',
              data: mappedData
            });
          }
        } else {
          // Dry run - provide detailed preview information
          const previewLimit = 100; // Limit preview results for performance
          
          if (existingOrder) {
            result.summary.updated_count++;
            
            // Add to preview if we haven't hit the limit
            if (result.preview && result.preview.updates.length < previewLimit) {
              let reason = `Status would be updated to: ${orderData.status_enhanced}`;
              
              if (shouldSuppress) {
                reason = `Scheduling suppressed (${mappedData.partner_status})`;
              } else if (mappedData.partner_status === 'INSTALL_DATE_CONFIRMED') {
                reason = `Status confirmed by partner with scheduled date: ${mappedData.scheduled_date}`;
              }
              
              // Check if status would regress
              const statusProgression = ['awaiting_payment', 'awaiting_agreement', 'awaiting_install_booking', 'scheduled', 'in_progress', 'install_completed_pending_qa', 'completed'];
              const currentIndex = statusProgression.indexOf(existingOrder.status_enhanced);
              const newIndex = statusProgression.indexOf(internalStatus);
              
              if (currentIndex > newIndex && !shouldSuppress && mappedData.partner_status !== 'INSTALL_DATE_CONFIRMED') {
                reason = `Status would NOT regress from ${existingOrder.status_enhanced} to ${internalStatus}`;
              }
              
              result.preview.updates.push({
                row: rowNumber,
                external_id: mappedData.partner_external_id,
                current_status: existingOrder.status_enhanced,
                new_status: orderData.status_enhanced || existingOrder.status_enhanced,
                reason,
                data: {
                  partner_status: mappedData.partner_status,
                  sub_partner: mappedData.sub_partner,
                  scheduled_date: mappedData.scheduled_date
                }
              });
            }
          } else if (create_missing_orders) {
            result.summary.inserted_count++;
            
            // Add to preview if we haven't hit the limit
            if (result.preview && result.preview.inserts.length < previewLimit) {
              result.preview.inserts.push({
                row: rowNumber,
                external_id: mappedData.partner_external_id,
                status: orderData.status_enhanced || internalStatus,
                reason: `Would create new order for ${mappedData.client_name} (${mappedData.client_email})`,
                data: {
                  partner_status: mappedData.partner_status,
                  sub_partner: mappedData.sub_partner,
                  scheduled_date: mappedData.scheduled_date
                }
              });
            }
          } else {
            result.summary.skipped_count++;
            
            // Add to preview if we haven't hit the limit
            if (result.preview && result.preview.skips.length < previewLimit) {
              result.preview.skips.push({
                row: rowNumber,
                external_id: mappedData.partner_external_id,
                reason: 'Order does not exist - would skip (create_missing_orders disabled)',
                data: {
                  partner_status: mappedData.partner_status,
                  sub_partner: mappedData.sub_partner,
                  scheduled_date: mappedData.scheduled_date
                }
              });
            }
          }
        }

      } catch (rowError) {
        console.error(`Error processing row ${rowNumber}:`, rowError);
        result.summary.errors.push({
          row: rowNumber,
          error: `Processing error: ${rowError.message}`,
        });
      }
    }

    // Log the import
    if (!dry_run) {
      await supabaseAdmin.rpc('log_partner_import', {
        p_run_id: runId,
        p_partner_id: importProfile.partner_id,
        p_profile_id: profile_id,
        p_dry_run: dry_run,
        p_total_rows: result.summary.processed,
        p_inserted_count: result.summary.inserted_count,
        p_updated_count: result.summary.updated_count,
        p_skipped_count: result.summary.skipped_count,
        p_warnings: result.summary.warnings,
        p_errors: result.summary.errors
      });
    }

    console.log('Import completed:', result.summary);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import failed:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Import failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
