import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get request data
    const { session_id } = await req.json();
    logStep("Request data received", { session_id });

    if (!session_id) {
      throw new Error("Missing required parameter: session_id");
    }

    // Fetch admin settings for Stripe configuration
    const { data: stripeConfigData, error: configError } = await supabaseClient
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe_config')
      .single();

    if (configError) {
      throw new Error(`Failed to fetch Stripe configuration: ${configError.message}`);
    }

    const stripeConfig = stripeConfigData.setting_value as any;
    logStep("Stripe config loaded", { environment: stripeConfig.environment });

    // Use test or live keys based on environment
    const stripeKey = stripeConfig.environment === 'test' 
      ? stripeConfig.test_secret_key 
      : stripeConfig.live_secret_key;

    if (!stripeKey) {
      throw new Error(`Stripe ${stripeConfig.environment} secret key not configured`);
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    logStep("Stripe initialized");

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep("Stripe session retrieved", { 
      sessionId: session.id, 
      paymentStatus: session.payment_status,
      metadata: session.metadata 
    });

    if (!session.metadata?.order_id) {
      throw new Error("Order ID not found in session metadata");
    }

    const orderId = session.metadata.order_id;
    const paymentType = session.metadata.payment_type || 'deposit';

    // Verify user has access to this order
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        clients!inner(user_id)
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      throw new Error(`Failed to fetch order: ${orderError.message}`);
    }

    // Check if user is admin or order owner
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = profileData?.role === 'admin';
    const isOrderOwner = orderData.clients.user_id === user.id;

    if (!isAdmin && !isOrderOwner) {
      throw new Error("You don't have permission to verify payment for this order");
    }

    logStep("Order verified", { orderNumber: orderData.order_number });

    // Update payment record based on Stripe session status
    let paymentStatus = 'pending';
    let paidAt = null;

    if (session.payment_status === 'paid') {
      paymentStatus = 'paid';
      paidAt = new Date().toISOString();
      logStep("Payment confirmed as paid");
    } else if (session.payment_status === 'unpaid') {
      paymentStatus = 'failed';
      logStep("Payment failed or unpaid");
    }

    // Update the payment record
    const { error: updatePaymentError } = await supabaseClient
      .from('order_payments')
      .update({
        status: paymentStatus,
        paid_at: paidAt,
        stripe_payment_intent_id: session.payment_intent
      })
      .eq('stripe_session_id', session_id);

    if (updatePaymentError) {
      logStep("Error updating payment record", { error: updatePaymentError.message });
    } else {
      logStep("Payment record updated", { status: paymentStatus });
    }

    // Update order amount_paid if payment was successful
    if (paymentStatus === 'paid') {
      const paymentAmount = session.amount_total ? session.amount_total / 100 : 0;
      
      const { error: updateOrderError } = await supabaseClient
        .from('orders')
        .update({
          amount_paid: orderData.amount_paid + paymentAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateOrderError) {
        logStep("Error updating order amount", { error: updateOrderError.message });
      } else {
        logStep("Order amount updated", { 
          previousAmount: orderData.amount_paid,
          addedAmount: paymentAmount,
          newTotal: orderData.amount_paid + paymentAmount
        });
      }

      // Check if order is fully paid and update status
      const newTotalPaid = orderData.amount_paid + paymentAmount;
      if (newTotalPaid >= orderData.total_amount) {
        const { error: statusUpdateError } = await supabaseClient
          .from('orders')
          .update({
            status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (!statusUpdateError) {
          logStep("Order marked as fully paid");
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      payment_status: paymentStatus,
      session_status: session.payment_status,
      amount_paid: session.amount_total ? session.amount_total / 100 : 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});