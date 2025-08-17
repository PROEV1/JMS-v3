import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

// Dynamic CORS handler for Lovable preview domains and localhost
const getCorsHeaders = (origin?: string | null) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    /^https?:\/\/preview--.*\.lovable\.app$/,
    /^https?:\/\/.*\.lovable\.dev$/
  ];

  let allowOrigin = '*';
  
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
    'Vary': 'Origin'
  };
};

serve(async (req) => {
  console.log('[seed-scheduling-data] Build 2025-01-17-v2 - CORS preflight 204 + verify_jwt=false');
  
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(`${req.method} request from origin: ${origin || 'none'}`);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request with 204');
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user is admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { clients = 100, orders_per_client_min = 1, orders_per_client_max = 3, tag = 'SEED' } = await req.json();

    console.log(`Starting seed with ${clients} clients, ${orders_per_client_min}-${orders_per_client_max} orders per client`);

    // Get existing engineers for assignment
    const { data: engineers } = await supabaseAdmin
      .from('engineers')
      .select('id, name, starting_postcode')
      .eq('availability', true);

    console.log(`Found ${engineers?.length || 0} available engineers`);

    // Postcode areas and cities for realistic data
    const postcodeAreas = [
      { postcode: 'SW1A 1AA', city: 'London', region: 'SW' },
      { postcode: 'SE1 9GF', city: 'London', region: 'SE' },
      { postcode: 'NW3 4HX', city: 'London', region: 'NW' },
      { postcode: 'E14 5GL', city: 'London', region: 'E' },
      { postcode: 'W2 1DY', city: 'London', region: 'W' },
      { postcode: 'M1 1AD', city: 'Manchester', region: 'M' },
      { postcode: 'B3 2TA', city: 'Birmingham', region: 'B' },
      { postcode: 'BS1 6AG', city: 'Bristol', region: 'BS' },
      { postcode: 'LS1 5AD', city: 'Leeds', region: 'LS' },
      { postcode: 'L3 9AG', city: 'Liverpool', region: 'L' },
      { postcode: 'NE1 7RU', city: 'Newcastle', region: 'NE' },
      { postcode: 'G1 1XQ', city: 'Glasgow', region: 'G' },
      { postcode: 'EH1 1YZ', city: 'Edinburgh', region: 'EH' },
      { postcode: 'CF10 3AT', city: 'Cardiff', region: 'CF' },
      { postcode: 'BT1 5GS', city: 'Belfast', region: 'BT' }
    ];

    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];

    // Order statuses distribution
    const orderStatuses = [
      { status: 'awaiting_payment', weight: 15 },
      { status: 'awaiting_agreement', weight: 10 },
      { status: 'awaiting_install_booking', weight: 20 },
      { status: 'scheduled', weight: 25 },
      { status: 'in_progress', weight: 10 },
      { status: 'install_completed_pending_qa', weight: 8 },
      { status: 'completed', weight: 10 },
      { status: 'quote_accepted', weight: 2 }
    ];

    let createdCounts = {
      users: 0,
      clients: 0,
      quotes: 0,
      orders: 0,
      urgent: 0
    };

    // Generate next sequence numbers for quote and order numbers
    let quoteSeq = 1000;
    let orderSeq = 2000;

    // Create clients and orders in batches
    const batchSize = 20;
    for (let batch = 0; batch < Math.ceil(clients / batchSize); batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, clients);
      
      console.log(`Processing batch ${batch + 1}: clients ${batchStart + 1}-${batchEnd}`);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const location = postcodeAreas[Math.floor(Math.random() * postcodeAreas.length)];
        
        // Create auth user
        const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: `seed+${i + 1}@seed.local`,
          password: 'SeedPassword123!',
          email_confirm: true,
          user_metadata: {
            full_name: `${firstName} ${lastName}`
          }
        });

        if (userError) {
          console.error(`Failed to create user ${i + 1}:`, userError);
          continue;
        }

        createdCounts.users++;

        // Create profile
        await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: authUser.user.id,
            email: `seed+${i + 1}@seed.local`,
            full_name: `${firstName} ${lastName}`,
            role: 'client',
            status: 'active'
          });

        // Create client
        const { data: client, error: clientError } = await supabaseAdmin
          .from('clients')
          .insert({
            user_id: authUser.user.id,
            full_name: `${firstName} ${lastName}`,
            email: `seed+${i + 1}@seed.local`,
            phone: `07${Math.floor(Math.random() * 900000000) + 100000000}`,
            address: `${Math.floor(Math.random() * 200) + 1} ${['High Street', 'Main Road', 'Church Lane', 'Mill Street', 'Victoria Road'][Math.floor(Math.random() * 5)]}, ${location.city}`,
            postcode: location.postcode
          })
          .select()
          .single();

        if (clientError) {
          console.error(`Failed to create client ${i + 1}:`, clientError);
          continue;
        }

        createdCounts.clients++;

        // Create 1-2 quotes per client
        const numQuotes = Math.random() < 0.7 ? 1 : 2;
        
        for (let q = 0; q < numQuotes; q++) {
          quoteSeq++;
          const materialsCost = Math.floor(Math.random() * 2000) + 1000;
          const installCost = Math.floor(Math.random() * 800) + 400;
          const extrasCost = Math.random() < 0.3 ? Math.floor(Math.random() * 500) : 0;
          const totalCost = materialsCost + installCost + extrasCost;

          const { data: quote, error: quoteError } = await supabaseAdmin
            .from('quotes')
            .insert({
              client_id: client.id,
              quote_number: `Q2024-${String(quoteSeq).padStart(4, '0')}`,
              product_details: 'EV Charger Type 2 - 7kW Smart Charger',
              materials_cost: materialsCost,
              install_cost: installCost,
              extras_cost: extrasCost,
              total_cost: totalCost,
              status: 'accepted',
              accepted_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single();

          if (quoteError) {
            console.error(`Failed to create quote:`, quoteError);
            continue;
          }

          createdCounts.quotes++;

          // Create quote items
          await supabaseAdmin
            .from('quote_items')
            .insert([
              {
                quote_id: quote.id,
                product_name: 'EV Charger Type 2',
                quantity: 1,
                unit_price: materialsCost,
                total_price: materialsCost,
                configuration: { type: '7kW', features: ['Smart', 'WiFi', 'App Control'] }
              },
              {
                quote_id: quote.id,
                product_name: 'Installation Service',
                quantity: 1,
                unit_price: installCost,
                total_price: installCost,
                configuration: { includes: ['Site Survey', 'Installation', 'Testing', 'Commissioning'] }
              }
            ]);

          // Create orders for this quote
          const numOrders = Math.floor(Math.random() * (orders_per_client_max - orders_per_client_min + 1)) + orders_per_client_min;
          
          for (let o = 0; o < numOrders; o++) {
            orderSeq++;
            
            // Select random status with weighted distribution
            const totalWeight = orderStatuses.reduce((sum, s) => sum + s.weight, 0);
            let random = Math.random() * totalWeight;
            let selectedStatus = orderStatuses[0].status;
            
            for (const statusOption of orderStatuses) {
              random -= statusOption.weight;
              if (random <= 0) {
                selectedStatus = statusOption.status;
                break;
              }
            }

            // Determine if this is urgent (15% chance)
            const isUrgent = Math.random() < 0.15;
            if (isUrgent) createdCounts.urgent++;

            // Generate realistic amounts
            const depositAmount = Math.floor(totalCost * 0.3);
            let amountPaid = 0;
            
            // Set payment status based on order status
            if (['awaiting_payment', 'quote_accepted'].includes(selectedStatus)) {
              amountPaid = 0;
            } else if (selectedStatus === 'awaiting_agreement') {
              amountPaid = Math.random() < 0.5 ? depositAmount : totalCost;
            } else {
              amountPaid = totalCost; // Fully paid for scheduled/in-progress/completed
            }

            // Generate scheduled date based on status
            let scheduledDate = null;
            if (['scheduled', 'in_progress', 'install_completed_pending_qa', 'completed'].includes(selectedStatus)) {
              const daysOffset = selectedStatus === 'completed' ? 
                -Math.floor(Math.random() * 30) : // Past dates for completed
                Math.floor(Math.random() * 60) + 1; // Future dates for others
              scheduledDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();
            }

            // Assign engineer (70% chance)
            let assignedEngineer = null;
            if (engineers && engineers.length > 0 && Math.random() < 0.7) {
              assignedEngineer = engineers[Math.floor(Math.random() * engineers.length)].id;
            }

            await supabaseAdmin
              .from('orders')
              .insert({
                client_id: client.id,
                quote_id: quote.id,
                order_number: `ORD2024-${String(orderSeq).padStart(4, '0')}`,
                status: selectedStatus === 'quote_accepted' ? 'awaiting_payment' : 'pending',
                status_enhanced: selectedStatus,
                total_amount: totalCost,
                deposit_amount: depositAmount,
                amount_paid: amountPaid,
                scheduled_install_date: scheduledDate,
                engineer_id: assignedEngineer,
                postcode: location.postcode,
                job_address: `${Math.floor(Math.random() * 200) + 1} ${['Oak Avenue', 'Elm Street', 'Pine Road', 'Birch Close', 'Cedar Drive'][Math.floor(Math.random() * 5)]}, ${location.city}, ${location.postcode}`,
                estimated_duration_hours: Math.floor(Math.random() * 4) + 3,
                travel_time_minutes: Math.floor(Math.random() * 60) + 15,
                installation_notes: isUrgent ? `URGENT - ${tag} - Priority installation required` : `${tag} - Standard installation`,
                internal_install_notes: `Generated by seed data - Region: ${location.region}`,
                updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
              });

            createdCounts.orders++;
          }
        }
      }
    }

    console.log('Seed data creation completed:', createdCounts);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully created ${createdCounts.clients} clients with ${createdCounts.orders} orders (${createdCounts.urgent} urgent)`,
      counts: createdCounts,
      reminder: `Use the Clear Seed Data function to remove this test data when no longer needed.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-scheduling-data function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});