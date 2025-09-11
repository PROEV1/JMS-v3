import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { search_postcode } = await req.json();
    
    console.log('Searching orders with postcode:', search_postcode);
    
    if (!search_postcode || search_postcode.length < 2) {
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client to bypass RLS
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Search orders with service role (bypasses RLS)
    const { data: orders, error } = await supabaseServiceRole
      .from('orders')
      .select(`
        id,
        order_number,
        scheduled_install_date,
        status_enhanced,
        client_id,
        engineer_id,
        clients (
          full_name,
          address,
          postcode,
          phone
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Filter orders by postcode
    const filteredOrders = (orders || []).filter(order => {
      if (!order.clients) return false;
      
      const orderPostcode = (order.clients.postcode || '').toLowerCase();
      const orderAddress = (order.clients.address || '').toLowerCase();
      const searchTerm = search_postcode.toLowerCase();
      const cleanPostcode = search_postcode.replace(/\s+/g, '').toLowerCase();
      const postcodeStart = cleanPostcode.substring(0, Math.min(4, cleanPostcode.length));
      
      return orderPostcode.includes(searchTerm) ||
             orderAddress.includes(searchTerm) ||
             orderPostcode.includes(postcodeStart) ||
             orderPostcode.replace(/\s+/g, '').includes(cleanPostcode);
    });

    console.log(`Found ${filteredOrders.length} orders matching postcode`);

    return new Response(
      JSON.stringify(filteredOrders),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});