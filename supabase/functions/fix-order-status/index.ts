import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { order_id } = await req.json()

    if (!order_id) {
      throw new Error('order_id is required')
    }

    console.log(`Fixing order status for: ${order_id}`)

    // Get the order data
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError) throw orderError
    if (!order) throw new Error('Order not found')

    // Recalculate status using the database function
    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status_enhanced: 'awaiting_install_booking', // This will trigger the calculate_order_status_final function
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single()

    if (updateError) throw updateError

    console.log(`Order status updated:`, updatedOrder)

    return new Response(
      JSON.stringify({
        success: true,
        order: updatedOrder,
        message: 'Order status recalculated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error fixing order status:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})