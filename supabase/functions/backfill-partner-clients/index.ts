import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== BACKFILL PARTNER CLIENTS FUNCTION ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find partner orders without client_id
    const { data: ordersWithoutClients, error: queryError } = await supabase
      .from('orders')
      .select(`
        id, 
        partner_id, 
        partner_external_id,
        job_address,
        postcode,
        partners!inner(name)
      `)
      .eq('is_partner_job', true)
      .is('client_id', null)
      .limit(100); // Process in batches

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    console.log(`Found ${ordersWithoutClients?.length || 0} partner orders without clients`);

    let processedCount = 0;
    let errorCount = 0;

    if (ordersWithoutClients && ordersWithoutClients.length > 0) {
      for (const order of ordersWithoutClients) {
        try {
          const partnerName = order.partners?.name || 'Partner';
          
          // Create placeholder client
          const placeholderClient = {
            full_name: `${partnerName} Customer`,
            email: `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${partnerName.toLowerCase().replace(/\s+/g, '')}.example`,
            address: order.job_address || null,
            postcode: order.postcode || null,
            user_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert(placeholderClient)
            .select('id')
            .single();

          if (clientError) {
            console.error(`Failed to create client for order ${order.id}:`, clientError);
            errorCount++;
            continue;
          }

          // Update order with new client_id
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              client_id: newClient.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          if (updateError) {
            console.error(`Failed to update order ${order.id}:`, updateError);
            errorCount++;
            continue;
          }

          console.log(`Successfully backfilled client for order ${order.id}`);
          processedCount++;

        } catch (error) {
          console.error(`Error processing order ${order.id}:`, error);
          errorCount++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      errors: errorCount,
      total_found: ordersWithoutClients?.length || 0,
      message: `Backfilled ${processedCount} orders, ${errorCount} errors`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})