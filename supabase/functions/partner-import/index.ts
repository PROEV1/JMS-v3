
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

serve(async (req) => {
  console.log('=== PARTNER IMPORT FUNCTION START ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
      job_ids_filter = null
    } = body

    // Use max_rows if provided, otherwise fall back to chunk_size, otherwise default to 200
    const actualChunkSize = max_rows || chunk_size || 200

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

    // Get import profile with all necessary data
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

    if (!profile.partners?.is_active) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Partner is not active' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get Google Sheets data
    console.log('Fetching Google Sheets data...')
    console.log('Profile gsheet_id:', profile.gsheet_id)
    console.log('Profile gsheet_sheet_name:', profile.gsheet_sheet_name)
    const { data: sheetsData, error: sheetsError } = await supabase.functions.invoke('google-sheets-preview', {
      body: {
        gsheet_id: profile.gsheet_id,
        sheet_name: profile.gsheet_sheet_name,
        start_row: start_row,
        max_rows: actualChunkSize
      }
    })

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

    // Get engineer mappings
    const { data: engineerMappings } = await supabase
      .from('partner_engineer_mappings')
      .select('partner_engineer_identifier, engineer_id, engineers(name)')
      .eq('partner_id', profile.partner_id)

    const engineerMap = new Map()
    if (engineerMappings) {
      engineerMappings.forEach(mapping => {
        engineerMap.set(mapping.partner_engineer_identifier, mapping.engineer_id)
      })
    }
    console.log(`Loaded ${engineerMap.size} engineer mappings`)

    // Get status mappings
    const { data: statusMappings } = await supabase
      .from('partner_status_mappings')
      .select('partner_status, internal_status')
      .eq('partner_id', profile.partner_id)

    const statusMap = new Map()
    if (statusMappings) {
      statusMappings.forEach(mapping => {
        statusMap.set(mapping.partner_status, mapping.internal_status)
      })
    }
    console.log(`Loaded ${statusMap.size} status mappings`)

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

    console.log('Starting data processing...')

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i]
      const rowIndex = start_row + i + 1 // +1 because we skip header row

      try {
        console.log(`Processing row ${rowIndex}:`, row)

        // Extract and validate data using column mappings
        const clientName = row[columnMappings.client_name] || null
        const clientEmail = row[columnMappings.client_email] || null
        const clientPhone = row[columnMappings.client_phone] || null
        const jobAddress = row[columnMappings.job_address] || null
        const postcode = row[columnMappings.postcode] || null
        const partnerExternalId = row[columnMappings.partner_external_id] || null
        const partnerStatus = row[columnMappings.partner_status] || null
        const engineerIdentifier = row[columnMappings.engineer_identifier] || null
        const installDate = row[columnMappings.install_date] || null
        const quoteAmount = row[columnMappings.quote_amount] || null
        const estimatedDurationHours = row[columnMappings.estimated_duration_hours] || null

        // Skip if no external ID
        if (!partnerExternalId) {
          console.log(`Row ${rowIndex}: Skipping - no partner external ID`)
          results.skipped++
          details.skipped.push({ row: rowIndex, reason: 'No partner external ID' })
          continue
        }

        // Validate required fields
        if (!clientName || !clientEmail) {
          console.log(`Row ${rowIndex}: Skipping - missing required client data`)
          results.skipped++
          details.skipped.push({ row: rowIndex, reason: 'Missing required client data' })
          continue
        }

        // Normalize phone number
        let normalizedPhone: string | null = null
        if (clientPhone && clientPhone !== '#ERROR!') {
          let phone = clientPhone.trim()
          
          // Handle scientific notation
          if (phone.includes('E+') || phone.includes('e+')) {
            try {
              const num = parseFloat(phone)
              if (!isNaN(num)) {
                phone = num.toString()
              }
            } catch (e) {
              console.log(`Row ${rowIndex}: Invalid phone format: ${clientPhone}`)
              warnings.push({
                row: rowIndex,
                column: 'client_phone',
                message: `Invalid phone number format: '${clientPhone}'. Phone number skipped.`,
                data: { original_phone: clientPhone }
              })
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
          warnings.push({
            row: rowIndex,
            column: 'client_phone',
            message: `Invalid phone number format: '${clientPhone}'. Phone number skipped.`,
            data: { original_phone: clientPhone }
          })
        }

        // Engineer mapping
        let engineerId: string | null = null
        if (engineerIdentifier) {
          engineerId = engineerMap.get(engineerIdentifier) || null
          if (!engineerId) {
            warnings.push({
              row: rowIndex,
              column: 'engineer_identifier',
              message: `No engineer mapping found for identifier: '${engineerIdentifier}'`,
              data: { engineer_identifier: engineerIdentifier }
            })
          }
        }

        // Status mapping
        let mappedStatus: string | null = null
        if (partnerStatus) {
          mappedStatus = statusMap.get(partnerStatus) || partnerStatus
        }

        // Parse install date
        let parsedInstallDate: string | null = null
        if (installDate && installDate !== 'TBC' && installDate !== '') {
          try {
            // Try different date formats
            let dateObj: Date | null = null
            
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(installDate)) {
              // DD/MM/YYYY or D/M/YYYY format
              const [day, month, year] = installDate.split('/')
              dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(installDate)) {
              // YYYY-MM-DD format
              dateObj = new Date(installDate)
            }
            
            if (dateObj && !isNaN(dateObj.getTime())) {
              parsedInstallDate = dateObj.toISOString().split('T')[0]
            }
          } catch (e) {
            console.log(`Row ${rowIndex}: Invalid date format: ${installDate}`)
          }
        }

        // Parse quote amount - allow null for missing/invalid amounts
        let parsedQuoteAmount = null
        if (quoteAmount && quoteAmount !== '' && quoteAmount !== 'NaN') {
          const numAmount = parseFloat(String(quoteAmount).replace(/[^0-9.-]/g, ''))
          if (!isNaN(numAmount)) {
            parsedQuoteAmount = numAmount
          } else {
            warnings.push({
              row: rowIndex,
              column: 'quote_amount',
              message: `Invalid quote amount '${quoteAmount}' left blank`,
              data: { original_amount: quoteAmount }
            })
          }
        } else if (quoteAmount === 'NaN') {
          warnings.push({
            row: rowIndex,
            column: 'quote_amount',
            message: `Quote amount contains 'NaN' - left blank`,
            data: { original_amount: quoteAmount }
          })
        }

        // Parse estimated duration hours - default to 3 if not provided or invalid
        let parsedEstimatedDurationHours = 3 // Default value
        if (estimatedDurationHours && estimatedDurationHours !== '' && estimatedDurationHours !== 'NaN') {
          const numDuration = parseFloat(String(estimatedDurationHours).replace(/[^0-9.-]/g, ''))
          if (!isNaN(numDuration) && numDuration >= 1 && numDuration <= 12) {
            parsedEstimatedDurationHours = Math.round(numDuration)
          } else {
            warnings.push({
              row: rowIndex,
              column: 'estimated_duration_hours',
              message: `Invalid duration '${estimatedDurationHours}' - using default 3 hours`,
              data: { original_duration: estimatedDurationHours }
            })
          }
        }

        if (!dry_run) {
          // Find or create client
          let client
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('email', clientEmail.toLowerCase())
            .eq('partner_id', profile.partner_id)
            .single()

          if (existingClient) {
            client = existingClient
            // Update client info
            await supabase
              .from('clients')
              .update({
                full_name: clientName,
                phone: normalizedPhone,
                address: jobAddress,
                postcode: postcode,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingClient.id)
          } else {
            // Create new client
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                full_name: clientName,
                email: clientEmail.toLowerCase(),
                phone: normalizedPhone,
                address: jobAddress,
                postcode: postcode,
                is_partner_client: true,
                partner_id: profile.partner_id
              })
              .select('id')
              .single()

            if (clientError) {
              console.error(`Row ${rowIndex}: Client creation error:`, clientError)
              errors.push({
                row: rowIndex,
                message: `Client creation failed: ${clientError.message}`,
                data: { error: clientError }
              })
              results.errors++
              continue
            }
            client = newClient
          }

          // Check for existing order
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, status_enhanced, total_amount')
            .eq('partner_id', profile.partner_id)
            .eq('partner_external_id', partnerExternalId)
            .single()

          if (existingOrder) {
            // Update existing order
            const updateData: any = {
              client_id: client.id,
              job_address: jobAddress,
              postcode: postcode,
              partner_status: mappedStatus,
              total_amount: parsedQuoteAmount,
              estimated_duration_hours: parsedEstimatedDurationHours,
              updated_at: new Date().toISOString()
            }

            if (engineerId) {
              updateData.engineer_id = engineerId
            }

            if (parsedInstallDate) {
              updateData.scheduled_install_date = parsedInstallDate
            }

            const { error: updateError } = await supabase
              .from('orders')
              .update(updateData)
              .eq('id', existingOrder.id)

            if (updateError) {
              console.error(`Row ${rowIndex}: Order update error:`, updateError)
              errors.push({
                row: rowIndex,
                message: `Order update failed: ${updateError.message}`,
                data: { error: updateError }
              })
              results.errors++
            } else {
              console.log(`Row ${rowIndex}: Updated order ${existingOrder.id}`)
              results.updated++
              details.updated.push({
                row: rowIndex,
                order_id: existingOrder.id,
                partner_external_id: partnerExternalId
              })
            }
          } else {
            // Create new order (DO NOT include order_number - let DB generate it)
            const orderData: any = {
              client_id: client.id,
              partner_id: profile.partner_id,
              partner_external_id: partnerExternalId,
              is_partner_job: true,
              job_address: jobAddress,
              postcode: postcode,
              partner_status: mappedStatus,
              total_amount: parsedQuoteAmount,
              amount_paid: 0,
              deposit_amount: 0,
              status: 'awaiting_payment',
              survey_required: profile.partners?.client_survey_required ?? true,
              estimated_duration_hours: parsedEstimatedDurationHours
            }

            if (engineerId) {
              orderData.engineer_id = engineerId
            }

            if (parsedInstallDate) {
              orderData.scheduled_install_date = parsedInstallDate
            }

            console.log(`Row ${rowIndex}: Creating order with data:`, orderData)

            // Try creating order with retry logic for duplicate order_number
            let newOrder = null
            let orderError = null
            let retryCount = 0
            const maxRetries = 1

            while (retryCount <= maxRetries && !newOrder) {
              const { data: orderResult, error: currentOrderError } = await supabase
                .from('orders')
                .insert(orderData)
                .select('id, order_number')
                .single()

              if (currentOrderError) {
                // Check if it's a duplicate order_number error
                if (currentOrderError.code === '23505' && currentOrderError.message.includes('orders_order_number_key')) {
                  console.log(`Row ${rowIndex}: Duplicate order_number collision (attempt ${retryCount + 1}), retrying...`)
                  if (retryCount < maxRetries) {
                    // Small delay before retry
                    await new Promise(resolve => setTimeout(resolve, 100))
                    retryCount++
                    continue
                  } else {
                    orderError = currentOrderError
                    break
                  }
                } else {
                  orderError = currentOrderError
                  break
                }
              } else {
                newOrder = orderResult
              }
            }

            if (orderError) {
              console.error(`Row ${rowIndex}: Order creation error (partner_external_id: ${partnerExternalId}):`, orderError)
              errors.push({
                row: rowIndex,
                partner_external_id: partnerExternalId,
                message: `Upsert operation failed: ${orderError.message}`,
                data: { error: orderError }
              })
              results.errors++
            } else {
              console.log(`Row ${rowIndex}: Created order ${newOrder.id} with number ${newOrder.order_number}`)
              results.inserted++
              details.inserted.push({
                row: rowIndex,
                order_id: newOrder.id,
                order_number: newOrder.order_number,
                partner_external_id: partnerExternalId
              })
            }
          }
        } else {
          // Dry run - just count as inserted for simulation
          results.inserted++
          details.inserted.push({
            row: rowIndex,
            partner_external_id: partnerExternalId,
            dry_run: true
          })
        }

      } catch (error) {
        console.error(`Row ${rowIndex}: Processing error:`, error)
        errors.push({
          row: rowIndex,
          message: `Processing failed: ${error.message}`,
          data: { error: error }
        })
        results.errors++
      }
    }

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

    const response = {
      success: true,
      run_id: runId,
      dry_run,
      job_ids_filter,
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
      details
    }

    // Log the import run if not dry run
    if (!dry_run) {
      try {
        await supabase.rpc('log_partner_import', {
          p_run_id: runId,
          p_partner_id: profile.partner_id,
          p_profile_id: profile.id,
          p_dry_run: dry_run,
          p_total_rows: filteredData.length,
          p_inserted_count: results.inserted,
          p_updated_count: results.updated,
          p_skipped_count: results.skipped,
          p_warnings: warnings,
          p_errors: errors
        })
      } catch (logError) {
        console.error('Failed to log import:', logError)
      }
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
