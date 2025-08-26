import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from '../_shared/cors.ts';

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

    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, requestId);
    }

    const { token, offer_id, response, rejection_reason, block_this_date, block_date_range, blockDateRanges }: OfferResponse = await req.json();

    if ((!token && !offer_id) || !response) {
      return json({ ok: false, error: 'Either token or offer_id and response are required' }, 400, requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let jobOffer;

    if (token) {
      // External access via token (from email links) - using separate queries to avoid ambiguous embeds
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('client_token', token)
        .single();

      if (error || !data) {
        return json({ ok: false, error: 'Offer not found' }, 404, requestId);
      }
      
      // Get order and engineer details separately
      const [orderResult, engineerResult] = await Promise.all([
        supabase.from('orders').select('*').eq('id', data.order_id).single(),
        supabase.from('engineers').select('*').eq('id', data.engineer_id).single()
      ]);

      if (orderResult.error || engineerResult.error) {
        return json({ ok: false, error: 'Failed to load offer details' }, 500, requestId);
      }

      jobOffer = {
        ...data,
        order: orderResult.data,
        engineer: engineerResult.data
      };
    } else if (offer_id) {
      // Authenticated client access via offer ID
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return json({ ok: false, error: 'Authorization required for offer_id access' }, 401, requestId);
      }

      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('id', offer_id)
        .single();

      if (error || !data) {
        return json({ ok: false, error: 'Offer not found' }, 404, requestId);
      }

      const [orderResult, engineerResult] = await Promise.all([
        supabase.from('orders').select('*, client:clients(user_id)').eq('id', data.order_id).single(),
        supabase.from('engineers').select('*').eq('id', data.engineer_id).single()
      ]);

      if (orderResult.error || engineerResult.error) {
        return json({ ok: false, error: 'Failed to load offer details' }, 500, requestId);
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
      return json({ ok: false, error: 'This offer has expired' }, 410, requestId);
    }

    // Check if already responded
    if (jobOffer.status !== 'pending') {
      return json({ ok: false, error: 'This offer has already been responded to' }, 409, requestId);
    }

    const responseTime = now.toISOString();

    if (response === 'accept') {
      // Accept the offer
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

      // Assign engineer to the order and clear manual override so triggers can calculate status
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({
          engineer_id: jobOffer.engineer_id,
          time_window: jobOffer.time_window,
          manual_status_override: false,
          manual_status_notes: null
          // Don't set scheduled_install_date or status_enhanced - let triggers handle status calculation
        })
        .eq('id', jobOffer.order_id);

      if (updateOrderError) {
        console.error('Failed to assign engineer to order:', updateOrderError);
        throw new Error('Failed to assign engineer to order');
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
      // Reject the offer with full date blocking functionality
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

      // Process date blocking
      const datesToBlock = new Set<string>();
      const blockingMessages: string[] = [];

      if (block_this_date) {
        const offeredDateOnly = jobOffer.offered_date.split('T')[0];
        datesToBlock.add(offeredDateOnly);
        blockingMessages.push(`${new Date(offeredDateOnly).toLocaleDateString('en-GB')}`);
      }

      const allRanges = [];
      if (block_date_range?.start_date && block_date_range.end_date) {
        allRanges.push(block_date_range);
      }
      if (blockDateRanges && Array.isArray(blockDateRanges)) {
        allRanges.push(...blockDateRanges);
      }

      for (const range of allRanges) {
        if (range.start_date && range.end_date) {
          const startDate = new Date(range.start_date);
          const endDate = new Date(range.end_date);
          
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            datesToBlock.add(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          if (startDate.getTime() === endDate.getTime()) {
            blockingMessages.push(`${startDate.toLocaleDateString('en-GB')}`);
          } else {
            blockingMessages.push(`${startDate.toLocaleDateString('en-GB')} → ${endDate.toLocaleDateString('en-GB')}`);
          }
        }
      }

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
      }

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

    return json({
      ok: true,
      data: {
        success: true,
        message: response === 'accept' ? 'Offer accepted successfully' : 'Offer rejected',
        response_type: response
      }
    }, 200, requestId);

  } catch (error: any) {
    console.error('Error in offer-respond function:', error);
    return json({ ok: false, error: String(error) }, 500, requestId);
  }
});