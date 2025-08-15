import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== FUNCTION START ===');
  
  try {
    // First, let's just parse the body and log it
    console.log('Parsing request body...');
    const body = await req.json();
    console.log('Body received:', JSON.stringify(body, null, 2));
    
    const { email, full_name, role, region } = body;
    console.log('Extracted fields:', { email, full_name, role, region });
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment variables check:');
    console.log('- SUPABASE_URL:', supabaseUrl ? 'present' : 'MISSING');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'present' : 'MISSING');
    console.log('- RESEND_API_KEY:', resendKey ? 'present' : 'MISSING');
    
    if (!supabaseUrl || !supabaseKey || !resendKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required environment variables',
          success: false
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Try to create Supabase client
    console.log('Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created successfully');
    
    // Test a simple query first
    console.log('Testing database connection...');
    const { data: testQuery, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
      
    if (testError) {
      console.error('Database connection test failed:', testError);
      return new Response(
        JSON.stringify({ 
          error: `Database connection failed: ${testError.message}`,
          success: false
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('Database connection successful');
    
    // Check if user already exists
    console.log('Checking for existing user...');
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .maybeSingle();
      
    if (userCheckError) {
      console.error('User check error:', userCheckError);
      return new Response(
        JSON.stringify({ 
          error: `User check failed: ${userCheckError.message}`,
          success: false
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return new Response(
        JSON.stringify({ 
          error: `User with email ${email} already exists`,
          success: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('User does not exist, proceeding with creation...');
    
    // For now, let's just return success without actually creating the user
    // This will help us isolate if the issue is in the user creation or elsewhere
    console.log('=== FUNCTION COMPLETED SUCCESSFULLY ===');
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test completed successfully - user creation disabled for testing',
        debug: {
          email,
          full_name,
          role,
          region,
          hasResendKey: !!resendKey
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('=== FUNCTION ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    
    return new Response(
      JSON.stringify({ 
        error: `Function error: ${error.message}`,
        success: false,
        errorType: typeof error,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);