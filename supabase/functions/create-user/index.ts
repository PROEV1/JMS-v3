import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CREATE USER FUNCTION START ===');
    
    const { email, full_name, role, region } = await req.json();
    console.log('Request data:', { email, full_name, role, region });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment check:');
    console.log('- SUPABASE_URL exists:', !!supabaseUrl);
    console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!serviceKey);
    console.log('- Service key length:', serviceKey?.length || 0);
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('Supabase client created successfully');
    
    // Create user with admin API
    console.log('Creating user with admin API...');
    const { data: user, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, role, region: region || '' },
    });

    console.log('User creation result:', { user: user?.user?.id, error });

    if (error) {
      console.error('User creation failed:', error);
      throw error;
    }

    if (!user?.user?.id) {
      throw new Error('User creation succeeded but no user ID returned');
    }

    // Update the profile that was automatically created by the trigger
    console.log('Updating auto-created profile for user:', user.user.id);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name,
        role,
        region: region || '',
        status: 'active',
      })
      .eq('user_id', user.user.id);

    console.log('Profile update result:', { profileError });

    if (profileError) {
      console.error('Profile update failed, cleaning up user:', profileError);
      await supabase.auth.admin.deleteUser(user.user.id);
      throw profileError;
    }

    console.log('User and profile created successfully');
    return new Response(
      JSON.stringify({ success: true, user_id: user.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});