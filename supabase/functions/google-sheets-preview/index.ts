import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GoogleSheetsRequest {
  gsheet_id: string;
  sheet_name?: string;
  preview_rows?: number;
}

interface GoogleSheetsResponse {
  success: boolean;
  headers?: string[];
  rows?: string[][];
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
    // Validate JWT and admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authorization required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid authentication' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Admin access required' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: GoogleSheetsRequest = await req.json();
    const { gsheet_id, sheet_name = 'Sheet1', preview_rows = 10 } = body;

    if (!gsheet_id) {
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
    if (!serviceAccountKey) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Google Service Account credentials not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid Google Service Account credentials format' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate JWT for Google API authentication
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

    // Import private key and sign JWT
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      new Uint8Array(atob(credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')).split('').map(c => c.charCodeAt(0))),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      encoder.encode(signatureInput)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (match) => ({'+': '-', '/': '_', '=': ''}[match] || match));
    const jwt = `${signatureInput}.${signatureB64}`;

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to authenticate with Google API' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch sheet data
    const range = `${sheet_name}!A1:ZZ${preview_rows + 1}`;
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${gsheet_id}/values/${range}`;
    
    const sheetsResponse = await fetch(sheetsUrl, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    const sheetsData = await sheetsResponse.json();
    
    if (!sheetsResponse.ok) {
      return new Response(JSON.stringify({ 
        success: false,
        error: sheetsData.error?.message || 'Failed to fetch Google Sheets data' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const values = sheetsData.values || [];
    const response: GoogleSheetsResponse = {
      success: true,
      headers: values[0] || [],
      rows: values.slice(1) || []
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