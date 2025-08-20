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
    const now = new Date();
    console.log('Running offer expiry check at:', now.toISOString());

    // Find all pending offers that have expired
    const { data: expiredOffers, error: selectError } = await supabase
      .from('job_offers')
      .select(`
        id,
        order_id,
        engineer_id,
        offered_date,
        expires_at
      `)
      .eq('status', 'pending')
      .lt('expires_at', now.toISOString());

    if (selectError) {
      throw new Error('Failed to find expired offers: ' + selectError.message);
    }

    if (!expiredOffers || expiredOffers.length === 0) {
      console.log('No expired offers found');
      return new Response(
        JSON.stringify({ 
          message: 'No expired offers found',
          expired_count: 0
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`Found ${expiredOffers.length} expired offers to process`);

    // Update all expired offers to 'expired' status
    const { error: updateError } = await supabase
      .from('job_offers')
      .update({
        status: 'expired',
        expired_at: now.toISOString()
      })
      .in('id', expiredOffers.map(offer => offer.id));

    if (updateError) {
      throw new Error('Failed to update expired offers: ' + updateError.message);
    }

    // Get order numbers for logging (separate query to avoid embeds)
    const orderIds = [...new Set(expiredOffers.map(offer => offer.order_id))];
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number')
      .in('id', orderIds);
    
    const orderNumberMap = new Map(orders?.map(order => [order.id, order.order_number]) || []);

    // Log activities for each expired offer
    for (const offer of expiredOffers) {
      try {
        const orderNumber = orderNumberMap.get(offer.order_id) || 'Unknown';
        
        await supabase.rpc('log_order_activity', {
          p_order_id: offer.order_id,
          p_activity_type: 'offer_expired',
          p_description: `Installation offer for ${new Date(offer.offered_date).toLocaleDateString()} expired without response`,
          p_details: {
            offer_id: offer.id,
            engineer_id: offer.engineer_id,
            offered_date: offer.offered_date,
            expired_at: now.toISOString(),
            expires_at: offer.expires_at
          }
        });

        console.log(`Logged expiry for order ${orderNumber}`);
      } catch (logError) {
        console.error(`Failed to log activity for offer ${offer.id}:`, logError);
      }
    }

    console.log(`Successfully expired ${expiredOffers.length} offers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Expired ${expiredOffers.length} offers`,
        expired_count: expiredOffers.length,
        expired_offers: expiredOffers.map(offer => ({
          id: offer.id,
          order_number: orderNumberMap.get(offer.order_id) || 'Unknown',
          offered_date: offer.offered_date
        }))
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in expire-offers function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});