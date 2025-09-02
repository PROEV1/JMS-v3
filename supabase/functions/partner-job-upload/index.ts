import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate placeholder email for missing/invalid emails
function generatePlaceholderEmail(partnerId: string, clientName: string | null, rowIndex: number): string {
  const sanitizedName = (clientName || 'client').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `noemail+${partnerId.slice(-8)}-row${rowIndex}-${sanitizedName}@placeholder.proev.invalid`;
}

// Validate and normalize email
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  
  const trimmed = email.trim();
  if (!trimmed) return null;
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed.toLowerCase() : null;
}

// Normalize phone number
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  
  let normalized = phone.trim();
  
  // Handle scientific notation (e.g., "4.48E+11")
  if (normalized.includes('E+') || normalized.includes('e+')) {
    try {
      const num = parseFloat(normalized);
      if (!isNaN(num)) {
        normalized = num.toString();
      }
    } catch (e) {
      return null;
    }
  }
  
  // Remove all non-digit characters
  normalized = normalized.replace(/\D/g, '');
  
  // Handle UK numbers starting with 44
  if (normalized.startsWith('44') && normalized.length >= 12) {
    normalized = '0' + normalized.substring(2);
  }
  
  // Validate UK mobile numbers (should be 11 digits starting with 07)
  // or landline numbers (10-11 digits)
  if (normalized.length >= 10 && normalized.length <= 11) {
    return normalized;
  }
  
  return null;
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

        // Handle email - validate and generate placeholder if needed
        const rawEmail = rowData.client_email || rowData.email;
        const normalizedEmail = normalizeEmail(rawEmail);
        let clientEmail = normalizedEmail;
        let isPlaceholderEmail = false;
        
        if (!clientEmail) {
          clientEmail = generatePlaceholderEmail(
            partnerId,
            rowData.client_name || rowData.name,
            i
          );
          isPlaceholderEmail = true;
          console.log(`Generated placeholder email for row ${i}: ${clientEmail}`);
        }

        // Handle phone number
        const normalizedPhone = normalizePhone(rowData.client_phone || rowData.phone);

        // Try to find existing client first (by email if valid, or by name+postcode for placeholders)
        let existingClient = null;
        
        if (!isPlaceholderEmail) {
          const { data: foundClient } = await supabaseClient
            .from('clients')
            .select('id, email, full_name')
            .eq('email', clientEmail)
            .eq('partner_id', partnerId)
            .single();
          existingClient = foundClient;
        } else {
          // For placeholder emails, try to match by name and postcode
          const { data: foundClient } = await supabaseClient
            .from('clients')
            .select('id, email, full_name')
            .eq('full_name', rowData.client_name || rowData.name)
            .eq('postcode', rowData.postcode)
            .eq('partner_id', partnerId)
            .eq('is_partner_client', true)
            .single();
          existingClient = foundClient;
        }

        let client = existingClient;
        
        // Create client if not found
        if (!client) {
          const { data: newClient, error: clientError } = await supabaseClient
            .from('clients')
            .insert({
              full_name: rowData.client_name || rowData.name || 'Unknown Client',
              email: clientEmail,
              phone: normalizedPhone,
              address: rowData.job_address || rowData.address,
              postcode: rowData.postcode,
              is_partner_client: true,
              partner_id: partnerId
            })
            .select()
            .single();

          if (clientError) {
            console.error('Client creation error:', clientError);
            errors.push({ row: i, error: `Client creation failed: ${clientError.message}` });
            errorCount++;
            continue;
          }
          
          client = newClient;
        }

        // Create order (using upsert to handle duplicates)
        const orderData = {
          client_id: client.id,
          partner_id: partnerId,
          is_partner_job: true,
          job_type: rowData.job_type || 'installation',
          job_address: rowData.job_address || rowData.address,
          postcode: rowData.postcode,
          installation_notes: rowData.notes || '',
          status: 'awaiting_payment',
          total_amount: parseFloat(rowData.amount || '0') || 0,
          deposit_amount: 0,
          amount_paid: 0
          // order_number will be auto-generated by trigger
        };

        const { data: order, error: orderError } = await supabaseClient
          .from('orders')
          .insert(orderData)
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