import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  success: boolean;
  normalizedCount: number;
  createdCount: number;
  errors: string[];
}

// Helper function to extract outward code from postcode
function getOutwardCode(postcode: string): string {
  const normalized = postcode.replace(/[^A-Z0-9]/g, '').toUpperCase();
  const match = normalized.match(/^([A-Z]{1,2}\d{1,2})[A-Z]?/);
  return match ? match[1] : normalized;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Create supabase clients
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  try {
    // Validate JWT token and check admin role
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result: SyncResult = {
      success: true,
      normalizedCount: 0,
      createdCount: 0,
      errors: []
    }

    console.log('Starting engineer service area sync...')

    // STEP 1: Normalize existing service areas to outward codes
    const { data: existingAreas, error: fetchError } = await supabaseAdmin
      .from('engineer_service_areas')
      .select('id, postcode_area, unbounded')

    if (fetchError) {
      result.errors.push(`Failed to fetch existing areas: ${fetchError.message}`)
      result.success = false
    } else {
      // Update postcodes to outward codes
      for (const area of existingAreas || []) {
        const outwardCode = getOutwardCode(area.postcode_area)
        if (outwardCode !== area.postcode_area) {
          const { error: updateError } = await supabaseAdmin
            .from('engineer_service_areas')
            .update({ postcode_area: outwardCode })
            .eq('id', area.id)

          if (updateError) {
            result.errors.push(`Failed to update area ${area.id}: ${updateError.message}`)
          } else {
            result.normalizedCount++
            console.log(`Normalized ${area.postcode_area} -> ${outwardCode}`)
          }
        }
      }
    }

    // STEP 2: Create service areas for engineers with starting_postcode but no service areas
    const { data: engineers, error: engineersError } = await supabaseAdmin
      .from('engineers')
      .select(`
        id,
        starting_postcode,
        engineer_service_areas!inner(id)
      `)
      .not('starting_postcode', 'is', null)

    if (engineersError) {
      result.errors.push(`Failed to fetch engineers: ${engineersError.message}`)
      result.success = false
    } else {
      // Find engineers without service areas
      const { data: engineersWithoutAreas, error: noAreasError } = await supabaseAdmin
        .from('engineers')
        .select('id, starting_postcode')
        .not('starting_postcode', 'is', null)
        .not('id', 'in', `(${(engineers || []).map(e => `'${e.id}'`).join(',') || "''"})`)

      if (noAreasError) {
        result.errors.push(`Failed to find engineers without areas: ${noAreasError.message}`)
      } else {
        // Create service areas for these engineers
        for (const engineer of engineersWithoutAreas || []) {
          const outwardCode = getOutwardCode(engineer.starting_postcode)
          
          const { error: insertError } = await supabaseAdmin
            .from('engineer_service_areas')
            .insert({
              engineer_id: engineer.id,
              postcode_area: outwardCode,
              max_travel_minutes: 80,
              unbounded: false // Default fallback areas are bounded
            })

          if (insertError) {
            result.errors.push(`Failed to create area for engineer ${engineer.id}: ${insertError.message}`)
          } else {
            result.createdCount++
            console.log(`Created service area ${outwardCode} for engineer ${engineer.id}`)
          }
        }
      }
    }

    console.log('Sync complete:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        normalizedCount: 0,
        createdCount: 0,
        errors: [error.message]
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})