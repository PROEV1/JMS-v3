import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const MAPBOX_ACCESS_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')

// In-function caching and rate limiting
const geocodeCache = new Map<string, [number, number]>()
const rateLimitedRequests = new Map<string, number>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100

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

    // Rate limiting check
    const now = Date.now()
    const requestsInWindow = rateLimitedRequests.get('global') || 0
    if (requestsInWindow >= MAX_REQUESTS_PER_WINDOW) {
      console.warn('⚠️ Rate limit reached, implementing backoff')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    rateLimitedRequests.set('global', requestsInWindow + 1)

    // Convert postcodes to coordinates using Mapbox Geocoding API with enhanced caching
    const coordinatesCache = new Map<string, [number, number]>()
    
    const getCoordinates = async (postcode: string, retryCount = 0): Promise<[number, number]> => {
      const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase().trim() // Consistent normalization
      console.log(`Geocoding postcode: ${cleanPostcode}`)
      
      // Check persistent cache first
      if (geocodeCache.has(cleanPostcode)) {
        const cached = geocodeCache.get(cleanPostcode)!
        console.log(`Using persistent cache for ${cleanPostcode}:`, cached)
        coordinatesCache.set(cleanPostcode, cached)
        return cached
      }
      
      if (coordinatesCache.has(cleanPostcode)) {
        const cached = coordinatesCache.get(cleanPostcode)!
        console.log(`Using local cache for ${cleanPostcode}:`, cached)
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
        // Handle 429 rate limiting with exponential backoff
        if (response.status === 429 && retryCount < 3) {
          const backoffMs = Math.pow(2, retryCount) * 1000 + Math.random() * 1000
          console.warn(`Rate limited (429), retrying in ${backoffMs}ms (attempt ${retryCount + 1})`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          return getCoordinates(postcode, retryCount + 1)
        }
        
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
      geocodeCache.set(cleanPostcode, coordinates) // Store in persistent cache
      console.log(`Geocoded ${cleanPostcode} to coordinates:`, coordinates)
      
      return coordinates
    }

    // Get coordinates for all unique postcodes with consistent normalization
    const normalizePostcode = (pc: string) => pc.replace(/\s+/g, '').toUpperCase().trim();
    const normalizedOrigins = origins.map(normalizePostcode);
    const normalizedDestinations = destinations.map(normalizePostcode);
    const allPostcodes = [...new Set([...normalizedOrigins, ...normalizedDestinations])];
    console.log(`Getting coordinates for postcodes:`, allPostcodes);
    
    // Geocode all postcodes
    for (const postcode of allPostcodes) {
      await getCoordinates(postcode)
    }

    // Prepare coordinates using normalized postcodes
    const originCoords = normalizedOrigins.map(postcode => {
      const coords = coordinatesCache.get(postcode)
      if (!coords) throw new Error(`No coordinates found for origin: ${postcode}`)
      return coords
    })
    
    const destinationCoords = normalizedDestinations.map(postcode => {
      const coords = coordinatesCache.get(postcode)
      if (!coords) throw new Error(`No coordinates found for destination: ${postcode}`)
      return coords
    })
    
    console.log('=== API Setup ===')
    console.log('Origin coordinates:', originCoords)
    console.log('Destination coordinates:', destinationCoords)
    
    // Check if we have a single source-destination pair (use Directions API)
    // or multiple points (use Matrix API)
    if (normalizedOrigins.length === 1 && normalizedDestinations.length === 1) {
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
      
      // Implement exponential backoff for Matrix API as well
      let matrixResponse, matrixData
      let retryCount = 0
      const maxRetries = 3
      
      while (retryCount <= maxRetries) {
        try {
          matrixResponse = await fetch(matrixUrl)
          matrixData = await matrixResponse.json()
          
          console.log('=== Matrix API Response ===')
          console.log('Status:', matrixResponse.status)
          console.log('Response data:', JSON.stringify(matrixData, null, 2))
          
          if (matrixResponse.status === 429 && retryCount < maxRetries) {
            const backoffMs = Math.pow(2, retryCount) * 1000 + Math.random() * 1000
            console.warn(`Matrix API rate limited, retrying in ${backoffMs}ms (attempt ${retryCount + 1})`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            retryCount++
            continue
          }
          
          if (!matrixResponse.ok) {
            console.error('Matrix API error details:', matrixData)
            throw new Error(`Mapbox Matrix API error: ${matrixResponse.status} - ${matrixData.message || matrixData.error || 'Unknown error'}`)
          }
          
          break // Success, exit retry loop
        } catch (error) {
          if (retryCount === maxRetries) throw error
          retryCount++
        }
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