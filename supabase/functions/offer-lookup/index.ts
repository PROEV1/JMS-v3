import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let token;

    console.log('Offer lookup called with method:', req.method);
    console.log('Request URL:', req.url);

    // Handle both POST (from supabase.functions.invoke) and GET (direct URL access)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        token = body.token;
        console.log('Token from POST body:', token);
      } catch (e) {
        console.log('No JSON body or parse error:', e);
      }
    }

    // If no token from body or if GET request, try URL path
    if (!token) {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      console.log('Path segments:', pathSegments);
      
      // Look for token in the path - it should be the last segment
      if (pathSegments.length > 0) {
        token = pathSegments[pathSegments.length - 1];
        // Don't use the function name as token
        if (token === 'offer-lookup') {
          token = undefined;
        }
      }
      console.log('Token from URL path:', token);
    }

    if (!token) {
      console.log('No token found in request');
      return new Response(
        JSON.stringify({ error: 'Token required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log('Looking up offer with token:', token);

    // Look up the offer by client token (using separate queries to avoid ambiguous embeds)
    const { data: jobOffer, error: offerError } = await supabase
      .from('job_offers')
      .select('*')
      .eq('client_token', token)
      .single();

    if (offerError || !jobOffer) {
      console.log('Offer not found, error:', offerError);
      return new Response(
        JSON.stringify({ 
          error: 'Offer not found or expired',
          expired: true
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get the order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:clients(*), quote:quotes(*)')
      .eq('id', jobOffer.order_id)
      .single();

    if (orderError || !order) {
      console.log('Order not found for offer:', orderError);
      return new Response(
        JSON.stringify({ 
          error: 'Order not found',
          expired: true
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get the engineer details
    const { data: engineer, error: engineerError } = await supabase
      .from('engineers')
      .select('*')
      .eq('id', jobOffer.engineer_id)
      .single();

    if (engineerError || !engineer) {
      console.log('Engineer not found for offer:', engineerError);
      return new Response(
        JSON.stringify({ 
          error: 'Engineer not found',
          expired: true
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log('Offer lookup successful:', { offerId: jobOffer.id, orderId: order.id, engineerId: engineer.id });

    // Check if offer has expired
    const now = new Date();
    const expiresAt = new Date(jobOffer.expires_at);
    
    if (now > expiresAt && jobOffer.status === 'pending') {
      // Auto-expire the offer
      await supabase
        .from('job_offers')
        .update({
          status: 'expired',
          expired_at: now.toISOString()
        })
        .eq('id', jobOffer.id);

      return new Response(
        JSON.stringify({ 
          error: 'This offer has expired',
          expired: true
        }),
        {
          status: 410,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Check if offer has already been responded to
    if (jobOffer.status !== 'pending') {
      return new Response(
        JSON.stringify({
          ...jobOffer,
          already_responded: true
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Return offer details
    return new Response(
      JSON.stringify({
        id: jobOffer.id,
        status: jobOffer.status,
        offered_date: jobOffer.offered_date,
        time_window: jobOffer.time_window,
        expires_at: jobOffer.expires_at,
        order: {
          order_number: order.order_number,
          client: {
            full_name: order.client.full_name,
            email: order.client.email
          },
          is_partner_job: order.is_partner_job
        },
        engineer: {
          name: engineer.name
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in offer-lookup function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});