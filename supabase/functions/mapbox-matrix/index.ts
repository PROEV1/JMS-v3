import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MatrixRequest {
  sources: string[]
  destinations?: string[]
  sessionId?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { sources, destinations, sessionId }: MatrixRequest = await req.json()
    
    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Sources array is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Use sources as destinations if not provided (square matrix)
    const finalDestinations = destinations || sources
    
    console.log(`Matrix API request: ${sources.length} sources × ${finalDestinations.length} destinations`)

    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: 'Mapbox access token not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Geocode all unique locations first
    const allLocations = [...new Set([...sources, ...finalDestinations])]
    const coordinates = new Map<string, [number, number]>()
    
    for (const location of allLocations) {
      try {
        // Try cache first
        const { data: cachedData } = await supabaseClient
          .from('geocode_cache')
          .select('longitude, latitude')
          .eq('postcode', location.toUpperCase().replace(/\s/g, ''))
          .gt('expires_at', new Date().toISOString())
          .single()

        if (cachedData) {
          coordinates.set(location, [cachedData.longitude, cachedData.latitude])
          console.log(`Cache hit for ${location}`)
          continue
        }

        // Geocode if not in cache
        const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?country=GB&types=postcode&access_token=${mapboxToken}`
        
        const geocodeResponse = await fetch(geocodeUrl)
        const geocodeData = await geocodeResponse.json()

        if (geocodeData.features && geocodeData.features.length > 0) {
          const [lng, lat] = geocodeData.features[0].center
          coordinates.set(location, [lng, lat])

          // Cache the result
          await supabaseClient
            .from('geocode_cache')
            .upsert({
              postcode: location.toUpperCase().replace(/\s/g, ''),
              longitude: lng,
              latitude: lat,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })

          console.log(`Geocoded and cached ${location}`)
        } else {
          console.warn(`No geocode result for ${location}`)
          coordinates.set(location, [0, 0]) // Fallback coordinates
        }

        // Log geocoding API usage
        await supabaseClient
          .from('mapbox_usage_tracking')
          .insert({
            function_name: 'mapbox-matrix',
            api_type: 'geocoding',
            call_count: 1,
            session_id: sessionId,
            metadata: { location }
          })
      } catch (error) {
        console.error(`Error geocoding ${location}:`, error)
        coordinates.set(location, [0, 0]) // Fallback
      }
    }

    // Build coordinate strings for Matrix API
    const sourceCoords = sources.map(loc => {
      const [lng, lat] = coordinates.get(loc) || [0, 0]
      return `${lng},${lat}`
    }).join(';')

    const destCoords = finalDestinations.map(loc => {
      const [lng, lat] = coordinates.get(loc) || [0, 0]
      return `${lng},${lat}`
    }).join(';')

    // Call Mapbox Matrix API
    const matrixUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${sourceCoords};${destCoords}?sources=${sources.map((_, i) => i).join(';')}&destinations=${finalDestinations.map((_, i) => sources.length + i).join(';')}&access_token=${mapboxToken}`
    
    console.log('Calling Matrix API...')
    const matrixResponse = await fetch(matrixUrl)
    const matrixData = await matrixResponse.json()

    if (!matrixResponse.ok) {
      throw new Error(`Matrix API error: ${JSON.stringify(matrixData)}`)
    }

    // Log matrix API usage
    await supabaseClient
      .from('mapbox_usage_tracking')
      .insert({
        function_name: 'mapbox-matrix',
        api_type: 'matrix',
        call_count: 1,
        session_id: sessionId,
        metadata: { 
          sources_count: sources.length,
          destinations_count: finalDestinations.length
        }
      })

    // Convert durations from seconds to minutes and return as 2D array
    const durationMatrix = matrixData.durations?.map((row: number[]) => 
      row.map((duration: number) => Math.round(duration / 60))
    ) || []

    console.log(`Matrix API completed: ${durationMatrix.length}×${durationMatrix[0]?.length || 0} matrix`)

    return new Response(
      JSON.stringify({
        durations: durationMatrix,
        sources,
        destinations: finalDestinations,
        locations: allLocations
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Matrix API error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get travel matrix',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})