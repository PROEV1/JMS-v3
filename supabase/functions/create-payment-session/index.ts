import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase with service role for admin settings access
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
    const { order_id, amount, payment_type } = await req.json();
    logStep("Request data received", { order_id, amount, payment_type });

    if (!order_id || !amount || !payment_type) {
      throw new Error("Missing required parameters: order_id, amount, payment_type");
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

    // Get the order to verify ownership and get client details
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        clients!inner(
          email,
          full_name,
          user_id
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) {
      throw new Error(`Failed to fetch order: ${orderError.message}`);
    }

    // Verify the user owns this order (either as client or admin)
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = profileData?.role === 'admin';
    const isOrderOwner = orderData.clients.user_id === user.id;

    if (!isAdmin && !isOrderOwner) {
      throw new Error("You don't have permission to create payment for this order");
    }

    logStep("Order verified", { orderNumber: orderData.order_number, clientEmail: orderData.clients.email });

    // Check if customer already exists in Stripe
    const customers = await stripe.customers.list({ 
      email: orderData.clients.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: orderData.clients.email,
        name: orderData.clients.full_name,
        metadata: {
          client_id: orderData.client_id,
          order_id: order_id
        }
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Convert amount to cents (Stripe expects amounts in smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Create Stripe checkout session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'gbp', // TODO: Get from payment config
            product_data: {
              name: `${payment_type === 'deposit' ? 'Deposit' : 'Payment'} for Order ${orderData.order_number}`,
              description: `Order: ${orderData.order_number}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/order/${order_id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/order/${order_id}?payment=cancelled`,
      metadata: {
        order_id: order_id,
        payment_type: payment_type,
        user_id: user.id
      }
    });

    logStep("Stripe session created", { sessionId: session.id, url: session.url });

    // Create payment record
    const { error: paymentError } = await supabaseClient
      .from('order_payments')
      .insert({
        order_id: order_id,
        payment_type: payment_type,
        amount: amount,
        status: 'pending',
        stripe_session_id: session.id
      });

    if (paymentError) {
      logStep("Error creating payment record", { error: paymentError.message });
      // Don't fail the request, just log the error
    } else {
      logStep("Payment record created");
    }

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id 
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