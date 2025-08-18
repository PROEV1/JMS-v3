import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  console.log('client-accept-quote function called, method:', req.method)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))
  console.log('URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  // Handle GET requests for testing
  if (req.method === 'GET') {
    console.log('Handling GET request - function is alive')
    return new Response(
      JSON.stringify({ message: 'Function is working', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Only handle POST requests for quote acceptance
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get request body
    const body = await req.json()
    console.log('Request body:', body)
    const { quoteId } = body
    
    if (!quoteId) {
      console.log('Missing quote ID')
      return new Response(
        JSON.stringify({ error: 'Quote ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing quote acceptance for:', quoteId)

    // Get the JWT from the request (required for RLS)
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.log('No authorization header')
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client for all operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Create user client only for RLS-compliant reads
    const jwt = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader }
      }
    })
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

    // Get client record for this user using user client (RLS compliant)
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, address, postcode')
      .eq('user_id', user.id)
      .single()

    if (clientError || !client) {
      console.error('Client error:', clientError)
      return new Response(
        JSON.stringify({ error: 'Client record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Client found:', client.id)

    // Get quote and verify it belongs to this client using user client (RLS compliant)
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select('id, status, total_cost, client_id')
      .eq('id', quoteId)
      .eq('client_id', client.id)
      .single()

    if (quoteError || !quote) {
      console.error('Quote error:', quoteError)
      return new Response(
        JSON.stringify({ error: 'Quote not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Quote found:', quote.id, 'Status:', quote.status)

    // Check if there's already an order for this quote using user client (RLS compliant)
    const { data: existingOrder, error: orderCheckError } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('quote_id', quoteId)
      .maybeSingle()

    if (orderCheckError) {
      console.error('Order check error:', orderCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let orderId: string
    let orderCreated = false

    if (existingOrder) {
      console.log('Order already exists:', existingOrder.id)
      orderId = existingOrder.id
    } else {
      console.log('Creating new order')
      
      // Calculate deposit (25% of total cost)
      const depositAmount = Math.round(quote.total_cost * 0.25 * 100) / 100

      // Create new order using admin client (bypasses RLS)
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          client_id: client.id,
          quote_id: quoteId,
          total_amount: quote.total_cost,
          deposit_amount: depositAmount,
          job_address: client.address || null,
          postcode: client.postcode || null,
          status: 'awaiting_payment'
        })
        .select('id')
        .single()

      if (orderError || !newOrder) {
        console.error('Order creation error:', orderError)
        return new Response(
          JSON.stringify({ error: 'Failed to create order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Order created:', newOrder.id)
      orderId = newOrder.id
      orderCreated = true
    }

    // Accept the quote if it's not already accepted using admin client (bypasses RLS)
    if (quote.status !== 'accepted') {
      const { error: updateError } = await supabaseAdmin
        .from('quotes')
        .update({ 
          status: 'accepted', 
          accepted_at: new Date().toISOString() 
        })
        .eq('id', quoteId)
        .eq('client_id', client.id) // Extra safety check

      if (updateError) {
        console.error('Quote update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to accept quote' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Quote accepted successfully')
    }

    return new Response(
      JSON.stringify({ 
        orderId, 
        orderCreated,
        message: orderCreated ? 'Quote accepted and order created' : 'Quote accepted, order already exists'
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