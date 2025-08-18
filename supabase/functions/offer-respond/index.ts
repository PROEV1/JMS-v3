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

interface OfferResponse {
  token: string;
  response: 'accept' | 'reject';
  rejection_reason?: string;
  block_this_date?: boolean;
  block_date_range?: {
    start_date: string;
    end_date: string;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, response, rejection_reason, block_this_date, block_date_range }: OfferResponse = await req.json();

    if (!token || !response) {
      return new Response(
        JSON.stringify({ error: 'Token and response are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get the offer
    const { data: jobOffer, error: offerError } = await supabase
      .from('job_offers')
      .select(`
        *,
        order:orders!inner(*),
        engineer:engineers(*)
      `)
      .eq('client_token', token)
      .single();

    if (offerError || !jobOffer) {
      return new Response(
        JSON.stringify({ error: 'Offer not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Check if offer has expired
    const now = new Date();
    const expiresAt = new Date(jobOffer.expires_at);
    
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: 'This offer has expired' }),
        {
          status: 410,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Check if already responded
    if (jobOffer.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'This offer has already been responded to' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const responseTime = now.toISOString();

    if (response === 'accept') {
      // Accept the offer - only update job offer status, don't schedule yet
      const { error: updateOfferError } = await supabase
        .from('job_offers')
        .update({
          status: 'accepted',
          accepted_at: responseTime
        })
        .eq('id', jobOffer.id);

      if (updateOfferError) {
        throw new Error('Failed to update offer status');
      }

      // Log activity
      await supabase.rpc('log_order_activity', {
        p_order_id: jobOffer.order_id,
        p_activity_type: 'offer_accepted',
        p_description: `Client accepted installation offer for ${new Date(jobOffer.offered_date).toLocaleDateString()} with ${jobOffer.engineer.name} - Ready to book`,
        p_details: {
          offer_id: jobOffer.id,
          engineer_id: jobOffer.engineer_id,
          offered_date: jobOffer.offered_date,
          time_window: jobOffer.time_window,
          accepted_at: responseTime
        }
      });

      console.log(`Offer accepted for order ${jobOffer.order.order_number} - moved to ready-to-book`);

    } else if (response === 'reject') {
      // Reject the offer
      const { error: updateOfferError } = await supabase
        .from('job_offers')
        .update({
          status: 'rejected',
          rejected_at: responseTime,
          rejection_reason: rejection_reason || 'No reason provided'
        })
        .eq('id', jobOffer.id);

      if (updateOfferError) {
        throw new Error('Failed to update offer status');
      }

      // Handle date blocking if requested
      if (block_this_date) {
        const offeredDateOnly = jobOffer.offered_date.split('T')[0];
        
        const { error: blockDateError } = await supabase
          .from('client_blocked_dates')
          .insert({
            client_id: jobOffer.order.client_id,
            blocked_date: offeredDateOnly,
            reason: `Auto-blocked: Rejected offer for ${new Date(offeredDateOnly).toLocaleDateString('en-GB')}`
          });
        
        if (blockDateError) {
          console.error('Failed to block offered date:', blockDateError);
        } else {
          console.log(`Blocked date ${offeredDateOnly} for client ${jobOffer.order.client_id}`);
        }
      }

      // Handle date range blocking if requested
      if (block_date_range && block_date_range.start_date && block_date_range.end_date) {
        const startDate = new Date(block_date_range.start_date);
        const endDate = new Date(block_date_range.end_date);
        const blockedDates = [];
        
        // Generate all dates in the range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          blockedDates.push({
            client_id: jobOffer.order.client_id,
            blocked_date: currentDate.toISOString().split('T')[0],
            reason: `Unavailable: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}`
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        if (blockedDates.length > 0) {
          const { error: blockRangeError } = await supabase
            .from('client_blocked_dates')
            .insert(blockedDates);
          
          if (blockRangeError) {
            console.error('Failed to block date range:', blockRangeError);
          } else {
            console.log(`Blocked ${blockedDates.length} dates for client ${jobOffer.order.client_id}`);
          }
        }
      }

      // Log activity
      await supabase.rpc('log_order_activity', {
        p_order_id: jobOffer.order_id,
        p_activity_type: 'offer_rejected',
        p_description: `Client rejected installation offer for ${new Date(jobOffer.offered_date).toLocaleDateString()}`,
        p_details: {
          offer_id: jobOffer.id,
          engineer_id: jobOffer.engineer_id,
          offered_date: jobOffer.offered_date,
          rejection_reason: rejection_reason || 'No reason provided',
          rejected_at: responseTime,
          blocked_this_date: block_this_date || false,
          blocked_date_range: block_date_range || null
        }
      });

      console.log(`Offer rejected for order ${jobOffer.order.order_number}: ${rejection_reason}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: response === 'accept' ? 'Offer accepted successfully' : 'Offer rejected',
        response_type: response
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in offer-respond function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});