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

    // Try to get token from request body first (for supabase.functions.invoke calls)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        token = body.token;
      } catch {
        // If JSON parsing fails, continue to try URL path
      }
    }

    // If no token from body, try URL path (for direct URL calls)
    if (!token) {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/');
      token = pathSegments[pathSegments.length - 1];
      
      // Don't use the function name as token
      if (token === 'offer-lookup') {
        token = undefined;
      }
    }

    console.log('Token received:', token);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Look up the offer by client token
    const { data: jobOffer, error: offerError } = await supabase
      .from('job_offers')
      .select(`
        *,
        order:orders!inner(
          *,
          client:clients(*),
          quote:quotes(*)
        ),
        engineer:engineers(*)
      `)
      .eq('client_token', token)
      .single();

    if (offerError || !jobOffer) {
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
          order_number: jobOffer.order.order_number,
          client: {
            full_name: jobOffer.order.client.full_name,
            email: jobOffer.order.client.email
          },
          is_partner_job: jobOffer.order.is_partner_job
        },
        engineer: {
          name: jobOffer.engineer.name
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