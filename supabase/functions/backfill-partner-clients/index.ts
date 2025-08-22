import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== BACKFILL PARTNER CLIENTS START ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Creating Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('URL exists:', !!supabaseUrl);
    console.log('Key exists:', !!supabaseKey);
    
    const supabase = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? ''
    )

    console.log('Querying orders without clients...');
    
    // Simplified query first - get basic order data
    const { data: ordersWithoutClients, error: queryError } = await supabase
      .from('orders')
      .select('id, partner_id, partner_external_id, job_address, postcode')
      .eq('is_partner_job', true)
      .is('client_id', null)
      .limit(10); // Start with smaller batch for testing

    console.log('Query result:', { 
      count: ordersWithoutClients?.length, 
      error: queryError?.message 
    });

    if (queryError) {
      console.error('Query error details:', queryError);
      throw new Error(`Query failed: ${queryError.message}`);
    }

    console.log(`Found ${ordersWithoutClients?.length || 0} partner orders without clients`);

    // Get partner names separately to avoid join issues
    const partnerIds = [...new Set(ordersWithoutClients?.map(o => o.partner_id).filter(Boolean))];
    console.log('Partner IDs to fetch:', partnerIds);
    
    const { data: partners, error: partnerError } = await supabase
      .from('partners')
      .select('id, name')
      .in('id', partnerIds);

    if (partnerError) {
      console.error('Partner query error:', partnerError);
    }

    const partnerMap = new Map(partners?.map(p => [p.id, p.name]) || []);
    console.log('Partner map:', Object.fromEntries(partnerMap));

    let processedCount = 0;
    let errorCount = 0;

    if (ordersWithoutClients && ordersWithoutClients.length > 0) {
      for (const order of ordersWithoutClients) {
        try {
          console.log(`Processing order ${order.id}...`);
          const partnerName = partnerMap.get(order.partner_id) || 'Partner';
          
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

          console.log('Creating client:', placeholderClient.full_name);

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

          console.log(`Created client ${newClient.id}, updating order...`);

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

    const result = {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total_found: ordersWithoutClients?.length || 0,
      message: `Backfilled ${processedCount} orders, ${errorCount} errors`
    };

    console.log('Final result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== BACKFILL FUNCTION ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Unknown error',
      errorType: typeof error
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})