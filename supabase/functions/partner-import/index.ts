
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

// Enhanced CORS headers for better cross-origin compatibility
const getCorsHeaders = (origin?: string | null) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000', 
    /^https?:\/\/preview--.*\.lovable\.app$/,
    /^https?:\/\/.*\.lovable\.dev$/,
    /^https?:\/\/.*\.lovable\.app$/
  ];

  let allowOrigin = '*';
  
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
    'Vary': 'Origin'
  };
};

interface ImportRow {
  [key: string]: string | null;
}

interface ImportResults {
  inserted: number;
  updated: number;
  skipped: number;
  duplicates: number;
  warnings: number;
  errors: number;
}

interface PerformanceMetrics {
  overall_time_ms: number;
  stages: {
    profile_fetch_ms: number;
    sheets_fetch_ms: number;
    mappings_fetch_ms: number;
    data_processing_ms: number;
    logging_ms: number;
  };
  row_processing: {
    total_time_ms: number;
    average_time_ms: number;
    slowest_rows: Array<{
      row_index: number;
      time_ms: number;
      partner_external_id?: string;
    }>;
  };
  database_calls: {
    total_count: number;
    client_queries: number;
    order_queries: number;
    insert_operations: number;
    update_operations: number;
  };
  rows_per_second: number;
}

serve(async (req) => {
  // Get origin for CORS
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Initialize performance tracking
  const overallStartTime = performance.now();
  const performanceMetrics: PerformanceMetrics = {
    overall_time_ms: 0,
    stages: {
      profile_fetch_ms: 0,
      sheets_fetch_ms: 0,
      mappings_fetch_ms: 0,
      data_processing_ms: 0,
      logging_ms: 0,
    },
    row_processing: {
      total_time_ms: 0,
      average_time_ms: 0,
      slowest_rows: [],
    },
    database_calls: {
      total_count: 0,
      client_queries: 0,
      order_queries: 0,
      insert_operations: 0,
      update_operations: 0,
    },
    rows_per_second: 0,
  };

  console.log('=== PARTNER IMPORT FUNCTION START ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Request body:', body)
    
    const { 
      profile_id, 
      dry_run = false, 
      max_rows = null,
      start_row = 0,
      chunk_size = null,
      job_ids_filter = null,
      benchmark_mode = false,
      job_duration_defaults = null
    } = body

    // Use max_rows if provided, otherwise fall back to chunk_size, otherwise default to 1000
    const actualChunkSize = max_rows || chunk_size || 1000

    if (!profile_id) {
      console.error('Missing profile_id')
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'profile_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Starting import for profile: ${profile_id}`)
    console.log(`Dry run: ${dry_run}, Max rows: ${max_rows}, Start row: ${start_row}, Actual chunk size: ${actualChunkSize}`)
    console.log(`Benchmark mode: ${benchmark_mode}`)

    // STAGE 1: Get import profile with all necessary data
    const profileStartTime = performance.now();
    const { data: profile, error: profileError } = await supabase
      .from('partner_import_profiles')
      .select(`
        *,
        partners (
          id,
          name,
          is_active,
          client_survey_required,
          client_payment_required,
          client_agreement_required
        )
      `)
      .eq('id', profile_id)
      .eq('is_active', true)
      .single()
    
    performanceMetrics.stages.profile_fetch_ms = performance.now() - profileStartTime;
    performanceMetrics.database_calls.total_count++;

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Import profile not found or inactive' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Found profile:', profile.name)
    console.log('Partner:', profile.partners?.name)

    // Merge job duration defaults: request body overrides profile, profile overrides fallback
    const fallbackDefaults = {
      installation: 3,
      assessment: 0.5,
      service_call: 1
    };
    
    const profileDefaults = profile.job_duration_defaults || {};
    const mergedDefaults = {
      ...fallbackDefaults,
      ...profileDefaults,
      ...(job_duration_defaults || {})
    };
    
    // Create normalized defaults map for lookup
    const normalizedDefaults = new Map();
    Object.entries(mergedDefaults).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      normalizedDefaults.set(normalizedKey, value);
    });
    
    console.log('Job duration defaults:', mergedDefaults)

    if (!profile.partners?.is_active) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Partner is not active' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // STAGE 2: Get Google Sheets data
    console.log('Fetching Google Sheets data...')
    console.log('Profile gsheet_id:', profile.gsheet_id)
    console.log('Profile gsheet_sheet_name:', profile.gsheet_sheet_name)
    
    const sheetsStartTime = performance.now();
    const { data: sheetsData, error: sheetsError } = await supabase.functions.invoke('google-sheets-preview', {
      body: {
        gsheet_id: profile.gsheet_id,
        sheet_name: profile.gsheet_sheet_name,
        start_row: start_row,
        max_rows: actualChunkSize
      }
    })
    performanceMetrics.stages.sheets_fetch_ms = performance.now() - sheetsStartTime;

    if (sheetsError || !sheetsData?.success) {
      console.error('Sheets error:', sheetsError, sheetsData)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch Google Sheets data',
        details: sheetsError || sheetsData
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const headers = sheetsData.headers || []
    const rawRows = sheetsData.rows || []
    const totalRows = sheetsData.total_rows || 0
    
    console.log(`Fetched ${rawRows.length} rows from Google Sheets (${totalRows} total rows)`)
    console.log('Headers:', headers)

    if (rawRows.length === 0) {
      console.log('No data to process')
      return new Response(JSON.stringify({
        success: true,
        message: 'No data to process',
        results: { inserted: 0, updated: 0, skipped: 0, duplicates: 0, warnings: 0, errors: 0 },
        chunk_info: {
          start_row,
          end_row: start_row,
          processed_count: 0,
          total_rows: totalRows,
          has_more: false,
          next_start_row: null,
          chunk_size: actualChunkSize
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Convert rows back to objects using headers
    const rawData: ImportRow[] = rawRows.map(row => {
      const rowObj: ImportRow = {}
      headers.forEach((header, index) => {
        rowObj[header] = row[index] || null
      })
      return rowObj
    })

    // Get column mappings
    const columnMappings = profile.column_mappings || {}
    console.log('Column mappings:', columnMappings)

    // Apply job_ids filter if provided
    let filteredData = rawData
    if (job_ids_filter && Array.isArray(job_ids_filter) && job_ids_filter.length > 0) {
      console.log(`Filtering data for ${job_ids_filter.length} specific job IDs:`, job_ids_filter)
      const jobIdColumn = columnMappings.partner_external_id
      if (jobIdColumn) {
        filteredData = rawData.filter(row => {
          const jobId = row[jobIdColumn] || null
          return jobId && job_ids_filter.includes(jobId)
        })
        console.log(`Filtered from ${rawData.length} to ${filteredData.length} rows`)
      } else {
        console.warn('job_ids_filter provided but no partner_external_id column mapping found')
      }
    }

    // STAGE 3: Get engineer and status mappings
    const mappingsStartTime = performance.now();
    
    // Get engineer mappings from profile's engineer_mapping_rules
    const engineerMap = new Map()
    if (profile.engineer_mapping_rules && Array.isArray(profile.engineer_mapping_rules)) {
      profile.engineer_mapping_rules.forEach(mapping => {
        if (mapping.partner_identifier && mapping.engineer_id) {
          engineerMap.set(mapping.partner_identifier, mapping.engineer_id)
        }
      })
    }
    console.log(`Loaded ${engineerMap.size} engineer mappings from profile`)

    // Get status mappings
    const { data: statusMappings } = await supabase
      .from('partner_status_mappings')
      .select('partner_status, internal_status')
      .eq('partner_id', profile.partner_id)

    performanceMetrics.database_calls.total_count++;

    const statusMap = new Map()
    if (statusMappings) {
      statusMappings.forEach(mapping => {
        statusMap.set(mapping.partner_status, mapping.internal_status)
      })
    }
    console.log(`Loaded ${statusMap.size} status mappings`)
    
    performanceMetrics.stages.mappings_fetch_ms = performance.now() - mappingsStartTime;

    // Process the data
    const results: ImportResults = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      warnings: 0,
      errors: 0
    }

    const warnings: any[] = []
    const errors: any[] = []
    const details = {
      inserted: [],
      updated: [],
      skipped: [],
      duplicates: [],
      warnings: [],
      errors: []
    }


    // STAGE 4: Process the data with bulk operations
    const dataProcessingStartTime = performance.now();
    const rowTimes: Array<{ row_index: number; time_ms: number; partner_external_id?: string }> = [];
    
    console.log('Starting bulk data processing...')

    // Process in batches for bulk operations
    const batchSize = 500; // Process 500 rows at a time for optimal memory usage
    const totalBatches = Math.ceil(filteredData.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStartTime = performance.now();
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, filteredData.length);
      const batchData = filteredData.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (rows ${batchStart + start_row + 1} to ${batchEnd + start_row})...`);
      
      // Prepare batch data structures
      const clientsBatch: any[] = [];
      const ordersBatch: any[] = [];
      const batchWarnings: any[] = [];
      const batchErrors: any[] = [];
      const emailToRowIndexMap = new Map<string, number>();
      const externalIdToRowIndexMap = new Map<string, number>();
      
      // Phase 1: Process and validate all rows in batch
      for (let i = 0; i < batchData.length; i++) {
        const rowStartTime = performance.now();
        const row = batchData[i];
        const rowIndex = start_row + batchStart + i + 1; // +1 because we skip header row

        try {
          // Reduced logging for performance - only log every 100 rows
          if (rowIndex % 100 === 0) {
            console.log(`Processing batch row ${rowIndex}...`);
          }

        // Extract and validate data using column mappings
        const clientName = row[columnMappings.client_name] || null
        const clientEmail = row[columnMappings.client_email] || null
        const clientPhone = row[columnMappings.client_phone] || null
        const jobAddress = row[columnMappings.job_address] || null
        const postcode = row[columnMappings.postcode] || null
        const partnerExternalId = row[columnMappings.partner_external_id] || null
        const partnerStatus = row[columnMappings.partner_status] || null
        const engineerIdentifier = row[columnMappings.engineer_identifier] || null
        // Use scheduled_date instead of install_date to match column mappings
        const installDate = row[columnMappings.scheduled_date] || row[columnMappings.install_date] || null
        const quoteAmount = row[columnMappings.quote_amount] || null
        const estimatedDurationHours = row[columnMappings.estimated_duration_hours] || null
        // Support both 'job_type' and 'type' column mappings
        const jobType = row[columnMappings.job_type] || row[columnMappings.type] || null

          // Skip if no external ID
          if (!partnerExternalId) {
            results.skipped++;
            details.skipped.push({ row: rowIndex, reason: 'No partner external ID' });
            continue;
          }

          // Validate required fields
          if (!clientName || !clientEmail) {
            results.skipped++;
            details.skipped.push({ row: rowIndex, reason: 'Missing required client data' });
            continue;
          }

        // Normalize phone number
        let normalizedPhone: string | null = null
        if (clientPhone && clientPhone !== '#ERROR!') {
          let phone = clientPhone.trim()
          
          // Handle scientific notation
          if (phone.includes('E+') || phone.includes('e+')) {
            try {
              const num = parseFloat(phone);
              if (!isNaN(num)) {
                phone = num.toString();
              }
            } catch (e) {
              batchWarnings.push({
                row: rowIndex,
                column: 'client_phone',
                message: `Invalid phone number format: '${clientPhone}'. Phone number skipped.`,
                data: { original_phone: clientPhone }
              });
            }
          }
          
          // Remove non-digits and validate
          const cleanPhone = phone.replace(/\D/g, '')
          if (cleanPhone.startsWith('44') && cleanPhone.length >= 12) {
            normalizedPhone = '0' + cleanPhone.substring(2)
          } else if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            normalizedPhone = cleanPhone
          }
          } else if (clientPhone === '#ERROR!') {
            batchWarnings.push({
              row: rowIndex,
              column: 'client_phone',
              message: `Invalid phone number format: '${clientPhone}'. Phone number skipped.`,
              data: { original_phone: clientPhone }
            });
          }

          // Engineer mapping
          let engineerId: string | null = null;
          if (engineerIdentifier) {
            engineerId = engineerMap.get(engineerIdentifier) || null;
            if (!engineerId) {
              batchWarnings.push({
                row: rowIndex,
                column: 'engineer_identifier',
                message: `No engineer mapping found for identifier: '${engineerIdentifier}'`,
                data: { engineer_identifier: engineerIdentifier }
              });
            }
          }

        // Status mapping
        let mappedStatus: string | null = null
        if (partnerStatus) {
          mappedStatus = statusMap.get(partnerStatus) || partnerStatus
        }

        // Parse install date - handle noon UTC to avoid timezone shifts
        let parsedInstallDate: string | null = null
        if (installDate && installDate !== 'TBC' && installDate !== '') {
          try {
            // Try different date formats
            let dateObj: Date | null = null
            
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(installDate)) {
              // DD/MM/YYYY or D/M/YYYY format
              const [day, month, year] = installDate.split('/')
              dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0) // noon UTC
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(installDate)) {
              // YYYY-MM-DD format - add noon UTC
              dateObj = new Date(installDate + 'T12:00:00.000Z')
            } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(installDate)) {
              // DD/MM/YY format (assume 20XX)
              const [day, month, year] = installDate.split('/')
              const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year)
              dateObj = new Date(fullYear, parseInt(month) - 1, parseInt(day), 12, 0, 0) // noon UTC
            }
            
            if (dateObj && !isNaN(dateObj.getTime())) {
              parsedInstallDate = dateObj.toISOString();
            }
          } catch (e) {
            // Silent handling for performance
          }
        }

        // Parse quote amount - allow null for missing/invalid amounts
        let parsedQuoteAmount = null
        if (quoteAmount && quoteAmount !== '' && quoteAmount !== 'NaN') {
          const numAmount = parseFloat(String(quoteAmount).replace(/[^0-9.-]/g, ''))
          if (!isNaN(numAmount)) {
            parsedQuoteAmount = numAmount
          } else {
            batchWarnings.push({
              row: rowIndex,
              column: 'quote_amount',
              message: `Invalid quote amount '${quoteAmount}' left blank`,
              data: { original_amount: quoteAmount }
            });
          }
        } else if (quoteAmount === 'NaN') {
          batchWarnings.push({
            row: rowIndex,
            column: 'quote_amount',
            message: `Quote amount contains 'NaN' - left blank`,
            data: { original_amount: quoteAmount }
          });
        }

        // Enhanced duration parsing to handle various formats from Google Sheets
        let parsedEstimatedDurationHours: number | null = null;
        
        if (estimatedDurationHours && estimatedDurationHours !== '' && estimatedDurationHours !== 'NaN') {
          const durationStr = String(estimatedDurationHours).trim();
          
          console.log(`Row ${rowIndex}: Processing duration '${durationStr}' for external ID ${partnerExternalId}`);
          
          // Try parsing decimal/float format FIRST (most common for simple numbers like "4", "5")
          const parsed = parseFloat(durationStr.replace(',', '.'));
          if (!isNaN(parsed) && parsed > 0 && parsed <= 12) {
            parsedEstimatedDurationHours = parsed;
            console.log(`Row ${rowIndex}: Successfully parsed duration as decimal: ${parsed}`);
          }
          
          // Try parsing HH:MM format (e.g., "4:00", "4:30") - Google Sheets time format
          if (parsedEstimatedDurationHours === null) {
            const timeMatch = durationStr.match(/^(\d{1,2}):(\d{2})$/);
            if (timeMatch) {
              const hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && minutes >= 0 && minutes < 60) {
                parsedEstimatedDurationHours = hours + (minutes / 60);
                console.log(`Row ${rowIndex}: Successfully parsed duration as time format: ${parsedEstimatedDurationHours}`);
              }
            }
          }
          
          // Try parsing "X hours" or "Xh" format (e.g., "4 hours", "4h", "4h 30m")
          if (parsedEstimatedDurationHours === null) {
            const hoursMatch = durationStr.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?)?/i);
            const minutesMatch = durationStr.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
            
            if (hoursMatch) {
              const hoursValue = parseFloat(hoursMatch[1].replace(',', '.'));
              if (!isNaN(hoursValue) && hoursValue >= 0 && hoursValue <= 12) {
                parsedEstimatedDurationHours = hoursValue;
                
                // Add minutes if present
                if (minutesMatch) {
                  const minutesValue = parseInt(minutesMatch[1], 10);
                  if (!isNaN(minutesValue) && minutesValue >= 0) {
                    parsedEstimatedDurationHours += minutesValue / 60;
                  }
                }
                console.log(`Row ${rowIndex}: Successfully parsed duration as text format: ${parsedEstimatedDurationHours}`);
              }
            }
          }
          
          // If parsing failed, log warning and preserve existing value
          if (parsedEstimatedDurationHours === null) {
            console.log(`Row ${rowIndex}: Failed to parse duration '${durationStr}' - will preserve existing DB value`);
            batchWarnings.push({
              row: rowIndex,
              column: 'estimated_duration_hours',
              message: `Could not parse duration '${estimatedDurationHours}' - preserving existing DB value`,
              data: { original_duration: estimatedDurationHours }
            });
          }
        } else {
          console.log(`Row ${rowIndex}: No duration provided - will preserve existing DB value`);
        }
        
        // CRITICAL: Do NOT set fallback values here - let the DB preserve existing values

          // Map job type to normalized values
          let mappedJobType = 'installation'; // Default
          if (jobType) {
            const normalizedType = jobType.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            if (['servicecall', 'maintenancevisit', 'warrantyvisit'].includes(normalizedType)) {
              mappedJobType = 'service_call';
            } else if (['assessment', 'survey', 'sitevisit', 'inperson'].includes(normalizedType)) {
              mappedJobType = 'assessment';
            } else {
              mappedJobType = 'installation';
            }
          }
          
          // Prepare client data for batch processing
          const normalizedEmail = clientEmail.toLowerCase();
          emailToRowIndexMap.set(normalizedEmail, rowIndex);
          externalIdToRowIndexMap.set(partnerExternalId, rowIndex);
          
          clientsBatch.push({
            full_name: clientName,
            email: normalizedEmail,
            phone: normalizedPhone,
            address: jobAddress,
            postcode: postcode
          });
          
          // Prepare order data
          const orderData: any = {
            partner_external_id: partnerExternalId,
            partner_status: mappedStatus,
            scheduled_install_date: parsedInstallDate,
            engineer_id: engineerId,
            total_amount: parsedQuoteAmount,
            job_type: mappedJobType,
            email: normalizedEmail, // Use this to match with client after bulk upsert
            is_partner_job: true,
            job_address: jobAddress,
            postcode: postcode,
            amount_paid: 0,
            deposit_amount: 0,
            status: 'active',
            survey_required: profile.partners?.client_survey_required ?? true
          };
          
          // Only include estimated_duration_hours if we successfully parsed it
          // This allows the DB function to preserve existing values for updates
          if (parsedEstimatedDurationHours !== null) {
            orderData.estimated_duration_hours = parsedEstimatedDurationHours;
          }
          
          // Apply status actions if defined in profile
          if (partnerStatus) {
            const statusActions = profile.status_actions || {};
            const statusAction = statusActions[partnerStatus];
            
            if (statusAction) {
              if (statusAction.actions?.suppress_scheduling) {
                orderData.scheduling_suppressed = true;
                orderData.scheduling_suppressed_reason = statusAction.actions.suppression_reason || 'status_mapping';
              } else {
                orderData.scheduling_suppressed = false;
                orderData.scheduling_suppressed_reason = null;
              }
            }
          }
          
          ordersBatch.push(orderData);
          
          // Track row processing time
          const rowEndTime = performance.now();
          const rowTime = rowEndTime - rowStartTime;
          rowTimes.push({
            row_index: rowIndex,
            time_ms: rowTime,
            partner_external_id: partnerExternalId
          });

        } catch (error) {
          batchErrors.push({
            row: rowIndex,
            message: `Processing failed: ${error.message}`,
            data: { error: error }
          });
          results.errors++;
        }
      }
      
      // Phase 2: Bulk process clients and orders if not dry run
      if (!dry_run && clientsBatch.length > 0) {
        try {
          console.log(`Bulk processing batch ${batchIndex + 1}: ${clientsBatch.length} clients, ${ordersBatch.length} orders`);
          
          // Bulk upsert clients
          const { data: clientMappings, error: clientBulkError } = await supabase
            .rpc('upsert_clients_for_partner_bulk', {
              p_clients: clientsBatch,
              p_partner_id: profile.partner_id
            });
          
          performanceMetrics.database_calls.total_count++;
          performanceMetrics.database_calls.client_queries++;
          
          if (clientBulkError || !clientMappings) {
            console.error('Bulk client upsert error:', clientBulkError);
            // Fall back to individual processing for this batch
            for (const clientData of clientsBatch) {
              batchErrors.push({
                row: emailToRowIndexMap.get(clientData.email),
                message: `Bulk client upsert failed: ${clientBulkError?.message || 'Unknown error'}`,
                data: { error: clientBulkError }
              });
              results.errors++;
            }
            continue;
          }
          
          // Create email to client_id mapping
          const emailToClientId = new Map<string, string>();
          clientMappings.forEach((mapping: any) => {
            emailToClientId.set(mapping.email, mapping.client_id);
          });
          
          // Update orders batch with client_ids
          const ordersWithClientIds = ordersBatch.map(order => ({
            ...order,
            client_id: emailToClientId.get(order.email)
          })).filter(order => order.client_id); // Only include orders with valid client_id
          
          // Remove email field as it's no longer needed
          ordersWithClientIds.forEach(order => delete order.email);
          
          // Bulk upsert orders
          const { data: orderMappings, error: orderBulkError } = await supabase
            .rpc('upsert_orders_for_partner_bulk', {
              p_orders: ordersWithClientIds,
              p_partner_id: profile.partner_id
            });
          
          performanceMetrics.database_calls.total_count++;
          if (orderBulkError || !orderMappings) {
            console.error('Bulk order upsert error:', orderBulkError);
            for (const orderData of ordersWithClientIds) {
              batchErrors.push({
                row: externalIdToRowIndexMap.get(orderData.partner_external_id),
                message: `Bulk order upsert failed: ${orderBulkError?.message || 'Unknown error'}`,
                data: { error: orderBulkError }
              });
              results.errors++;
            }
            continue;
          }
          
          // Update results based on bulk operation results
          orderMappings.forEach((mapping: any) => {
            const rowIndex = externalIdToRowIndexMap.get(mapping.partner_external_id);
            if (mapping.was_insert) {
              results.inserted++;
              details.inserted.push({
                row: rowIndex,
                order_id: mapping.order_id,
                partner_external_id: mapping.partner_external_id
              });
            } else {
              results.updated++;
              details.updated.push({
                row: rowIndex,
                order_id: mapping.order_id,
                partner_external_id: mapping.partner_external_id
              });
            }
            
            if (mapping.was_insert) {
              performanceMetrics.database_calls.insert_operations++;
            } else {
              performanceMetrics.database_calls.update_operations++;
            }
          });
          
        } catch (bulkError) {
          console.error('Bulk processing error:', bulkError);
          // Add all rows in batch to errors
          for (let i = 0; i < batchData.length; i++) {
            const rowIndex = start_row + batchStart + i + 1;
            batchErrors.push({
              row: rowIndex,
              message: `Bulk processing failed: ${bulkError.message}`,
              data: { error: bulkError }
            });
            results.errors++;
          }
        }
      } else if (dry_run) {
        // Dry run - just count as inserted for simulation
        for (let i = 0; i < ordersBatch.length; i++) {
          const rowIndex = start_row + batchStart + i + 1;
          results.inserted++;
          details.inserted.push({
            row: rowIndex,
            partner_external_id: ordersBatch[i].partner_external_id,
            dry_run: true
          });
        }
      }
      
      // Add batch warnings and errors to global collections
      warnings.push(...batchWarnings);
      errors.push(...batchErrors);
      
      const batchEndTime = performance.now();
      console.log(`Batch ${batchIndex + 1}/${totalBatches} completed in ${(batchEndTime - batchStartTime).toFixed(2)}ms`);
    }


    performanceMetrics.stages.data_processing_ms = performance.now() - dataProcessingStartTime;

    // Calculate row processing metrics
    performanceMetrics.row_processing.total_time_ms = rowTimes.reduce((sum, row) => sum + row.time_ms, 0);
    performanceMetrics.row_processing.average_time_ms = rowTimes.length > 0 ? performanceMetrics.row_processing.total_time_ms / rowTimes.length : 0;
    
    // Get top 10 slowest rows
    performanceMetrics.row_processing.slowest_rows = rowTimes
      .sort((a, b) => b.time_ms - a.time_ms)
      .slice(0, 10);

    // Add warnings to results
    results.warnings = warnings.length
    details.warnings = warnings
    details.errors = errors

    console.log('Import completed')
    console.log('Results:', results)

    // Generate run ID for tracking
    const runId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

    // Determine if there are more rows to process
    const hasMore = filteredData.length === actualChunkSize
    const nextStartRow = hasMore ? start_row + actualChunkSize : null

    // STAGE 5: Logging
    const loggingStartTime = performance.now();
    
    // Log the import run if not dry run
    if (!dry_run) {
      try {
        await supabase.rpc('log_partner_import', {
          p_run_id: runId,
          p_partner_id: profile.partner_id,
          p_profile_id: profile.id,
          p_dry_run: dry_run,
          p_total_rows: totalRows, // Use sheet total, not filtered data length
          p_inserted_count: results.inserted,
          p_updated_count: results.updated,
          p_skipped_count: results.skipped,
          p_warnings: warnings,
          p_errors: errors,
          p_skipped_details: details.skipped // Add skipped details
        })
        
        performanceMetrics.database_calls.total_count++;
      } catch (logError) {
        console.error('Failed to log import:', logError)
      }
    }
    
    performanceMetrics.stages.logging_ms = performance.now() - loggingStartTime;

    // Final performance calculations
    performanceMetrics.overall_time_ms = performance.now() - overallStartTime;
    performanceMetrics.rows_per_second = filteredData.length > 0 ? 
      (filteredData.length / (performanceMetrics.overall_time_ms / 1000)) : 0;

    console.log('=== PERFORMANCE METRICS ===');
    console.log(`Overall time: ${performanceMetrics.overall_time_ms.toFixed(2)}ms`);
    console.log(`Profile fetch: ${performanceMetrics.stages.profile_fetch_ms.toFixed(2)}ms`);
    console.log(`Sheets fetch: ${performanceMetrics.stages.sheets_fetch_ms.toFixed(2)}ms`);
    console.log(`Mappings fetch: ${performanceMetrics.stages.mappings_fetch_ms.toFixed(2)}ms`);
    console.log(`Data processing: ${performanceMetrics.stages.data_processing_ms.toFixed(2)}ms`);
    console.log(`Logging: ${performanceMetrics.stages.logging_ms.toFixed(2)}ms`);
    console.log(`Average row time: ${performanceMetrics.row_processing.average_time_ms.toFixed(2)}ms`);
    console.log(`Rows per second: ${performanceMetrics.rows_per_second.toFixed(2)}`);
    console.log(`Database calls: ${performanceMetrics.database_calls.total_count} (${performanceMetrics.database_calls.client_queries} client, ${performanceMetrics.database_calls.order_queries} order, ${performanceMetrics.database_calls.insert_operations} inserts, ${performanceMetrics.database_calls.update_operations} updates)`);

    const response = {
      success: true,
      run_id: runId,
      dry_run,
      job_ids_filter,
      benchmark_mode,
      chunk_info: {
        start_row,
        end_row: start_row + filteredData.length - 1,
        processed_count: filteredData.length,
        total_rows: sheetsData.total_rows || filteredData.length,
        has_more: hasMore,
        next_start_row: nextStartRow,
        chunk_size: actualChunkSize
      },
      results: {
        inserted: results.inserted,
        updated: results.updated,
        skipped: results.skipped,
        duplicates: results.duplicates,
        warnings: results.warnings,
        errors: results.errors
      },
      summary: {
        processed: filteredData.length,
        inserted_count: results.inserted,
        updated_count: results.updated,
        skipped_count: results.skipped,
        duplicates_count: results.duplicates,
        errors: errors,
        warnings: warnings,
        dry_run
      },
      performance_metrics: performanceMetrics,
      details
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
