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

// Helper function to extract and format addresses from API responses
function extractAddresses(data: any[], source: 'mapbox' | 'postcodes' | 'nominatim'): AddressResult[] {
  const addresses: AddressResult[] = [];
  
  if (source === 'mapbox' && data.length > 0) {
    data.forEach(feature => {
      if (feature.place_name) {
        // Keep the full address text as provided by Mapbox, just clean up country suffix
        const fullAddress = feature.place_name
          .replace(/, United Kingdom$/, '')
          .replace(/, UK$/, '')
          .trim();
        
        // For the short address, try to extract meaningful parts
        const parts = fullAddress.split(',').map(p => p.trim());
        let shortAddress = parts[0];
        
        // If we have house number in the address, show more context
        if (parts.length > 1 && shortAddress.match(/^\d+/)) {
          shortAddress = parts.slice(0, 2).join(', ');
        } else if (parts.length > 2) {
          shortAddress = parts.slice(0, 2).join(', ');
        }
        
        addresses.push({
          address: shortAddress,
          full_address: fullAddress,
          postcode: feature.text || feature.context?.find((c: any) => c.id?.startsWith('postcode'))?.text || ''
        });
      }
    });
  } else if (source === 'postcodes' && data.length > 0) {
    data.forEach(item => {
      const postcode = item.postcode || '';
      const district = item.admin_district || '';
      
      addresses.push({
        address: district,
        full_address: `${district}, ${postcode}`,
        postcode: postcode
      });
    });
  } else if (source === 'nominatim' && data.length > 0) {
    data.forEach(item => {
      if (item.display_name) {
        const fullAddress = item.display_name;
        const parts = fullAddress.split(',').map((p: string) => p.trim());
        const shortAddress = parts.slice(0, 2).join(', ');
        
        addresses.push({
          address: shortAddress,
          full_address: fullAddress,
          postcode: item.address?.postcode || ''
        });
      }
    });
  }
  
  return addresses;
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
    let postcodeCoords: { lat: number, lon: number } | null = null;
    
    // First, get postcode coordinates for proximity biasing
    try {
      const ukApiUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`
      const ukResponse = await fetch(ukApiUrl)
      
      if (ukResponse.ok) {
        const ukData = await ukResponse.json()
        if (ukData.status === 200 && ukData.result) {
          postcodeCoords = {
            lat: ukData.result.latitude,
            lon: ukData.result.longitude
          };
          console.log('Got postcode coordinates:', postcodeCoords)
        }
      }
    } catch (error) {
      console.log('Failed to get postcode coordinates:', error)
    }

    // Strategy 1: Try comprehensive Mapbox searches with house number
    if (houseNumber) {
      console.log('Strategy 1: Trying comprehensive Mapbox searches with house number...')
      
      const searchQueries = [
        `${houseNumber} ${formattedPostcode}`,
        `${houseNumber}, ${formattedPostcode}`,
        `${houseNumber} ${formattedPostcode.replace(' ', '')}`,
        `${houseNumber} ${formattedPostcode} UK`,
        `${houseNumber} ${formattedPostcode.split(' ')[0]}`,
      ];
      
      for (const searchQuery of searchQueries) {
        try {
          let mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
            `access_token=${mapboxToken}&` +
            'country=GB&' +
            'types=address,poi&' +
            'limit=10'
          
          // Add proximity biasing if we have coordinates
          if (postcodeCoords) {
            mapboxUrl += `&proximity=${postcodeCoords.lon},${postcodeCoords.lat}`
          }
          
          console.log('Mapbox search query:', searchQuery)
          
          const response = await fetch(mapboxUrl)
          if (response.ok) {
            const data = await response.json()
            console.log('Mapbox response for query "' + searchQuery + '":', JSON.stringify(data, null, 2))
            
            if (data.features && data.features.length > 0) {
              const foundAddresses = extractAddresses(data.features, 'mapbox')
              addresses.push(...foundAddresses)
              
              // If we found good results, prioritize them
              if (foundAddresses.length > 0) {
                console.log('Found addresses with query:', searchQuery)
                break;
              }
            }
          }
        } catch (error) {
          console.log('Mapbox search failed for query:', searchQuery, error)
        }
      }
    }
    
    // Strategy 2: Try OpenStreetMap Nominatim for additional coverage
    if (houseNumber && addresses.length === 0) {
      console.log('Strategy 2: Trying OpenStreetMap Nominatim...')
      
      try {
        const nominatimQuery = `${houseNumber} ${formattedPostcode}, UK`
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(nominatimQuery)}&` +
          'format=json&' +
          'addressdetails=1&' +
          'countrycodes=gb&' +
          'limit=5'
        
        console.log('Nominatim query:', nominatimQuery)
        
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'PostcodeLookup/1.0'
          }
        })
        
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json()
          console.log('Nominatim response:', JSON.stringify(nominatimData, null, 2))
          
          const nominatimAddresses = extractAddresses(nominatimData, 'nominatim')
          addresses.push(...nominatimAddresses)
        }
      } catch (error) {
        console.log('Nominatim search failed:', error)
      }
    }
    
    // Strategy 3: Try postcode-only searches for area context
    if (addresses.length === 0) {
      console.log('Strategy 3: Trying postcode-only searches...')
      
      try {
        let mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(formattedPostcode)}.json?` +
          `access_token=${mapboxToken}&` +
          'country=GB&' +
          'types=postcode,place&' +
          'limit=10'
        
        // Add proximity biasing if we have coordinates  
        if (postcodeCoords) {
          mapboxUrl += `&proximity=${postcodeCoords.lon},${postcodeCoords.lat}`
        }
        
        console.log('Mapbox postcode search for:', formattedPostcode)
        
        const response = await fetch(mapboxUrl)
        if (response.ok) {
          const data = await response.json()
          console.log('Mapbox postcode response:', JSON.stringify(data, null, 2))
          
          const postcodeAddresses = extractAddresses(data.features || [], 'mapbox')
          addresses.push(...postcodeAddresses)
        }
      } catch (error) {
        console.log('Mapbox postcode search failed:', error)
      }
      
      // Also try UK Postcodes API for fallback
      try {
        const ukApiUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(formattedPostcode)}`
        const ukResponse = await fetch(ukApiUrl)
        
        if (ukResponse.ok) {
          const ukData = await ukResponse.json()
          if (ukData.status === 200 && ukData.result) {
            const postcodeAddresses = extractAddresses([ukData.result], 'postcodes')
            addresses.push(...postcodeAddresses)
          }
        }
      } catch (error) {
        console.log('UK Postcodes API failed:', error)
      }
    }
    
    // Strategy 4: Always provide manual entry option
    addresses.push({
      address: `${formattedPostcode} - Enter full address manually`,
      full_address: `Please enter complete address for ${formattedPostcode}`,
      postcode: formattedPostcode
    })

    // Filter out duplicates based on full_address to avoid showing the same address multiple times
    const uniqueAddresses = addresses.filter((addr, index, self) => 
      index === self.findIndex(a => a.full_address === addr.full_address)
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
