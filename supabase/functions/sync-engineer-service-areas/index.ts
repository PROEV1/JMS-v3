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
  normalized_areas: number;
  errors: string[];
}

/**
 * Robust outward code extraction for UK postcodes
 * Handles both spaced and unspaced postcodes correctly
 */
function getOutwardCode(postcode: string): string {
  if (!postcode) return '';
  
  // Normalize first: uppercase, replace O with 0, remove all spaces
  const normalized = postcode.replace(/O/g, '0').replace(/\s+/g, '').toUpperCase().trim();
  
  // UK postcode outward code regex patterns:
  // 1-2 letters, followed by 1-2 digits, optionally followed by a letter
  const outwardCodePattern = /^([A-Z]{1,2}[0-9]{1,2}[A-Z]?)/;
  const match = normalized.match(outwardCodePattern);
  
  return match ? match[1] : '';
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
      normalized_areas: 0,
      errors: []
    };

    console.log('Step 1: Normalizing existing service areas...');
    
    // First, normalize existing service areas
    const { data: existingAreas, error: areasError } = await supabaseAdmin
      .from('engineer_service_areas')
      .select('id, engineer_id, postcode_area');

    if (areasError) {
      console.error('Error fetching existing service areas:', areasError);
      result.errors.push(`Failed to fetch existing service areas: ${areasError.message}`);
    } else if (existingAreas) {
      for (const area of existingAreas) {
        const normalizedOutward = getOutwardCode(area.postcode_area);
        
        if (normalizedOutward && normalizedOutward !== area.postcode_area) {
          console.log(`Normalizing service area: ${area.postcode_area} -> ${normalizedOutward}`);
          
          // Check if normalized version already exists for this engineer
          const { data: existingNormalized } = await supabaseAdmin
            .from('engineer_service_areas')
            .select('id')
            .eq('engineer_id', area.engineer_id)
            .eq('postcode_area', normalizedOutward)
            .single();

          if (existingNormalized) {
            // Delete the old non-normalized version since normalized version exists
            console.log(`Deleting duplicate non-normalized area: ${area.postcode_area}`);
            await supabaseAdmin
              .from('engineer_service_areas')
              .delete()
              .eq('id', area.id);
          } else {
            // Update to normalized version
            const { error: updateError } = await supabaseAdmin
              .from('engineer_service_areas')
              .update({ postcode_area: normalizedOutward })
              .eq('id', area.id);

            if (updateError) {
              console.error(`Error normalizing area ${area.postcode_area}:`, updateError);
              result.errors.push(`Failed to normalize area ${area.postcode_area}: ${updateError.message}`);
            } else {
              result.normalized_areas++;
            }
          }
        }
      }
    }

    console.log('Step 2: Creating missing service areas for engineers...');

    // Find engineers with starting postcodes but no service areas
    const { data: engineers, error: engineersError } = await supabaseAdmin
      .from('engineers')
      .select(`
        id,
        name,
        email,
        starting_postcode,
        engineer_service_areas (
          id,
          postcode_area
        )
      `)
      .not('starting_postcode', 'is', null);

    if (engineersError) {
      console.error('Error fetching engineers:', engineersError);
      throw engineersError;
    }

    console.log(`Found ${engineers?.length || 0} engineers with starting postcodes`);

    // Process each engineer
    for (const engineer of engineers || []) {
      try {
        // Extract outward code using robust function
        const outwardCode = getOutwardCode(engineer.starting_postcode);
        
        if (!outwardCode) {
          result.errors.push(`Could not extract outward code from ${engineer.starting_postcode} for engineer ${engineer.email}`);
          continue;
        }
        
        // Check if engineer already has a service area for this outward code
        const hasServiceArea = engineer.engineer_service_areas?.some(
          area => area.postcode_area === outwardCode
        );

        if (hasServiceArea) {
          console.log(`Engineer ${engineer.email} already has service area for ${outwardCode}, skipping`);
          continue;
        }

        // Create service area with 80 minutes travel time
        const { error: insertError } = await supabaseAdmin
          .from('engineer_service_areas')
          .insert({
            engineer_id: engineer.id,
            postcode_area: outwardCode,
            max_travel_minutes: 80
          });

        if (insertError) {
          console.error(`Error creating service area for ${engineer.email}:`, insertError);
          result.errors.push(`Failed to create service area for ${engineer.email}: ${insertError.message}`);
          continue;
        }

        result.created_areas++;
        result.updated_engineers++;
        console.log(`Created service area ${outwardCode} (80 min) for engineer ${engineer.email}`);

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