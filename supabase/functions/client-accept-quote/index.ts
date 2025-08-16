import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  console.log('client-accept-quote function called')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the JWT from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the JWT and get user
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

    const { quoteId } = await req.json()
    
    if (!quoteId) {
      return new Response(
        JSON.stringify({ error: 'Quote ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing quote acceptance for:', quoteId)

    // Get client record for this user
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, address')
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

    // Get quote and verify it belongs to this client
    const { data: quote, error: quoteError } = await supabaseAdmin
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

    // Check if there's already an order for this quote
    const { data: existingOrder, error: orderCheckError } = await supabaseAdmin
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

      // Create new order
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          client_id: client.id,
          quote_id: quoteId,
          total_amount: quote.total_cost,
          deposit_amount: depositAmount,
          job_address: client.address || null,
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

    // Accept the quote if it's not already accepted
    if (quote.status !== 'accepted') {
      const { error: updateError } = await supabaseAdmin
        .from('quotes')
        .update({ 
          status: 'accepted', 
          accepted_at: new Date().toISOString() 
        })
        .eq('id', quoteId)

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