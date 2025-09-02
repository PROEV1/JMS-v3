import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Normalizes postcode by converting "O" to "0" and formatting correctly
 */
function normalizePostcode(postcode: string): string {
  if (!postcode) return '';
  
  return postcode
    .replace(/O/g, '0') // Replace O with 0
    .replace(/\s+/g, ' ') // Normalize spaces
    .toUpperCase()
    .trim();
}

/**
 * Extracts postcode from an address string
 */
function extractPostcodeFromAddress(address: string): string | null {
  if (!address) return null;
  
  // UK postcode regex pattern
  const postcodePattern = /([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i;
  const match = address.match(postcodePattern);
  
  if (match) {
    return normalizePostcode(match[1]);
  }
  
  return null;
}

serve(async (req) => {
  console.log('backfill-postcodes function called, method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    })
  }

  // Only handle POST requests for backfill
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Validate admin access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin user validated:', user.email)

    let results = {
      clients_updated: 0,
      orders_updated: 0,
      clients_processed: 0,
      orders_processed: 0,
      errors: [] as string[]
    }

    // Backfill client postcodes
    console.log('Starting client postcode backfill...')
    
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, address, postcode')
      .is('postcode', null)
      .not('address', 'is', null)

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
      results.errors.push(`Error fetching clients: ${clientsError.message}`)
    } else {
      results.clients_processed = clients.length
      console.log(`Processing ${clients.length} clients without postcodes...`)

      for (const client of clients) {
        const extractedPostcode = extractPostcodeFromAddress(client.address)
        if (extractedPostcode) {
          const { error } = await supabaseAdmin
            .from('clients')
            .update({ postcode: extractedPostcode })
            .eq('id', client.id)

          if (error) {
            console.error(`Error updating client ${client.id}:`, error)
            results.errors.push(`Client ${client.id}: ${error.message}`)
          } else {
            results.clients_updated++
            console.log(`Updated client ${client.id} with postcode: ${extractedPostcode}`)
          }
        }
      }
    }

    // Backfill order postcodes
    console.log('Starting order postcode backfill...')
    
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id, 
        postcode, 
        job_address,
        client:clients!inner(id, postcode, address)
      `)
      .is('postcode', null)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      results.errors.push(`Error fetching orders: ${ordersError.message}`)
    } else {
      results.orders_processed = orders.length
      console.log(`Processing ${orders.length} orders without postcodes...`)

      for (const order of orders) {
        let postcodeToSet = null

        // Try client.postcode first
        if (order.client?.postcode) {
          postcodeToSet = normalizePostcode(order.client.postcode)
        }
        // Then try extracting from client.address
        else if (order.client?.address) {
          postcodeToSet = extractPostcodeFromAddress(order.client.address)
        }
        // Finally try extracting from order.job_address
        else if (order.job_address) {
          postcodeToSet = extractPostcodeFromAddress(order.job_address)
        }

        if (postcodeToSet) {
          const { error } = await supabaseAdmin
            .from('orders')
            .update({ postcode: postcodeToSet })
            .eq('id', order.id)

          if (error) {
            console.error(`Error updating order ${order.id}:`, error)
            results.errors.push(`Order ${order.id}: ${error.message}`)
          } else {
            results.orders_updated++
            console.log(`Updated order ${order.id} with postcode: ${postcodeToSet}`)
          }
        }
      }
    }

    console.log('Backfill completed:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Postcode backfill completed',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})