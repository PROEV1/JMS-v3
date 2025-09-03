import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EngineerRow {
  email: string;
  full_name?: string;
  region?: string;
  availability?: boolean;
  starting_postcode?: string;
  mon_available?: boolean;
  mon_start?: string;
  mon_end?: string;
  tue_available?: boolean;
  tue_start?: string;
  tue_end?: string;
  wed_available?: boolean;
  wed_start?: string;
  wed_end?: string;
  thu_available?: boolean;
  thu_start?: string;
  thu_end?: string;
  fri_available?: boolean;
  fri_start?: string;
  fri_end?: string;
  sat_available?: boolean;
  sat_start?: string;
  sat_end?: string;
  sun_available?: boolean;
  sun_start?: string;
  sun_end?: string;
  service_areas?: string; // pipe or comma-separated: "SW1|E1|N1" or "SW1, E1, N1"
  max_travel_minutes?: number;
  is_subcontractor?: boolean;
  ignore_working_hours?: boolean;
  max_installs_per_day?: number;
}

interface ImportRequest {
  rows: EngineerRow[];
  create_missing_users?: boolean;
  update_existing_roles?: boolean;
}

interface ImportResult {
  success: boolean;
  summary: {
    processed: number;
    created_users: number;
    created_engineers: number;
    updated_engineers: number;
    role_updates: number;
    availability_upserts: number;
    service_area_upserts: number;
    errors: Array<{ row: number; error: string; email?: string }>;
  };
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
    console.log('Processing engineer import request with JWT validation');

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(JSON.stringify({ 
        error: 'Authorization required',
        message: 'Please log in to import engineers' 
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
        message: 'Admin access required for engineer import' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Admin user validated:', user.email);

    const body: ImportRequest = await req.json();
    const { rows, create_missing_users = false, update_existing_roles = false } = body;

    if (!rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'Invalid request: rows must be an array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: ImportResult = {
      success: true,
      summary: {
        processed: 0,
        created_users: 0,
        created_engineers: 0,
        updated_engineers: 0,
        role_updates: 0,
        availability_upserts: 0,
        service_area_upserts: 0,
        errors: []
      }
    };

    console.log(`Processing ${rows.length} engineer rows with options:`, { 
      create_missing_users, 
      update_existing_roles 
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        result.summary.processed++;

        if (!row.email?.trim()) {
          result.summary.errors.push({ row: rowNumber, error: 'Email is required' });
          continue;
        }

        const email = row.email.trim().toLowerCase();
        console.log(`Processing engineer: ${email}`);

        // Look up existing profile by email (case-insensitive)
        let profile = null;
        const { data: existingProfiles, error: profileLookupError } = await supabaseAdmin
          .from('profiles')
          .select('user_id, full_name, email, role, status')
          .ilike('email', email) // Use case-insensitive search
          .limit(1);

        if (profileLookupError) {
          console.error('Error looking up profile:', profileLookupError);
          result.summary.errors.push({ 
            row: rowNumber, 
            error: 'Database error looking up profile',
            email 
          });
          continue;
        }

        profile = existingProfiles?.[0] || null;

        console.log(`Profile lookup for ${email}:`, profile ? `Found existing profile with role: ${profile.role}` : 'No profile found');

        // If profile exists but create_missing_users was enabled, we might have created a duplicate user
        // Handle cleanup if needed
        if (profile && create_missing_users) {
          console.log(`Profile already exists for ${email}, will use existing profile and skip user creation`);
        }

        // Create user if needed and requested
        if (!profile && create_missing_users) {
          console.log(`Creating new user for ${email}...`);
          try {
            const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
              email: email,
              email_confirm: true,
              user_metadata: {
                full_name: row.full_name || email.split('@')[0]
              }
            });

            if (createUserError) {
              console.error('Error creating user:', createUserError);
              result.summary.errors.push({ 
                row: rowNumber, 
                error: `Failed to create user: ${createUserError.message}`,
                email 
              });
              continue;
            }

            result.summary.created_users++;
            console.log(`Successfully created user for: ${email}`);

            // Try to create profile with engineer role
            const { error: profileInsertError } = await supabaseAdmin
              .from('profiles')
              .insert({
                user_id: newUser.user!.id,
                email: email,
                full_name: row.full_name || email.split('@')[0],
                role: 'engineer' as any,
                status: 'active'
              });

            if (profileInsertError) {
              console.error('Error creating profile:', profileInsertError);
              
              // Check if it's a duplicate email error
              if (profileInsertError.message?.includes('duplicate') || profileInsertError.code === '23505') {
                // Try to find the existing profile and delete the orphaned user
                const { data: existingProfile } = await supabaseAdmin
                  .from('profiles')
                  .select('user_id, email, role')
                  .ilike('email', email)
                  .single();
                
                if (existingProfile) {
                  // Delete the newly created user since profile exists
                  await supabaseAdmin.auth.admin.deleteUser(newUser.user!.id);
                  console.log(`Deleted orphaned user for ${email}, using existing profile`);
                  
                  profile = existingProfile;
                  result.summary.created_users--; // Adjust count
                } else {
                  result.summary.errors.push({ 
                    row: rowNumber, 
                    error: 'Failed to create profile - email already exists',
                    email 
                  });
                  continue;
                }
              } else {
                result.summary.errors.push({ 
                  row: rowNumber, 
                  error: `Failed to create profile: ${profileInsertError.message}`,
                  email 
                });
                continue;
              }
            }

            profile = {
              user_id: newUser.user!.id,
              email: email,
              full_name: row.full_name || email.split('@')[0],
              role: 'engineer',
              status: 'active'
            };

            console.log(`Created user and profile for: ${email}`);
          } catch (userCreationError) {
            console.error('User creation failed:', userCreationError);
            result.summary.errors.push({ 
              row: rowNumber, 
              error: 'User creation failed',
              email 
            });
            continue;
          }
        } else if (!profile) {
          console.log(`Skipping user creation for ${email} - create_missing_users is false`);
        } else {
          console.log(`User already exists for ${email}, checking role update`);
          
          // Update existing profile role if requested and role is not already engineer
          if (update_existing_roles && profile.role !== 'engineer') {
            console.log(`Updating role for ${email} from ${profile.role} to engineer`);
            const { error: roleUpdateError } = await supabaseAdmin
              .from('profiles')
              .update({ role: 'engineer' })
              .eq('user_id', profile.user_id);

            if (roleUpdateError) {
              console.error('Error updating role:', roleUpdateError);
              result.summary.errors.push({ 
                row: rowNumber, 
                error: 'Failed to update user role',
                email 
              });
              continue;
            }

            result.summary.role_updates++;
            profile.role = 'engineer'; // Update local copy
            console.log(`Updated role for ${email} to engineer`);
          }
        }

        // Get or create engineer record
        const { data: existingEngineers, error: engineerLookupError } = await supabaseAdmin
          .from('engineers')
          .select('id, user_id')
          .eq('email', email)
          .limit(1);

        if (engineerLookupError) {
          console.error('Error looking up engineer:', engineerLookupError);
          result.summary.errors.push({ 
            row: rowNumber, 
            error: 'Database error looking up engineer',
            email 
          });
          continue;
        }

        let engineer = existingEngineers?.[0] || null;

        if (engineer) {
          // Update existing engineer
          const { error: updateError } = await supabaseAdmin
            .from('engineers')
            .update({
              name: row.full_name || email.split('@')[0],
              email: email,
              region: row.region?.trim() || null,
              availability: row.availability ?? true,
              starting_postcode: row.starting_postcode?.trim() || null,
              user_id: profile?.user_id || engineer.user_id,
              is_subcontractor: row.is_subcontractor ?? false,
              ignore_working_hours: row.ignore_working_hours ?? false,
              max_installs_per_day: row.max_installs_per_day ?? 2
            })
            .eq('id', engineer.id);

          if (updateError) {
            console.error('Error updating engineer:', updateError);
            result.summary.errors.push({ 
              row: rowNumber, 
              error: 'Failed to update engineer',
              email 
            });
            continue;
          }

          result.summary.updated_engineers++;
          console.log(`Updated engineer: ${email}`);
        } else {
          // Create new engineer
          const { data: newEngineer, error: createError } = await supabaseAdmin
            .from('engineers')
            .insert({
              name: row.full_name || email.split('@')[0],
              email: email,
              region: row.region?.trim() || null,
              availability: row.availability ?? true,
              starting_postcode: row.starting_postcode?.trim() || null,
              user_id: profile?.user_id || null,
              is_subcontractor: row.is_subcontractor ?? false,
              ignore_working_hours: row.ignore_working_hours ?? false,
              max_installs_per_day: row.max_installs_per_day ?? 2
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating engineer:', createError);
            result.summary.errors.push({ 
              row: rowNumber, 
              error: 'Failed to create engineer',
              email 
            });
            continue;
          }

          engineer = newEngineer;
          result.summary.created_engineers++;
          console.log(`Created engineer: ${email}`);
        }

        // Process working hours (Mon=1, Tue=2, ..., Sun=0)
        const days = [
          { key: 'sun', dow: 0 },
          { key: 'mon', dow: 1 },
          { key: 'tue', dow: 2 },
          { key: 'wed', dow: 3 },
          { key: 'thu', dow: 4 },
          { key: 'fri', dow: 5 },
          { key: 'sat', dow: 6 }
        ];

        for (const day of days) {
          const availableKey = `${day.key}_available` as keyof EngineerRow;
          const startKey = `${day.key}_start` as keyof EngineerRow;
          const endKey = `${day.key}_end` as keyof EngineerRow;

          const isAvailable = row[availableKey] ?? false;
          const startTime = row[startKey] as string;
          const endTime = row[endKey] as string;

          if (isAvailable && startTime && endTime) {
            // Validate time format (HH:MM)
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
              result.summary.errors.push({ 
                row: rowNumber, 
                error: `Invalid time format for ${day.key} (use HH:MM)`,
                email 
              });
              continue;
            }

            // Upsert availability
            const { error: availabilityError } = await supabaseAdmin
              .from('engineer_availability')
              .upsert({
                engineer_id: engineer.id,
                day_of_week: day.dow,
                is_available: true,
                start_time: startTime,
                end_time: endTime
              }, {
                onConflict: 'engineer_id,day_of_week'
              });

            if (availabilityError) {
              console.error(`Error upserting availability for ${day.key}:`, availabilityError);
              result.summary.errors.push({ 
                row: rowNumber, 
                error: `Failed to update ${day.key} availability`,
                email 
              });
            } else {
              result.summary.availability_upserts++;
            }
          } else if (!isAvailable) {
            // Mark as unavailable
            const { error: availabilityError } = await supabaseAdmin
              .from('engineer_availability')
              .upsert({
                engineer_id: engineer.id,
                day_of_week: day.dow,
                is_available: false,
                start_time: '09:00',
                end_time: '17:00'
              }, {
                onConflict: 'engineer_id,day_of_week'
              });

            if (availabilityError) {
              console.error(`Error marking ${day.key} unavailable:`, availabilityError);
            } else {
              result.summary.availability_upserts++;
            }
          }
        }

        // Process service areas - handle both explicit areas and fallback
        let serviceAreasProcessed = false;
        
        // First, try to process explicit service_areas column
        if (row.service_areas?.trim()) {
          // Handle both pipe-separated and comma-separated values
          const separator = row.service_areas.includes('|') ? '|' : ',';
          const areas = row.service_areas.split(separator)
            .map(area => area.trim().toUpperCase())
            .filter(area => area.length > 0);

          console.log(`Processing explicit service areas for ${email}:`, areas);

          for (const area of areas) {
            const { error: serviceAreaError } = await supabaseAdmin
              .from('engineer_service_areas')
              .upsert({
                engineer_id: engineer.id,
                postcode_area: area,
                max_travel_minutes: row.max_travel_minutes || 60,
                unbounded: true // Explicit service areas are unbounded
              }, {
                onConflict: 'engineer_id,postcode_area'
              });

            if (serviceAreaError) {
              console.error(`Error upserting service area ${area}:`, serviceAreaError);
              result.summary.errors.push({ 
                row: rowNumber, 
                error: `Failed to update service area: ${area}`,
                email 
              });
            } else {
              result.summary.service_area_upserts++;
              serviceAreasProcessed = true;
            }
          }
        }
        
        // If no explicit service areas were processed, create fallback from starting postcode
        if (!serviceAreasProcessed && row.max_travel_minutes && row.starting_postcode?.trim()) {
          const startingPostcode = row.starting_postcode.trim().toUpperCase();
          // Extract postcode area (e.g., "DA5 1BJ" -> "DA")  
          const postcodeArea = startingPostcode.replace(/\d.*$/, '').replace(/\s.*$/, '');
          
          console.log(`Creating fallback service area ${postcodeArea} for engineer ${email} with ${row.max_travel_minutes} min travel`);
          
          const { error: serviceAreaError } = await supabaseAdmin
            .from('engineer_service_areas')
            .upsert({
              engineer_id: engineer.id,
              postcode_area: postcodeArea,
              max_travel_minutes: row.max_travel_minutes
            }, {
              onConflict: 'engineer_id,postcode_area'
            });

          if (serviceAreaError) {
            console.error(`Error creating fallback service area ${postcodeArea}:`, serviceAreaError);
            result.summary.errors.push({ 
              row: rowNumber, 
              error: `Failed to create fallback service area: ${postcodeArea}`,
              email 
            });
          } else {
            result.summary.service_area_upserts++;
            console.log(`Created fallback service area ${postcodeArea} for engineer ${email}`);
          }
        }

      } catch (rowError) {
        console.error(`Error processing row ${rowNumber}:`, rowError);
        result.summary.errors.push({ 
          row: rowNumber, 
          error: 'Unexpected error processing row',
          email: row.email 
        });
      }
    }

    console.log('Import completed:', result.summary);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import failed:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Import failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
