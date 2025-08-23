import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AddressResult {
  address: string;
  full_address: string;
  postcode: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: 'Mapbox access token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const postcode = url.searchParams.get('postcode')
    const houseNumber = url.searchParams.get('house_number')

    if (!postcode) {
      return new Response(
        JSON.stringify({ error: 'Postcode parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Looking up postcode:', postcode, 'with house number:', houseNumber)

    // Normalize postcode (remove spaces, uppercase)
    const normalizedPostcode = postcode.replace(/\s/g, '').toUpperCase()
    
    // Build search query
    const searchQuery = houseNumber 
      ? `${houseNumber} ${normalizedPostcode}` 
      : normalizedPostcode

    // Use Mapbox Geocoding API to find addresses for the postcode
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
      `access_token=${mapboxToken}&` +
      'country=GB&' +
      'types=address&' +
      'limit=10'

    console.log('Mapbox request URL:', mapboxUrl)

    const response = await fetch(mapboxUrl)
    
    if (!response.ok) {
      console.error('Mapbox API error:', response.status, await response.text())
      return new Response(
        JSON.stringify({ error: 'Failed to lookup addresses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    console.log('Mapbox response:', JSON.stringify(data, null, 2))

    const addresses: AddressResult[] = data.features?.map((feature: any) => {
      const placeName = feature.place_name || ''
      const context = feature.context || []
      
      // Extract postcode from context
      const postcodeContext = context.find((c: any) => c.id?.startsWith('postcode'))
      const extractedPostcode = postcodeContext?.text || normalizedPostcode
      
      // Clean up the address - remove country and sometimes region
      let cleanAddress = placeName
        .replace(/, United Kingdom$/, '')
        .replace(/, UK$/, '')
      
      // If we have a specific house number search, use the place_name as is
      // Otherwise, try to extract just the street/area info
      if (!houseNumber && feature.properties?.address) {
        cleanAddress = `${feature.properties.address}, ${cleanAddress.split(',').slice(-2, -1).join(',').trim()}`
      }

      return {
        address: cleanAddress,
        full_address: placeName,
        postcode: extractedPostcode
      }
    }) || []

    // Filter out duplicates based on address
    const uniqueAddresses = addresses.filter((addr, index, self) => 
      index === self.findIndex(a => a.address === addr.address)
    )

    console.log('Found', uniqueAddresses.length, 'unique addresses')

    return new Response(
      JSON.stringify({
        success: true,
        postcode: normalizedPostcode,
        addresses: uniqueAddresses
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
