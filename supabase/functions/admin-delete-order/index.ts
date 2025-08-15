import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteOrderRequest {
  orderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize regular client to check requesting user's permissions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    // Verify the authenticated user's role
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId }: DeleteOrderRequest = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order info before deletion for logging
    const { data: orderToDelete, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        client:clients(full_name, email),
        quote:quotes(quote_number)
      `)
      .eq('id', orderId)
      .single();

    if (fetchError || !orderToDelete) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the deletion action before actually deleting
    await supabaseAdmin.rpc('log_user_action', {
      p_action_type: 'order_deleted',
      p_target_user_id: user.id,
      p_details: {
        order_id: orderId,
        order_number: orderToDelete.order_number,
        client_name: orderToDelete.client?.full_name,
        client_email: orderToDelete.client?.email,
        quote_number: orderToDelete.quote?.quote_number,
        total_amount: orderToDelete.total_amount,
        deleted_by: user.id
      }
    });

    // Delete related records first (due to foreign key constraints)
    
    // Delete order activity
    const { error: activityError } = await supabaseAdmin
      .from('order_activity')
      .delete()
      .eq('order_id', orderId);

    if (activityError) {
      console.error('Error deleting order activity:', activityError);
    }

    // Delete order payments
    const { error: paymentsError } = await supabaseAdmin
      .from('order_payments')
      .delete()
      .eq('order_id', orderId);

    if (paymentsError) {
      console.error('Error deleting order payments:', paymentsError);
    }

    // Delete engineer uploads
    const { error: uploadsError } = await supabaseAdmin
      .from('engineer_uploads')
      .delete()
      .eq('order_id', orderId);

    if (uploadsError) {
      console.error('Error deleting engineer uploads:', uploadsError);
    }

    // Finally delete the order
    const { error: deleteError } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (deleteError) {
      console.error('Error deleting order:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order deleted successfully:', { 
      orderId, 
      orderNumber: orderToDelete.order_number,
      clientName: orderToDelete.client?.full_name 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Order deleted successfully',
        deletedOrder: {
          order_number: orderToDelete.order_number,
          client_name: orderToDelete.client?.full_name,
          total_amount: orderToDelete.total_amount
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-delete-order function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);