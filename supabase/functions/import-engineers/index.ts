import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
  service_areas?: string; // pipe-separated: "SW1|E1|N1"
  max_travel_minutes?: number;
}

interface ImportRequest {
  rows: EngineerRow[];
  create_missing_users?: boolean;
}

interface ImportResult {
  success: boolean;
  summary: {
    processed: number;
    created_users: number;
    created_engineers: number;
    updated_engineers: number;
    availability_upserts: number;
    service_area_upserts: number;
    errors: Array<{ row: number; error: string; email?: string }>;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Processing engineer import request');

    // Check authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ImportRequest = await req.json();
    const { rows, create_missing_users = false } = body;

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
        availability_upserts: 0,
        service_area_upserts: 0,
        errors: []
      }
    };

    console.log(`Processing ${rows.length} engineer rows`);

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

        // Look up existing profile by email
        let profile = null;
        const { data: existingProfiles, error: profileLookupError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, role, status')
          .eq('email', email)
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

        // Create user if needed and requested
        if (!profile && create_missing_users) {
          try {
            const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
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

            // Create profile
            const { error: profileInsertError } = await supabase
              .from('profiles')
              .insert({
                user_id: newUser.user!.id,
                email: email,
                full_name: row.full_name || email.split('@')[0],
                role: 'engineer',
                status: 'active'
              });

            if (profileInsertError) {
              console.error('Error creating profile:', profileInsertError);
              result.summary.errors.push({ 
                row: rowNumber, 
                error: 'Failed to create profile',
                email 
              });
              continue;
            }

            profile = {
              user_id: newUser.user!.id,
              email: email,
              full_name: row.full_name || email.split('@')[0],
              role: 'engineer',
              status: 'active'
            };

            result.summary.created_users++;
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
        }

        // Get or create engineer record
        const { data: existingEngineers, error: engineerLookupError } = await supabase
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
          const { error: updateError } = await supabase
            .from('engineers')
            .update({
              name: row.full_name || email.split('@')[0],
              email: email,
              region: row.region?.trim() || null,
              availability: row.availability ?? true,
              starting_postcode: row.starting_postcode?.trim() || null,
              user_id: profile?.user_id || engineer.user_id
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
          const { data: newEngineer, error: createError } = await supabase
            .from('engineers')
            .insert({
              name: row.full_name || email.split('@')[0],
              email: email,
              region: row.region?.trim() || null,
              availability: row.availability ?? true,
              starting_postcode: row.starting_postcode?.trim() || null,
              user_id: profile?.user_id || null
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
            const { error: availabilityError } = await supabase
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
            const { error: availabilityError } = await supabase
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

        // Process service areas
        if (row.service_areas?.trim()) {
          const areas = row.service_areas.split('|')
            .map(area => area.trim().toUpperCase())
            .filter(area => area.length > 0);

          for (const area of areas) {
            const { error: serviceAreaError } = await supabase
              .from('engineer_service_areas')
              .upsert({
                engineer_id: engineer.id,
                postcode_area: area,
                max_travel_minutes: row.max_travel_minutes || 60
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
            }
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