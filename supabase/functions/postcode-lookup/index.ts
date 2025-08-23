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

    // Normalize postcode (remove extra spaces, uppercase, then format properly)
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase()
    
    // Format UK postcode properly (e.g., MK179JU -> MK17 9JU)
    const formattedPostcode = cleanPostcode.replace(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/, '$1 $2')
    
    console.log('Formatted postcode:', formattedPostcode)

    // For UK postcodes, search differently based on whether we have a house number
    let mapboxUrl: string;
    
    if (houseNumber) {
      // Search for specific address with house number
      const searchQuery = `${houseNumber} ${formattedPostcode}`
      mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
        `access_token=${mapboxToken}&` +
        'country=GB&' +
        'types=address&' +
        'limit=10'
    } else {
      // Search just the postcode to get area results
      mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(formattedPostcode)}.json?` +
        `access_token=${mapboxToken}&` +
        'country=GB&' +
        'types=postcode,address&' +
        'limit=10'
    }

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
      
      // Extract postcode from context or use formatted one
      const postcodeContext = context.find((c: any) => c.id?.startsWith('postcode'))
      const extractedPostcode = postcodeContext?.text || formattedPostcode
      
      // Clean up the address - remove country 
      let cleanAddress = placeName
        .replace(/, United Kingdom$/, '')
        .replace(/, UK$/, '')
        .trim()
      
      // For postcode-only searches, create readable address options
      if (!houseNumber && feature.place_type?.includes('postcode')) {
        // This is a postcode result, create generic street options
        const addressParts = cleanAddress.split(', ')
        if (addressParts.length >= 2) {
          cleanAddress = `${addressParts[0]}, ${addressParts[1]}`
        }
      }
      
      // If it's an address result, use it directly
      if (feature.place_type?.includes('address')) {
        cleanAddress = cleanAddress.split(',').slice(0, 2).join(',').trim()
      }

      return {
        address: cleanAddress,
        full_address: placeName,
        postcode: extractedPostcode
      }
    }) || []

    // If no results and no house number specified, try to provide generic options
    if (addresses.length === 0 && !houseNumber) {
      // Create some generic street suggestions for the postcode area
      const postcodeArea = formattedPostcode.split(' ')[0] // e.g., "MK17"
      addresses.push({
        address: `${formattedPostcode} Area`,
        full_address: `${formattedPostcode} Area, United Kingdom`,
        postcode: formattedPostcode
      })
    }

    // Filter out duplicates based on address
    const uniqueAddresses = addresses.filter((addr, index, self) => 
      index === self.findIndex(a => a.address === addr.address)
    )

    console.log('Found', uniqueAddresses.length, 'unique addresses')

    return new Response(
      JSON.stringify({
        success: true,
        postcode: formattedPostcode,
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
