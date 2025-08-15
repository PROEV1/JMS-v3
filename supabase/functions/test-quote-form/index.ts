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
    // First, let's just check what environment variables we have
    const quoteFormUrl = Deno.env.get('QUOTE_FORM_SUPABASE_URL');
    const quoteFormKey = Deno.env.get('QUOTE_FORM_SUPABASE_ANON_KEY');
    
    console.log('Testing Quote Form connection...');
    console.log('URL exists:', !!quoteFormUrl);
    console.log('Key exists:', !!quoteFormKey);
    console.log('URL value:', quoteFormUrl);
    
    // Return this info so we can see what's configured
    return new Response(JSON.stringify({
      message: 'Environment check',
      url_configured: !!quoteFormUrl,
      key_configured: !!quoteFormKey,
      url_value: quoteFormUrl || 'NOT SET',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});