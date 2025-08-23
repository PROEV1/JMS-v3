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

    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', user.id)

    // Verify user is a partner user
    const { data: partnerUser, error: partnerError } = await supabaseClient
      .from('partner_users')
      .select('*, partner:partners(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (partnerError || !partnerUser) {
      console.error('Partner user verification failed:', partnerError)
      return new Response(
        JSON.stringify({ error: 'User is not an authorized partner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Partner user verified:', partnerUser.id, 'for partner:', partnerUser.partner_id)

    // Parse request body
    const body = await req.json()
    const { client_name, client_email, client_phone, job_address, postcode, job_type, notes } = body

    if (!client_name || !client_email || !job_address || !postcode) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_name, client_email, job_address, postcode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if client already exists (upsert logic)
    const { data: existingClient } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('email', client_email)
      .eq('partner_id', partnerUser.partner_id)
      .single()

    let clientId: string

    if (existingClient) {
      // Update existing client
      const { data: updatedClient, error: updateError } = await supabaseClient
        .from('clients')
        .update({
          full_name: client_name,
          phone: client_phone,
          address: job_address,
          postcode: postcode,
        })
        .eq('id', existingClient.id)
        .select()
        .single()

      if (updateError) {
        console.error('Client update error:', updateError)
        return new Response(
          JSON.stringify({ error: `Failed to update client: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      clientId = updatedClient.id
      console.log('Updated existing client:', clientId)
    } else {
      // Create new client
      const { data: newClient, error: clientError } = await supabaseClient
        .from('clients')
        .insert({
          full_name: client_name,
          email: client_email,
          phone: client_phone,
          address: job_address,
          postcode: postcode,
          is_partner_client: true,
          partner_id: partnerUser.partner_id
        })
        .select()
        .single()

      if (clientError) {
        console.error('Client creation error:', clientError)
        return new Response(
          JSON.stringify({ error: `Failed to create client: ${clientError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      clientId = newClient.id
      console.log('Created new client:', clientId)
    }

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        client_id: clientId,
        partner_id: partnerUser.partner_id,
        is_partner_job: true,
        job_type: job_type || 'installation',
        job_address: job_address,
        postcode: postcode,
        installation_notes: notes || '',
        status: 'awaiting_payment',
        total_amount: 0,
        order_number: 'TEMP'
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return new Response(
        JSON.stringify({ error: `Failed to create order: ${orderError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully created order:', order.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Job created successfully',
        order: order
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