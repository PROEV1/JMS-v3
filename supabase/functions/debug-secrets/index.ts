import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== DEBUG SECRETS ENDPOINT ===');
    
    // Check all environment variables
    const allEnvVars = Deno.env.toObject();
    const relevantVars = Object.keys(allEnvVars).filter(key => 
      key.includes('GOOGLE') || 
      key.includes('SERVICE') || 
      key.includes('ACCOUNT') ||
      key.includes('SUPABASE')
    );
    
    console.log('All environment variable names:');
    console.log(Object.keys(allEnvVars).sort());
    
    console.log('Relevant environment variables:');
    relevantVars.forEach(key => {
      const value = allEnvVars[key];
      console.log(`${key}: ${value ? 'EXISTS (' + value.length + ' chars)' : 'NOT_SET'}`);
      if (key.includes('GOOGLE') && value) {
        console.log(`  Starts with: ${value.substring(0, 50)}...`);
      }
    });

    const googleKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    console.log('Direct GOOGLE_SERVICE_ACCOUNT_KEY access:', !!googleKey);
    
    if (googleKey) {
      try {
        const parsed = JSON.parse(googleKey);
        console.log('Credential fields:', Object.keys(parsed));
        console.log('Client email:', parsed.client_email);
      } catch (e) {
        console.log('Failed to parse as JSON:', e.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Check server logs for detailed environment variable information',
      google_service_account_configured: !!googleKey,
      relevant_env_vars: relevantVars
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Debug error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});