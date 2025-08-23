import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up order by survey token
    const { data: order, error } = await supabaseClient
      .from('orders')
      .select(`
        id,
        order_number,
        client_id,
        partner_id,
        is_partner_job,
        survey_required,
        survey_token_expires_at,
        clients!inner (
          id,
          full_name,
          email
        ),
        partners (
          id,
          name,
          logo_url
        )
      `)
      .eq('survey_token', token)
      .single();

    if (error || !order) {
      console.error('Order lookup failed:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired survey link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token has expired
    if (order.survey_token_expires_at && new Date(order.survey_token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Survey link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order: order 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Survey lookup error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})