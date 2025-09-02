import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { corsHeaders, json } from '../_shared/cors.ts';

serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('test') === '1') {
      return json({ ok: true, status: 'alive', function: url.pathname }, 200, requestId);
    }

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
      return json({ ok: false, error: 'Token required' }, 400, requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Looking up offer with token:', token);

    // Look up the offer by client token (using separate queries to avoid ambiguous embeds)
    const { data: jobOffer, error: offerError } = await supabase
      .from('job_offers')
      .select('*')
      .eq('client_token', token)
      .single();

    if (offerError || !jobOffer) {
      console.log('Offer not found, error:', offerError);
      return json({ 
        ok: false,
        error: 'Offer not found or expired',
        expired: true
      }, 404, requestId);
    }

    // Get the order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:clients(*), quote:quotes(*)')
      .eq('id', jobOffer.order_id)
      .single();

    if (orderError || !order) {
      console.log('Order not found for offer:', orderError);
      return json({ 
        ok: false,
        error: 'Order not found',
        expired: true
      }, 404, requestId);
    }

    // Get the engineer details
    const { data: engineer, error: engineerError } = await supabase
      .from('engineers')
      .select('*')
      .eq('id', jobOffer.engineer_id)
      .single();

    if (engineerError || !engineer) {
      console.log('Engineer not found for offer:', engineerError);
      return json({ 
        ok: false,
        error: 'Engineer not found',
        expired: true
      }, 404, requestId);
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

      return json({ 
        ok: false,
        error: 'This offer has expired',
        expired: true
      }, 410, requestId);
    }

    // Check if offer has already been responded to
    if (jobOffer.status !== 'pending') {
      return json({
        ok: true,
        data: {
          ...jobOffer,
          already_responded: true
        }
      }, 200, requestId);
    }

    // Return offer details
    return json({
      ok: true,
      data: {
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
      }
    }, 200, requestId);

  } catch (error: any) {
    console.error('Error in offer-lookup function:', error);
    return json({ ok: false, error: String(error) }, 500, requestId);
  }
});