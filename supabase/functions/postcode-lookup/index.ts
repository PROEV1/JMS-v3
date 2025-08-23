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

// Extract addresses helper function
function extractAddresses(data: any, formattedPostcode: string, houseNumber: string | null): AddressResult[] {
  return data.features?.map((feature: any) => {
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
    
    // For postcode searches, provide more detailed address information
    if (!houseNumber && feature.place_type?.includes('postcode')) {
      // For postcode results, show the full postcode with area
      const addressParts = cleanAddress.split(', ')
      if (addressParts.length >= 3) {
        // Show postcode, area, and region
        cleanAddress = `${extractedPostcode} - ${addressParts[1]}, ${addressParts[2]}`
      } else if (addressParts.length >= 2) {
        cleanAddress = `${extractedPostcode} - ${addressParts[1]}`
      } else {
        cleanAddress = `${extractedPostcode} Area`
      }
    }
    
    // If it's an address result with house number, show full street address
    if (feature.place_type?.includes('address')) {
      const addressParts = cleanAddress.split(',')
      if (addressParts.length >= 3) {
        // Show street address with area
        cleanAddress = `${addressParts[0]}, ${addressParts[1]}`
      }
    }

    return {
      address: cleanAddress,
      full_address: placeName.replace(/, United Kingdom$/, '').replace(/, UK$/, ''),
      postcode: extractedPostcode
    }
  }) || []
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

    // Handle both GET (query params) and POST (JSON body) requests
    let postcode: string | null = null;
    let houseNumber: string | null = null;
    
    if (req.method === 'GET') {
      const url = new URL(req.url)
      postcode = url.searchParams.get('postcode')
      houseNumber = url.searchParams.get('house_number')
    } else if (req.method === 'POST') {
      const body = await req.json()
      postcode = body.postcode
      houseNumber = body.house_number
    }

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

    let addresses: AddressResult[] = [];
    
    // Strategy 1: If we have a house number, try searching with it
    if (houseNumber) {
      console.log('Trying search with house number...')
      const searchQuery = `${houseNumber} ${formattedPostcode}`
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
        `access_token=${mapboxToken}&` +
        'country=GB&' +
        'types=address&' +
        'limit=10'
      
      console.log('Mapbox request URL (with house):', mapboxUrl)
      
      try {
        const response1 = await fetch(mapboxUrl)
        if (response1.ok) {
          const data1 = await response1.json()
          console.log('Mapbox response (with house number):', JSON.stringify(data1, null, 2))
          addresses = extractAddresses(data1, formattedPostcode, houseNumber)
        }
      } catch (error) {
        console.log('House number search failed:', error)
      }
    }
    
    // Strategy 2: If no results or no house number, search just the postcode
    if (addresses.length === 0) {
      console.log('Trying postcode-only search...')
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(formattedPostcode)}.json?` +
        `access_token=${mapboxToken}&` +
        'country=GB&' +
        'types=postcode,place&' +
        'limit=10'
      
      console.log('Mapbox request URL (postcode only):', mapboxUrl)
      
      try {
        const response2 = await fetch(mapboxUrl)
        if (response2.ok) {
          const data2 = await response2.json()
          console.log('Mapbox response (postcode only):', JSON.stringify(data2, null, 2))
          const postcodeAddresses = extractAddresses(data2, formattedPostcode, null)
          addresses.push(...postcodeAddresses)
          
          // If we found postcode area, create generic address options
          if (postcodeAddresses.length > 0) {
            addresses.push({
              address: `${formattedPostcode} - Enter full address manually`,
              full_address: `${formattedPostcode}, United Kingdom`,
              postcode: formattedPostcode
            })
          }
        }
      } catch (error) {
        console.log('Postcode search failed:', error)
      }
    }
    
    // Strategy 3: UK Postcode API fallback (if still no results)
    if (addresses.length === 0) {
      console.log('Trying UK Postcode API fallback...')
      try {
        const ukApiUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`
        const ukResponse = await fetch(ukApiUrl)
        
        if (ukResponse.ok) {
          const ukData = await ukResponse.json()
          console.log('UK Postcodes API response:', JSON.stringify(ukData, null, 2))
          
          if (ukData.status === 200 && ukData.result) {
            const result = ukData.result
            addresses.push({
              address: `${formattedPostcode} - ${result.admin_district || result.parish || 'Area'}`,
              full_address: `${formattedPostcode}, ${result.admin_district || result.parish || result.country}, United Kingdom`,
              postcode: formattedPostcode
            })
          }
        }
      } catch (error) {
        console.log('UK Postcodes API failed:', error)
      }
    }
    
    // Strategy 4: Always provide manual entry option as fallback
    if (addresses.length === 0) {
      addresses.push({
        address: `${formattedPostcode} - Manual Entry Required`,
        full_address: `Please enter full address for ${formattedPostcode}`,
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