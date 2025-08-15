import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const MAPBOX_ACCESS_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')

interface DistanceRequest {
  origins: string[]
  destinations: string[]
}

interface DistanceResponse {
  distances: number[][]
  durations: number[][]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== MAPBOX FUNCTION CALLED ===');
    console.log('MAPBOX_ACCESS_TOKEN configured:', !!MAPBOX_ACCESS_TOKEN);
    console.log('Token length:', MAPBOX_ACCESS_TOKEN?.length || 0);
    
    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('MAPBOX_ACCESS_TOKEN not configured')
      return new Response(
        JSON.stringify({ error: 'MAPBOX_ACCESS_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { origins, destinations }: DistanceRequest = body
    
    console.log('=== Mapbox Distance API Called ===')
    console.log('Raw request body:', JSON.stringify(body))
    console.log('Parsed origins:', origins)
    console.log('Parsed destinations:', destinations)
    console.log('Origins type:', typeof origins, 'Array?', Array.isArray(origins))
    console.log('Destinations type:', typeof destinations, 'Array?', Array.isArray(destinations))
    
    if (!origins || !destinations) {
      console.error('Missing origins or destinations:', { origins, destinations })
      throw new Error('Origins and destinations are required')
    }
    
    if (!Array.isArray(origins) || !Array.isArray(destinations)) {
      console.error('Origins or destinations not arrays:', { origins, destinations })
      throw new Error('Origins and destinations must be arrays')
    }
    
    if (origins.length === 0 || destinations.length === 0) {
      console.error('Empty arrays provided:', { originsLength: origins.length, destinationsLength: destinations.length })
      throw new Error('Origins and destinations arrays cannot be empty')
    }

    // Convert postcodes to coordinates using Mapbox Geocoding API
    const coordinatesCache = new Map<string, [number, number]>()
    
    const getCoordinates = async (postcode: string): Promise<[number, number]> => {
      const cleanPostcode = postcode.trim().toUpperCase()
      console.log(`Geocoding postcode: ${cleanPostcode}`)
      
      if (coordinatesCache.has(cleanPostcode)) {
        const cached = coordinatesCache.get(cleanPostcode)!
        console.log(`Using cached coordinates for ${cleanPostcode}:`, cached)
        return cached
      }
      
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanPostcode)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=GB&types=postcode`
      console.log(`Geocoding URL: ${geocodeUrl}`)
      
      // Test the actual fetch call with detailed logging
      console.log('About to make fetch request...')
      const response = await fetch(geocodeUrl)
      console.log('Fetch completed, response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      const data = await response.json()
      console.log(`Geocoding response data:`, data)
      
      if (!response.ok) {
        console.error(`Geocoding API error details:`, {
          postcode: cleanPostcode,
          status: response.status,
          statusText: response.statusText,
          responseData: data
        })
        throw new Error(`Geocoding API error for ${cleanPostcode}: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`)
      }
      
      if (!data.features?.length) {
        throw new Error(`Could not geocode postcode: ${cleanPostcode}`)
      }
      
      const [lng, lat] = data.features[0].center
      const coordinates: [number, number] = [lng, lat]
      coordinatesCache.set(cleanPostcode, coordinates)
      console.log(`Geocoded ${cleanPostcode} to coordinates:`, coordinates)
      
      return coordinates
    }

    // Get coordinates for all unique postcodes
    const allPostcodes = [...new Set([...origins, ...destinations])]
    console.log(`Getting coordinates for postcodes:`, allPostcodes)
    
    // Geocode all postcodes
    for (const postcode of allPostcodes) {
      await getCoordinates(postcode)
    }

    // Prepare coordinates
    const originCoords = origins.map(postcode => {
      const cleanPostcode = postcode.trim().toUpperCase()
      const coords = coordinatesCache.get(cleanPostcode)
      if (!coords) throw new Error(`No coordinates found for origin: ${cleanPostcode}`)
      return coords
    })
    
    const destinationCoords = destinations.map(postcode => {
      const cleanPostcode = postcode.trim().toUpperCase()
      const coords = coordinatesCache.get(cleanPostcode)
      if (!coords) throw new Error(`No coordinates found for destination: ${cleanPostcode}`)
      return coords
    })
    
    console.log('=== API Setup ===')
    console.log('Origin coordinates:', originCoords)
    console.log('Destination coordinates:', destinationCoords)
    
    // Check if we have a single source-destination pair (use Directions API)
    // or multiple points (use Matrix API)
    if (origins.length === 1 && destinations.length === 1) {
      console.log('=== Using Directions API (single route) ===')
      
      const startCoord = originCoords[0]
      const endCoord = destinationCoords[0]
      const coordinatesParam = `${startCoord.join(',')};${endCoord.join(',')}`
      
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesParam}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson`
      
      console.log('Directions URL:', directionsUrl)
      console.log('Start coordinates:', startCoord)
      console.log('End coordinates:', endCoord)
      
      const directionsResponse = await fetch(directionsUrl)
      const directionsData = await directionsResponse.json()
      
      console.log('=== Directions API Response ===')
      console.log('Status:', directionsResponse.status)
      console.log('Response data:', JSON.stringify(directionsData, null, 2))
      
      if (!directionsResponse.ok) {
        console.error('Directions API error details:', directionsData)
        throw new Error(`Mapbox Directions API error: ${directionsResponse.status} - ${directionsData.message || directionsData.error || 'Unknown error'}`)
      }
      
      if (!directionsData.routes || directionsData.routes.length === 0) {
        console.error('No routes found in Directions API response:', directionsData)
        throw new Error('No routes found between the specified points')
      }
      
      const route = directionsData.routes[0]
      const distanceMeters = route.distance
      const durationSeconds = route.duration
      
      // Convert to miles and minutes
      const distanceMiles = Math.round((distanceMeters / 1609.34) * 10) / 10
      const durationMinutes = Math.round(durationSeconds / 60)
      
      console.log('Route details:', {
        distanceMeters,
        durationSeconds,
        distanceMiles,
        durationMinutes
      })
      
      // Return in matrix format for consistency
      const distances = [[distanceMiles]]
      const durations = [[durationMinutes]]
      
      const result: DistanceResponse = {
        distances,
        durations
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
      
    } else {
      console.log('=== Using Matrix API (multiple points) ===')
      
      // Format coordinates for Mapbox Matrix API
      const allCoords = [...originCoords, ...destinationCoords]
      const coordinatesParam = allCoords.map(coord => coord.join(',')).join(';')
      
      // Specify which points are sources (origins) and destinations
      const sources = originCoords.map((_, index) => index).join(';')
      const destinationsParam = destinationCoords.map((_, index) => index + originCoords.length).join(';')
      
      // Call Mapbox Matrix API
      const matrixUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinatesParam}?sources=${sources}&destinations=${destinationsParam}&access_token=${MAPBOX_ACCESS_TOKEN}`
      
      console.log('=== Matrix API Call ===')
      console.log('Matrix URL:', matrixUrl)
      console.log('Coordinates param:', coordinatesParam)
      console.log('Sources:', sources)
      console.log('Destinations param:', destinationsParam)
      
      const matrixResponse = await fetch(matrixUrl)
      const matrixData = await matrixResponse.json()
      
      console.log('=== Matrix API Response ===')
      console.log('Status:', matrixResponse.status)
      console.log('Response data:', JSON.stringify(matrixData, null, 2))
      
      if (!matrixResponse.ok) {
        console.error('Matrix API error details:', matrixData)
        throw new Error(`Mapbox Matrix API error: ${matrixResponse.status} - ${matrixData.message || matrixData.error || 'Unknown error'}`)
      }
      
      if (!matrixData.distances || !matrixData.durations) {
        console.error('Invalid Matrix API response structure:', matrixData)
        throw new Error('Invalid response from Mapbox Matrix API: missing distances or durations')
      }

      // Convert distances from meters to miles and durations from seconds to minutes
      const distances = matrixData.distances.map((row: number[]) => 
        row.map((distance: number) => Math.round((distance / 1609.34) * 10) / 10) // meters to miles, rounded to 1 decimal
      )
      
      const durations = matrixData.durations.map((row: number[]) => 
        row.map((duration: number) => Math.round(duration / 60)) // seconds to minutes
      )

      const result: DistanceResponse = {
        distances,
        durations
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('=== MAPBOX FUNCTION ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.constructor.name,
        details: 'Check function logs for more details'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})