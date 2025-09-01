import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEngineerUserRequest {
  email: string;
  full_name: string;
  password: string;
  engineer_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CREATE ENGINEER USER FUNCTION START ===');
    
    const { email, full_name, password, engineer_id }: CreateEngineerUserRequest = await req.json();
    console.log('Request data:', { email, full_name, engineer_id });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing required environment variables');
    }
    
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Check if requesting user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Creating user with admin API...');
    
    // Create user with admin API and set password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name, 
        role: 'engineer'
      },
    });

    if (createError || !newUser?.user?.id) {
      console.error('User creation failed:', createError);
      throw createError || new Error('User creation failed');
    }

    console.log('User created successfully:', newUser.user.id);

    // Update the profile that was automatically created by the trigger
    console.log('Updating auto-created profile for user:', newUser.user.id);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role: 'engineer',
        status: 'active',
      })
      .eq('user_id', newUser.user.id);

    if (profileError) {
      console.error('Profile update failed, cleaning up user:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw profileError;
    }

    // Link the user to the engineer
    console.log('Linking user to engineer:', engineer_id);
    const { error: engineerError } = await supabaseAdmin
      .from('engineers')
      .update({ user_id: newUser.user.id })
      .eq('id', engineer_id);

    if (engineerError) {
      console.error('Engineer linking failed, cleaning up user:', engineerError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw engineerError;
    }

    console.log('Engineer user created and linked successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: 'Engineer user account created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-create-engineer-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create engineer user account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});