import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const partnerId = formData.get('partner_id') as string

    if (!file || !partnerId) {
      return new Response(
        JSON.stringify({ error: 'Missing file or partner_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read CSV content
    const csvContent = await file.text()
    const lines = csvContent.split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    
    console.log('CSV headers:', headers)
    console.log('Total rows:', lines.length - 1)

    let processedCount = 0
    let errorCount = 0
    const errors: any[] = []

    // Process each row (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = line.split(',').map(v => v.trim())
        const rowData: any = {}
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || ''
        })

        console.log(`Processing row ${i}:`, rowData)

        // Create client first
        const { data: client, error: clientError } = await supabaseClient
          .from('clients')
          .insert({
            full_name: rowData.client_name || rowData.name,
            email: rowData.client_email || rowData.email,
            phone: rowData.client_phone || rowData.phone,
            address: rowData.job_address || rowData.address,
            postcode: rowData.postcode,
            is_partner_client: true,
            partner_id: partnerId
          })
          .select()
          .single()

        if (clientError) {
          console.error('Client creation error:', clientError)
          errors.push({ row: i, error: `Client creation failed: ${clientError.message}` })
          errorCount++
          continue
        }

        // Create order
        const { data: order, error: orderError } = await supabaseClient
          .from('orders')
          .insert({
            client_id: client.id,
            partner_id: partnerId,
            is_partner_job: true,
            job_type: rowData.job_type || 'installation',
            job_address: rowData.job_address || rowData.address,
            postcode: rowData.postcode,
            installation_notes: rowData.notes || '',
            status: 'awaiting_payment',
            total_amount: parseInt(rowData.amount || '0') || 0,
            order_number: 'TEMP'
          })
          .select()
          .single()

        if (orderError) {
          console.error('Order creation error:', orderError)
          errors.push({ row: i, error: `Order creation failed: ${orderError.message}` })
          errorCount++
          continue
        }

        processedCount++
        console.log(`Successfully processed row ${i}`)

      } catch (error) {
        console.error(`Error processing row ${i}:`, error)
        errors.push({ row: i, error: error.message })
        errorCount++
      }
    }

    // Log the upload
    await supabaseClient
      .from('partner_job_uploads')
      .insert({
        partner_id: partnerId,
        uploaded_by: '', // Will be set by RLS/trigger
        file_name: file.name,
        upload_type: 'csv',
        status: errorCount > 0 ? 'completed' : 'completed',
        total_rows: lines.length - 1,
        processed_rows: processedCount,
        failed_rows: errorCount,
        error_details: errors,
        processed_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} jobs successfully`,
        stats: {
          total: lines.length - 1,
          processed: processedCount,
          errors: errorCount
        },
        errors: errors
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})