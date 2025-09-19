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
  console.log('[seed-scheduling-data-v2] Enhanced diagnostics v5 - Forced redeploy with robust user handling');
  
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
      version: '3.0.0',
      message: 'Function deployed with robust user handling',
      timestamp: new Date().toISOString()
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

    // Comprehensive order bucket distribution to ensure all scheduling tiles are populated
    const orderBuckets = [
      { type: 'needs_scheduling', weight: 30, config: { status_enhanced: 'awaiting_install_booking', scheduling_suppressed: false, no_offers: true } },
      { type: 'date_offered', weight: 12, config: { status_enhanced: 'date_offered', has_pending_offer: true } },
      { type: 'ready_to_book', weight: 8, config: { status_enhanced: 'awaiting_install_booking', has_accepted_offer: true } },
      { type: 'scheduled', weight: 15, config: { status_enhanced: 'scheduled', has_install_date: true, has_engineer: true } },
      { type: 'completion_pending', weight: 8, config: { status_enhanced: 'install_completed_pending_qa', engineer_signed_off: true } },
      { type: 'completed', weight: 5, config: { status_enhanced: 'completed', fully_complete: true } },
      { type: 'on_hold', weight: 8, config: { scheduling_suppressed: true, partner_status: 'ON_HOLD' } },
      { type: 'cancelled', weight: 4, config: { partner_status: 'CANCELLED' } },
      { type: 'date_rejected', weight: 6, config: { has_rejected_offer: true, no_active_offers: true } },
      { type: 'offer_expired', weight: 4, config: { has_expired_offer: true, no_active_offers: true } }
    ];
    
    // Partner statuses for variety
    const partnerStatuses = ['ON_HOLD', 'INSTALL_DATE_CONFIRMED', 'INSTALLED', 'COMPLETION_PENDING', 'CANCELLED', 'CANCELLATION_REQUESTED', 'SWITCH_JOB_SUB_TYPE_REQUESTED'];
    
    // Time periods for different scenarios
    const now = new Date();
    const pastDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
    const futureDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    const nearFutureDate = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 days from now

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

          // Create orders for this quote with comprehensive bucket distribution
          const numOrders = Math.floor(Math.random() * (orders_per_client_max - orders_per_client_min + 1)) + orders_per_client_min;
          
          for (let o = 0; o < numOrders; o++) {
            orderSeq++;
            
            // Weighted random bucket selection
            const totalWeight = orderBuckets.reduce((sum, s) => sum + s.weight, 0);
            let randomWeight = Math.random() * totalWeight;
            let selectedBucket = orderBuckets[0];
            
            for (const bucket of orderBuckets) {
              randomWeight -= bucket.weight;
              if (randomWeight <= 0) {
                selectedBucket = bucket;
                break;
              }
            }
            
            console.log(`Creating order for bucket: ${selectedBucket.type}`);
            
            // Determine if this is urgent (15% chance)
            const isUrgent = Math.random() < 0.15;
            if (isUrgent) createdCounts.urgent++;
            
            // Calculate basic order properties
            const estimatedDuration = Math.random() < 0.8 ? 4 : (Math.random() < 0.5 ? 6 : 8);
            const depositAmount = Math.floor(totalCost * 0.3); // 30% deposit
            
            // Initialize order properties
            let scheduledDate = null;
            let assignedEngineer = null;
            let amountPaid = depositAmount; // Most orders have deposit paid
            let engineerSignedOff = null;
            let agreementSigned = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Most have agreement
            let orderStatus = 'active';
            let manualStatusOverride = false;
            let manualStatusNotes = null;
            let schedulingSuppressed = false;
            let partnerStatus = null;
            let surveyRequired = false; // Disable survey gating for most seeded orders
            
            // Configure order based on selected bucket
            switch (selectedBucket.type) {
            case 'needs_scheduling':
                // Pure needs scheduling - no offers, ready to go
                // CRITICAL: Ensure all prerequisites are met to bypass survey gating
                surveyRequired = false;
                amountPaid = totalCost; // Full payment to bypass payment gating
                agreementSigned = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
                manualStatusOverride = true;
                manualStatusNotes = 'Seeded for needs scheduling bucket - survey disabled, payment complete, agreement signed';
                console.log(`📋 Needs Scheduling Order Config: survey_required=${surveyRequired}, amount_paid=${amountPaid}, total_cost=${totalCost}, agreement_signed=${!!agreementSigned}`);
                break;
                
              case 'date_offered':
                // Will create pending job offer after order creation
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                break;
                
              case 'ready_to_book':
                // Will create accepted job offer after order creation
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                break;
                
              case 'scheduled':
                scheduledDate = Math.random() < 0.5 ? nearFutureDate : futureDate;
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                break;
                
              case 'completion_pending':
                scheduledDate = pastDate;
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                engineerSignedOff = new Date(pastDate.getTime() + (2 * 60 * 60 * 1000)); // 2 hours after install
                amountPaid = totalCost;
                break;
                
              case 'completed':
                scheduledDate = pastDate;
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                engineerSignedOff = new Date(pastDate.getTime() + (2 * 60 * 60 * 1000));
                amountPaid = totalCost;
                orderStatus = 'completed';
                break;
                
              case 'on_hold':
                schedulingSuppressed = true;
                partnerStatus = partnerStatuses[Math.floor(Math.random() * 3)]; // First 3 are hold statuses
                break;
                
              case 'cancelled':
                partnerStatus = Math.random() < 0.5 ? 'CANCELLED' : 'CANCELLATION_REQUESTED';
                break;
                
              case 'date_rejected':
                // Will create rejected job offer after order creation
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                break;
                
              case 'offer_expired':
                // Will create expired job offer after order creation  
                assignedEngineer = engineers?.[Math.floor(Math.random() * engineers.length)]?.id;
                break;
            }
            
            const { data: order, error: orderError } = await supabaseAdmin
              .from('orders')
              .insert({
                client_id: client.id,
                quote_id: quote.id,
                order_number: `ORD2024-${String(orderSeq).padStart(4, '0')}`,
                status: orderStatus,
                status_enhanced: selectedBucket.type === 'needs_scheduling' ? 'awaiting_install_booking' : null,
                manual_status_override: manualStatusOverride,
                manual_status_notes: manualStatusNotes,
                survey_required: surveyRequired,
                total_amount: totalCost,
                deposit_amount: depositAmount,
                amount_paid: amountPaid,
                agreement_signed_at: agreementSigned?.toISOString(),
                scheduled_install_date: scheduledDate?.toISOString(),
                engineer_id: assignedEngineer,
                engineer_signed_off_at: engineerSignedOff?.toISOString(),
                scheduling_suppressed: schedulingSuppressed,
                partner_status: partnerStatus,
                is_partner_job: partnerStatus ? true : false,
                postcode: location.postcode,
                job_address: `${Math.floor(Math.random() * 200) + 1} ${['Oak Avenue', 'Elm Street', 'Pine Road', 'Birch Close', 'Cedar Drive'][Math.floor(Math.random() * 5)]}, ${location.city}, ${location.postcode}`,
                estimated_duration_hours: estimatedDuration,
                travel_time_minutes: Math.floor(Math.random() * 60) + 15,
                installation_notes: isUrgent ? `URGENT - ${tag} - Priority installation required` : `${tag} - Standard installation`,
                internal_install_notes: `Generated by seed data for ${selectedBucket.type} bucket - Region: ${location.region}`,
                updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
              })
              .select()
              .single();

            if (orderError) {
              console.error(`Failed to create order for client ${client.full_name}:`, orderError);
              consecutiveErrors++;
              if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                console.log(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
                break;
              }
              continue;
            }

            console.log(`✅ Created order ${order.order_number} for bucket ${selectedBucket.type}`);
            
            // Log critical details for debugging bucket assignment
            if (selectedBucket.type === 'needs_scheduling') {
              console.log(`🔍 Needs Scheduling Order Details:`, {
                order_number: order.order_number,
                survey_required: order.survey_required,
                amount_paid: order.amount_paid,
                total_amount: order.total_amount,
                agreement_signed_at: order.agreement_signed_at,
                manual_status_override: order.manual_status_override,
                manual_status_notes: order.manual_status_notes
              });
            }
            createdCounts.orders++;
            consecutiveErrors = 0;
            
            // Create charger dispatch records for post-scheduled orders
            if (['scheduled', 'completion_pending', 'completed'].includes(selectedBucket.type)) {
              console.log(`Creating charger dispatch for post-scheduled order ${order.order_number}`);
              
              // Get a random charger item for dispatch
              const { data: chargerItems } = await supabaseAdmin
                .from('inventory_items')
                .select('id')
                .eq('is_charger', true)
                .eq('is_active', true)
                .limit(1);
              
              if (chargerItems && chargerItems.length > 0) {
                const dispatchedDate = selectedBucket.type === 'scheduled' 
                  ? new Date(scheduledDate.getTime() - (2 * 24 * 60 * 60 * 1000)) // 2 days before scheduled date
                  : new Date(pastDate.getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days before past date
                
                const { error: dispatchError } = await supabaseAdmin
                  .from('charger_dispatches')
                  .insert({
                    order_id: order.id,
                    charger_item_id: chargerItems[0].id,
                    status: 'sent',
                    serial_number: `CHR${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
                    dispatched_at: dispatchedDate.toISOString(),
                    dispatched_by: user.id,
                    tracking_number: `TRK${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
                    notes: `Courier: ${['DPD', 'UPS', 'Royal Mail', 'Hermes', 'DHL'][Math.floor(Math.random() * 5)]}\nDispatched for ${selectedBucket.type} order - Generated by seed data`
                  });
                
                if (dispatchError) {
                  console.error(`Failed to create charger dispatch for order ${order.order_number}:`, dispatchError);
                } else {
                  console.log(`✅ Created charger dispatch for order ${order.order_number}`);
                }
              }
            }
            
            
            // Create job offers based on bucket type
            if (['date_offered', 'ready_to_book', 'date_rejected', 'offer_expired'].includes(selectedBucket.type)) {
              const offeredDate = selectedBucket.type === 'offer_expired' ? 
                new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)) : // 3 days ago for expired
                new Date(now.getTime() + (1 * 24 * 60 * 60 * 1000)); // Tomorrow for others
              
              let offerStatus = 'pending';
              let expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
              let acceptedAt = null;
              let rejectedAt = null;
              let expiredAt = null;
              
              switch (selectedBucket.type) {
                case 'ready_to_book':
                  offerStatus = 'accepted';
                  acceptedAt = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour ago
                  break;
                case 'date_rejected':
                  offerStatus = 'rejected';
                  rejectedAt = new Date(now.getTime() - (60 * 60 * 1000));
                  break;
                case 'offer_expired':
                  offerStatus = 'expired';
                  expiresAt = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Expired yesterday
                  expiredAt = new Date(now.getTime() - (12 * 60 * 60 * 1000)); // 12 hours ago
                  break;
              }
              
              const { error: offerError } = await supabaseAdmin
                .from('job_offers')
                .insert({
                  order_id: order.id,
                  engineer_id: assignedEngineer,
                  offered_date: offeredDate.toISOString(),
                  time_window: '09:00-17:00',
                  status: offerStatus,
                  expires_at: expiresAt.toISOString(),
                  accepted_at: acceptedAt?.toISOString(),
                  rejected_at: rejectedAt?.toISOString(),
                  expired_at: expiredAt?.toISOString(),
                  client_token: `token_${order.id}_${Math.random().toString(36).substr(2, 9)}`,
                  created_by: user.id
                });
                
              if (offerError) {
                console.error(`Failed to create job offer for order ${order.order_number}:`, offerError);
              } else {
                console.log(`Created ${offerStatus} job offer for order ${order.order_number}`);
              }
            }
          }
        }
      }
    }

    console.log('Seed data creation completed:', createdCounts);

    // Verify order status distribution after creation
    console.log('🔍 Verifying order status distribution...');
    const { data: statusCheck } = await supabaseAdmin
      .from('orders')
      .select('status_enhanced, survey_required, amount_paid, total_amount, agreement_signed_at, manual_status_notes')
      .order('created_at', { ascending: false })
      .limit(50); // Check recent orders

    if (statusCheck) {
      const statusCounts = {};
      const needsSchedulingDetails = [];
      
      statusCheck.forEach(order => {
        const status = order.status_enhanced;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // Collect details for needs scheduling analysis
        if (order.manual_status_notes?.includes('needs scheduling bucket')) {
          needsSchedulingDetails.push({
            status_enhanced: order.status_enhanced,
            survey_required: order.survey_required,
            amount_paid: order.amount_paid,
            total_amount: order.total_amount,
            has_agreement: !!order.agreement_signed_at,
            payment_complete: order.amount_paid >= order.total_amount
          });
        }
      });
      
      console.log('📊 Recent order status distribution:', statusCounts);
      console.log('🎯 Needs Scheduling orders analysis:', needsSchedulingDetails);
    }

    // Check if we actually created data
    if (createdCounts.clients === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No data was created - check errors for details',
        counts: createdCounts,
        errors: errors.slice(0, 10),
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