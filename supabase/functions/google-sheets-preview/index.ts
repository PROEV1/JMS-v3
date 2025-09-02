import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GoogleSheetsRequest {
  gsheet_id: string;
  sheet_name?: string;
  preview_rows?: number;
  start_row?: number;
  max_rows?: number;
}

interface GoogleSheetsResponse {
  success: boolean;
  headers?: string[];
  rows?: string[][];
  total_rows?: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  try {
    console.log('Processing Google Sheets preview request...');
    
    // Check for service role key (edge function to edge function calls)
    const apikeyHeader = req.headers.get('apikey');
    const isServiceRole = apikeyHeader === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!isServiceRole) {
      // Validate JWT and admin access for regular web requests
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        console.log('No authorization header provided');
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Authorization required' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      console.log('Auth token present:', !!token);
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      
      if (authError || !user) {
        console.error('Authentication failed:', authError);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Invalid authentication' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Authenticated user:', user.id);

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile || profile.role !== 'admin') {
        console.error('Authorization failed:', profileError, 'role:', profile?.role);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Admin access required' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Admin access confirmed');
    } else {
      console.log('Service role access granted');
    }

    let body: GoogleSheetsRequest;
    try {
      const text = await req.text();
      console.log('Request body text length:', text.length);
      
      if (!text || text.trim() === '') {
        throw new Error('Request body is empty');
      }
      
      body = JSON.parse(text);
      console.log('Request data:', { 
        gsheet_id: body.gsheet_id?.substring(0, 10) + '...', 
        sheet_name: body.sheet_name,
        preview_rows: body.preview_rows 
      });
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return new Response(JSON.stringify({ 
        success: false,
        error: `Invalid JSON in request body: ${parseError.message}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { gsheet_id, sheet_name = 'Sheet1', preview_rows = 10, start_row = 0, max_rows = null } = body;

    if (!gsheet_id) {
      console.log('Missing Google Sheet ID');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Google Sheet ID is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Google Service Account credentials
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    console.log('Google Service Account Key configured:', !!serviceAccountKey);
    
    if (!serviceAccountKey) {
      console.error('Google Service Account credentials not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Google Service Account credentials not configured. Please add the GOOGLE_SERVICE_ACCOUNT_KEY secret in Supabase.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
      console.log('Google credentials parsed successfully, client_email:', credentials.client_email);
      
      // Validate required fields
      const requiredFields = ['client_email', 'private_key', 'token_uri', 'project_id'];
      const missingFields = requiredFields.filter(field => !credentials[field]);
      if (missingFields.length > 0) {
        console.error('Missing required credential fields:', missingFields);
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid Google Service Account credentials: missing ${missingFields.join(', ')}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (parseError) {
      console.error('Failed to parse Google Service Account credentials:', parseError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid Google Service Account credentials format. Please ensure it\'s valid JSON.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate JWT for Google API authentication with better error handling
    console.log('Generating JWT for Google API...');
    
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };

    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Import private key and sign JWT with better error handling
    let privateKey;
    try {
      console.log('Importing private key...');
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        new Uint8Array(atob(credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')).split('').map(c => c.charCodeAt(0))),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['sign']
      );
      console.log('Private key imported successfully');
    } catch (keyError) {
      console.error('Failed to import private key:', keyError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to process Google Service Account private key. Please check the credential format.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      encoder.encode(signatureInput)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
    const jwt = `${signatureInput}.${signatureB64}`;
    console.log('JWT generated successfully');

    // Get access token with better error handling
    console.log('Requesting access token from Google...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('Failed to get access token:', tokenData);
      return new Response(JSON.stringify({ 
        success: false,
        error: `Failed to authenticate with Google API: ${tokenData.error || 'Unknown error'}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
     console.log('Access token obtained successfully');

    // First, get the spreadsheet metadata to see available sheets
    console.log('Getting spreadsheet metadata...');
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${gsheet_id}`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    if (!metadataResponse.ok) {
      const metadataError = await metadataResponse.json();
      console.error('Failed to get spreadsheet metadata:', metadataError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to access spreadsheet metadata. Please check Sheet ID and permissions.',
        service_account_email: credentials.client_email
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = await metadataResponse.json();
    console.log('Available sheets:', metadata.sheets?.map((s: any) => s.properties.title));
    
    // Find the correct sheet name (case-insensitive)
    const availableSheets = metadata.sheets?.map((s: any) => s.properties.title) || [];
    let actualSheetName = sheet_name;
    
    if (!availableSheets.includes(sheet_name)) {
      // Try to find a case-insensitive match
      const lowerSheetName = sheet_name.toLowerCase();
      const matchedSheet = availableSheets.find((name: string) => name.toLowerCase() === lowerSheetName);
      
      if (matchedSheet) {
        actualSheetName = matchedSheet;
        console.log(`Sheet name corrected from "${sheet_name}" to "${actualSheetName}"`);
      } else {
        console.error(`Sheet "${sheet_name}" not found. Available sheets:`, availableSheets);
        return new Response(JSON.stringify({ 
          success: false,
          error: `Sheet "${sheet_name}" not found. Available sheets: ${availableSheets.join(', ')}`,
          available_sheets: availableSheets
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // First, get ALL data to determine total rows and implement proper pagination
    let fullRange;
    if (actualSheetName.includes(' ') || actualSheetName.includes("'")) {
      fullRange = `'${actualSheetName.replace(/'/g, "''")}'!A:ZZ`;
    } else {
      fullRange = `${actualSheetName}!A:ZZ`;
    }
    
    console.log(`Original sheet name: "${sheet_name}"`);
    console.log(`Actual sheet name: "${actualSheetName}"`);
    console.log(`Constructed range: "${fullRange}"`);
    console.log(`Pagination: start_row=${start_row}, max_rows=${max_rows}`);
    
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${gsheet_id}/values/${encodeURIComponent(fullRange)}`;
    
    console.log(`Final URL: ${sheetsUrl}`);
    
    const sheetsResponse = await fetch(sheetsUrl, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    const sheetsData = await sheetsResponse.json();
    console.log('Sheets API response status:', sheetsResponse.status);
    
    if (!sheetsResponse.ok) {
      console.error('Sheets API error:', sheetsData);
      
      let errorMessage = 'Failed to fetch Google Sheets data';
      if (sheetsResponse.status === 404) {
        errorMessage = 'Google Sheet not found. Please check the Sheet ID and ensure the sheet exists.';
      } else if (sheetsResponse.status === 403) {
        errorMessage = `Access denied to Google Sheet. Please share the sheet with the service account email: ${credentials.client_email}`;
      } else if (sheetsData.error?.message) {
        errorMessage = sheetsData.error.message;
      }
      
      return new Response(JSON.stringify({ 
        success: false,
        error: errorMessage,
        service_account_email: credentials.client_email
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const values = sheetsData.values || [];
    console.log('Sheet data fetched successfully, total rows:', values.length);
    
    if (values.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        headers: [],
        rows: [],
        total_rows: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const headers = values[0] || [];
    const dataRows = values.slice(1) || [];
    const totalDataRows = dataRows.length;
    
    // Apply pagination if max_rows is specified
    let paginatedRows = dataRows;
    if (max_rows !== null) {
      const endRow = start_row + max_rows;
      paginatedRows = dataRows.slice(start_row, endRow);
      console.log(`Paginated from row ${start_row} to ${endRow}, returning ${paginatedRows.length} rows`);
    } else {
      // If no max_rows, still apply start_row offset
      if (start_row > 0) {
        paginatedRows = dataRows.slice(start_row);
        console.log(`Applied start_row offset ${start_row}, returning ${paginatedRows.length} rows`);
      }
    }
    
    const response: GoogleSheetsResponse = {
      success: true,
      headers: headers,
      rows: paginatedRows,
      total_rows: totalDataRows
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Google Sheets preview failed:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});