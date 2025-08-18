
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ImportRequest {
  profile_id: string;
  csv_data?: string;
  dry_run?: boolean;
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
    const { profile_id, csv_data, dry_run = true } = body;

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
      }
    };

    let csvRows: string[][] = [];

    // Parse CSV data (simplified - in production you'd want a proper CSV parser)
    if (csv_data) {
      const lines = csv_data.trim().split('\n');
      csvRows = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
    } else if (importProfile.source_type === 'gsheet' && importProfile.gsheet_id) {
      // Fetch Google Sheets data
      const sheetsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheets-preview`, {
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

      const sheetsData = await sheetsResponse.json();
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

        // Validate required fields
        if (!mappedData.partner_external_id) {
          result.summary.errors.push({
            row: rowNumber,
            error: 'Missing partner_external_id',
            data: mappedData
          });
          continue;
        }

        // Apply status mapping
        let internalStatus = 'awaiting_install_booking';
        if (mappedData.partner_status && importProfile.status_mappings[mappedData.partner_status]) {
          internalStatus = importProfile.status_mappings[mappedData.partner_status];
        }

        // Check for status overrides (ON_HOLD, CANCELLATION_REQUESTED)
        const shouldSuppress = importProfile.status_override_rules[mappedData.partner_status] === true;

        // Check if order already exists
        const { data: existingOrder } = await supabaseAdmin
          .from('orders')
          .select('id, status_enhanced, partner_status')
          .eq('partner_id', importProfile.partner_id)
          .eq('partner_external_id', mappedData.partner_external_id)
          .single();

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
          orderData.partner_confirmed_externally = true;
          orderData.partner_confirmed_at = new Date().toISOString();
          orderData.external_confirmation_source = 'partner_jms';
          orderData.scheduled_install_date = new Date(mappedData.scheduled_date).toISOString();
          orderData.status_enhanced = 'scheduled';
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
          } else {
            // Create new order - would need client_id and quote_id
            // For now, skip creation of completely new orders
            result.summary.skipped_count++;
            result.summary.warnings.push({
              row: rowNumber,
              warning: 'Cannot create new orders without client context',
              data: mappedData
            });
          }
        } else {
          // Dry run - just log what would happen
          if (existingOrder) {
            result.summary.updated_count++;
          } else {
            result.summary.skipped_count++;
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
