import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SyncResult {
  success: boolean;
  created_areas: number;
  updated_engineers: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Create supabase client for service operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Create client for user auth validation
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  try {
    console.log('Processing engineer service areas sync request');

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(JSON.stringify({ 
        error: 'Authorization required',
        message: 'Please log in to sync service areas' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract and validate the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Invalid token or user not found:', authError);
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication',
        message: 'Please log in again' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('User is not admin:', user.email, profile?.role);
      return new Response(JSON.stringify({ 
        error: 'Access denied',
        message: 'Admin access required for this operation' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Admin user validated:', user.email);

    const result: SyncResult = {
      success: true,
      created_areas: 0,
      updated_engineers: 0,
      errors: []
    };

    // Find engineers with starting postcodes but no service areas
    const { data: engineers, error: engineersError } = await supabaseAdmin
      .from('engineers')
      .select('id, name, email, starting_postcode')
      .not('starting_postcode', 'is', null);

    if (engineersError) {
      console.error('Error fetching engineers:', engineersError);
      throw engineersError;
    }

    console.log(`Found ${engineers?.length || 0} engineers with starting postcodes`);

    // Process each engineer
    for (const engineer of engineers || []) {
      try {

        // Extract postcode area from starting postcode (e.g., "DA5 1BJ" -> "DA5")
        const postcodeArea = engineer.starting_postcode
          .trim()
          .toUpperCase()
          .split(' ')[0]; // Take the first part before space

        if (!postcodeArea || postcodeArea.length < 2) {
          result.errors.push(`Invalid postcode format for ${engineer.email}: ${engineer.starting_postcode}`);
          continue;
        }

        // Check if this specific postcode area already exists for this engineer
        const { data: existingSpecificArea, error: specificAreaError } = await supabaseAdmin
          .from('engineer_service_areas')
          .select('id')
          .eq('engineer_id', engineer.id)
          .eq('postcode_area', postcodeArea);

        if (specificAreaError) {
          console.error(`Error checking specific postcode area for ${engineer.email}:`, specificAreaError);
          result.errors.push(`Failed to check specific postcode area for ${engineer.email}`);
          continue;
        }

        // Skip if this specific postcode area already exists
        if (existingSpecificArea && existingSpecificArea.length > 0) {
          console.log(`Engineer ${engineer.email} already has service area for ${postcodeArea}, skipping`);
          continue;
        }

        // Create service area with 80 minutes travel time
        const { error: insertError } = await supabaseAdmin
          .from('engineer_service_areas')
          .insert({
            engineer_id: engineer.id,
            postcode_area: postcodeArea,
            max_travel_minutes: 80 // Set to 80 minutes as requested
          });

        if (insertError) {
          console.error(`Error creating service area for ${engineer.email}:`, insertError);
          result.errors.push(`Failed to create service area for ${engineer.email}: ${insertError.message}`);
          continue;
        }

        result.created_areas++;
        result.updated_engineers++;
        console.log(`Created service area ${postcodeArea} (80 min) for engineer ${engineer.email}`);

      } catch (engineerError) {
        console.error(`Error processing engineer ${engineer.email}:`, engineerError);
        result.errors.push(`Error processing ${engineer.email}: ${engineerError.message}`);
      }
    }

    console.log('Sync completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync failed:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Sync failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});