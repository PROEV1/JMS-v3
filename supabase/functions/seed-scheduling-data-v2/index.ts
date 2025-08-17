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
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
    'Vary': 'Origin'
  };
};

serve(async (req) => {
  console.log('[seed-scheduling-data-v2] Enhanced diagnostics v3 - Auto deployment with error handling');
  
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(`${req.method} request from origin: ${origin || 'none'}`);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request with 204 status');
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }

  // Handle GET requests for health check (no auth required)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      ok: true,
      name: 'seed-scheduling-data-v2',
      version: '2.0.0',
      message: 'Function is deployed and ready'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  try {
    // Validate environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey });
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Server configuration error - missing environment variables',
        details: { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Environment check passed, creating admin client');

    // Create admin client with service role key - this should bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Admin client created, parsing request body');

    // Test database connection first
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('Database connection test failed:', testError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Database connection failed',
        details: testError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Database connection successful');

    // Parse request body
    const requestBody = await req.json();
    const { clients = 100, orders_per_client_min = 1, orders_per_client_max = 3, tag = 'SEED', diagnose = false } = requestBody;

    console.log('Request parsed:', { clients, orders_per_client_min, orders_per_client_max, tag, diagnose });

    // Authentication and role checking
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Missing Authorization header' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid authentication token',
        details: authError?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin or manager role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to verify user permissions',
        details: profileError.message 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile || !['admin', 'manager'].includes(profile.role) || profile.status !== 'active') {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Admin or Manager access required',
        details: { role: profile?.role, status: profile?.status }
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Diagnostic mode - return environment and user info without creating data
    if (diagnose) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const seedUsers = existingUsers?.users?.filter(u => u.email?.includes('@seed.local')) || [];
      
      const { data: existingClients } = await supabaseAdmin
        .from('clients')
        .select('id')
        .ilike('email', '%@seed.local%');

      return new Response(JSON.stringify({
        success: true,
        diagnose: true,
        environment: {
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!serviceRoleKey,
          urlLength: supabaseUrl?.length || 0
        },
        authentication: {
          hasAuthHeader: !!authHeader,
          userId: user.id,
          userEmail: user.email,
          role: profile.role,
          status: profile.status
        },
        existingData: {
          seedUsers: seedUsers.length,
          seedClients: existingClients?.length || 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting seed with ${clients} clients, ${orders_per_client_min}-${orders_per_client_max} orders per client`);

    console.log('About to start creating clients and orders in batches');

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

    let errors: string[] = [];

    // Generate next sequence numbers for quote and order numbers
    let quoteSeq = 1000;
    let orderSeq = 2000;

    console.log(`Starting seed with ${clients} clients, ${orders_per_client_min}-${orders_per_client_max} orders per client`);

    // Get existing engineers for assignment
    const { data: engineers, error: engineersError } = await supabaseAdmin
      .from('engineers')
      .select('id, name, starting_postcode')
      .eq('availability', true);

    if (engineersError) {
      console.error('Failed to fetch engineers:', engineersError);
      errors.push(`Engineers fetch error: ${engineersError.message}`);
    }

    console.log(`Found ${engineers?.length || 0} available engineers`);

    // Get all existing seed data upfront to avoid creation conflicts
    console.log('Fetching existing seed data...');
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, full_name')
      .ilike('email', '%@seed.local%');
    
    const { data: existingClients } = await supabaseAdmin
      .from('clients')
      .select('id, user_id, email, full_name')
      .ilike('email', '%@seed.local%');

    console.log(`Found ${existingProfiles?.length || 0} existing seed profiles and ${existingClients?.length || 0} existing seed clients`);

    // Create clients and orders in batches
    const batchSize = 20;
    let consecutiveErrors = 0; // Track consecutive errors properly
    const MAX_CONSECUTIVE_ERRORS = 5;

    for (let batch = 0; batch < Math.ceil(clients / batchSize); batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, clients);
      
      console.log(`Processing batch ${batch + 1}: clients ${batchStart + 1}-${batchEnd}`);
      
      for (let i = batchStart; i < batchEnd; i++) {
        console.log(`Processing client ${i + 1} of ${clients}`);
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const location = postcodeAreas[Math.floor(Math.random() * postcodeAreas.length)];
        const email = `seed+${i + 1}@seed.local`;

        let authUser;
        let isNewUser = false;
        
        // Check if profile already exists
        const existingProfile = existingProfiles?.find(p => p.email === email);
        
        if (existingProfile) {
          console.log(`Found existing profile for ${email}, reusing user_id: ${existingProfile.user_id}`);
          // Get the auth user data
          const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(existingProfile.user_id);
          if (getUserError) {
            console.error(`Failed to get existing user ${existingProfile.user_id}:`, getUserError);
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.log(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
              break;
            }
            continue;
          }
          authUser = { user: userData.user };
        } else {
          // Create new auth user
          console.log(`Creating new auth user for ${email}...`);
          const { data: createUserData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: 'SeedPassword123!',
            email_confirm: true,
            user_metadata: {
              full_name: `${firstName} ${lastName}`,
              created_by: 'seed-function'
            }
          });

          if (userError) {
            if (userError.message?.includes('already been registered')) {
              console.log(`User ${email} already exists in auth, fetching existing user...`);
              // Try to find the existing user
              const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
              const existingAuthUser = allUsers?.users?.find(u => u.email === email);
              if (existingAuthUser) {
                authUser = { user: existingAuthUser };
                console.log(`Successfully found existing auth user: ${existingAuthUser.email}`);
                // Reset consecutive error count since this isn't really an error
                consecutiveErrors = 0;
              } else {
                console.error(`Could not find existing auth user for ${email}`);
                consecutiveErrors++;
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                  console.log(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
                  break;
                }
                continue;
              }
            } else {
              console.error(`Failed to create user ${email}:`, userError);
              consecutiveErrors++;
              if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                console.log(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
                break;
              }
              continue;
            }
          } else {
            authUser = createUserData;
            isNewUser = true;
            createdCounts.users++;
            consecutiveErrors = 0; // Reset on success
          }
        }

        console.log(`Successfully processed user for ${email}: ${authUser.user.email}`);

        // Upsert profile
        console.log(`Upserting profile for ${email}...`);
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            user_id: authUser.user.id,
            email,
            full_name: `${firstName} ${lastName}`,
            role: 'client',
            status: 'active'
          }, {
            onConflict: 'user_id'
          });

        if (profileError) {
          console.error(`Failed to upsert profile for ${email}:`, profileError);
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.log(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
            break;
          }
          continue;
        }

        // Upsert client
        console.log(`Upserting client record for ${email}...`);
        const { data: client, error: clientError } = await supabaseAdmin
          .from('clients')
          .upsert({
            user_id: authUser.user.id,
            full_name: `${firstName} ${lastName}`,
            email,
            phone: `07${Math.floor(Math.random() * 900000000) + 100000000}`,
            address: `${Math.floor(Math.random() * 200) + 1} ${['High Street', 'Main Road', 'Church Lane', 'Mill Street', 'Victoria Road'][Math.floor(Math.random() * 5)]}, ${location.city}`,
            postcode: location.postcode
          }, {
            onConflict: 'user_id'
          })
          .select()
          .single();

        if (clientError) {
          console.error(`Failed to upsert client for ${email}:`, clientError);
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.log(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
            break;
          }
          continue;
        }

        console.log(`Successfully processed client ${i + 1}: ${client.full_name}`);
        createdCounts.clients++;
        consecutiveErrors = 0; // Reset on success

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

    // Check if we actually created data
    if (createdCounts.clients === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No data was created - check errors for details',
        counts: createdCounts,
        errors: errors.slice(0, 10), // First 10 errors
        details: 'No clients were successfully created. This may indicate permission issues or database constraints.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully created ${createdCounts.clients} clients with ${createdCounts.orders} orders (${createdCounts.urgent} urgent)`,
      counts: createdCounts,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      reminder: `Use the Clear Seed Data function to remove this test data when no longer needed.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-scheduling-data-v2 function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error occurred',
      details: 'Check function logs for more information',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});