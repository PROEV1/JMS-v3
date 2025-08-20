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
  token?: string;
  offer_id?: string;
  response: 'accept' | 'reject';
  rejection_reason?: string;
  block_this_date?: boolean;
  block_date_range?: {
    start_date: string;
    end_date: string;
  };
  blockDateRanges?: Array<{
    start_date: string;
    end_date: string;
  }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, offer_id, response, rejection_reason, block_this_date, block_date_range, blockDateRanges }: OfferResponse = await req.json();

    if ((!token && !offer_id) || !response) {
      return new Response(
        JSON.stringify({ error: 'Either token or offer_id and response are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    let jobOffer;

    if (token) {
      // External access via token (from email links) - using separate queries to avoid ambiguous embeds
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('client_token', token)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Offer not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }
      
      // Get order and engineer details separately
      const [orderResult, engineerResult] = await Promise.all([
        supabase.from('orders').select('*').eq('id', data.order_id).single(),
        supabase.from('engineers').select('*').eq('id', data.engineer_id).single()
      ]);

      if (orderResult.error || engineerResult.error) {
        return new Response(
          JSON.stringify({ error: 'Failed to load offer details' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      jobOffer = {
        ...data,
        order: orderResult.data,
        engineer: engineerResult.data
      };
    } else if (offer_id) {
      // Authenticated client access via offer ID
      // For authenticated access, we need to verify the client owns this order
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required for offer_id access' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Verify client access - using separate queries to avoid ambiguous embeds
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('id', offer_id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Offer not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      // Get order, client, and engineer details separately
      const [orderResult, engineerResult] = await Promise.all([
        supabase.from('orders').select('*, client:clients(user_id)').eq('id', data.order_id).single(),
        supabase.from('engineers').select('*').eq('id', data.engineer_id).single()
      ]);

      if (orderResult.error || engineerResult.error) {
        return new Response(
          JSON.stringify({ error: 'Failed to load offer details' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }

      jobOffer = {
        ...data,
        order: orderResult.data,
        engineer: engineerResult.data
      };
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

      // Reset order to awaiting_install_booking
      const { error: resetOrderError } = await supabase
        .from('orders')
        .update({
          engineer_id: null,
          scheduled_install_date: null,
          status_enhanced: 'awaiting_install_booking'
        })
        .eq('id', jobOffer.order_id);

      if (resetOrderError) {
        console.error('Failed to reset order status:', resetOrderError);
      }

      // Collect all dates to block in a Set to avoid duplicates
      const datesToBlock = new Set<string>();
      const blockingMessages: string[] = [];

      // Add offered date if requested
      if (block_this_date) {
        const offeredDateOnly = jobOffer.offered_date.split('T')[0];
        datesToBlock.add(offeredDateOnly);
        blockingMessages.push(`${new Date(offeredDateOnly).toLocaleDateString('en-GB')}`);
      }

      // Combine legacy single range with new multiple ranges
      const allRanges = [];
      if (block_date_range?.start_date && block_date_range.end_date) {
        allRanges.push(block_date_range);
      }
      if (blockDateRanges && Array.isArray(blockDateRanges)) {
        allRanges.push(...blockDateRanges);
      }

      // Process all date ranges
      for (const range of allRanges) {
        if (range.start_date && range.end_date) {
          const startDate = new Date(range.start_date);
          const endDate = new Date(range.end_date);
          
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            datesToBlock.add(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Add human-readable message
          if (startDate.getTime() === endDate.getTime()) {
            blockingMessages.push(`${startDate.toLocaleDateString('en-GB')}`);
          } else {
            blockingMessages.push(`${startDate.toLocaleDateString('en-GB')} → ${endDate.toLocaleDateString('en-GB')}`);
          }
        }
      }

      // Insert blocked dates using upsert to prevent duplicates
      if (datesToBlock.size > 0) {
        const blockedDatesArray = Array.from(datesToBlock).map(date => ({
          client_id: jobOffer.order.client_id,
          blocked_date: date,
          reason: `Client unavailable: ${blockingMessages.join(', ')}`
        }));

        const { error: blockDatesError } = await supabase
          .from('client_blocked_dates')
          .upsert(blockedDatesArray, {
            onConflict: 'client_id,blocked_date',
            ignoreDuplicates: true
          });
        
        if (blockDatesError) {
          console.error('Failed to block date range:', blockDatesError);
        } else {
          console.log(`Blocked ${datesToBlock.size} dates for client ${jobOffer.order.client_id}`);
        }

        // Update order scheduling conflicts for admin visibility
        const existingConflicts = jobOffer.order.scheduling_conflicts || [];
        const newConflict = {
          type: 'client_unavailability',
          message: `Client unavailable ${blockingMessages.join(', ')}`,
          ranges: allRanges,
          blocked_dates: Array.from(datesToBlock),
          source: 'client_rejection',
          created_at: responseTime
        };

        const { error: conflictsError } = await supabase
          .from('orders')
          .update({
            scheduling_conflicts: [...existingConflicts, newConflict]
          })
          .eq('id', jobOffer.order_id);

        if (conflictsError) {
          console.error('Failed to update scheduling conflicts:', conflictsError);
        }
      }

      // Log activity with better details
      await supabase.rpc('log_order_activity', {
        p_order_id: jobOffer.order_id,
        p_activity_type: 'offer_rejected',
        p_description: `Client rejected installation offer for ${new Date(jobOffer.offered_date).toLocaleDateString()} - ${datesToBlock.size > 0 ? `Blocked ${datesToBlock.size} dates` : 'No dates blocked'}`,
        p_details: {
          offer_id: jobOffer.id,
          engineer_id: jobOffer.engineer_id,
          offered_date: jobOffer.offered_date,
          rejection_reason: rejection_reason || 'No reason provided',
          rejected_at: responseTime,
          blocked_this_date: block_this_date || false,
          blocked_date_ranges: allRanges,
          blocked_dates_count: datesToBlock.size,
          blocking_summary: blockingMessages
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