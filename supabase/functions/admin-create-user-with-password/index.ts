import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserWithPasswordRequest {
  email: string;
  full_name: string;
  password: string;
  role: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CREATE USER WITH PASSWORD FUNCTION START ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    
    // Log raw request body first
    const body = await req.text();
    console.log('Raw request body:', body);
    
    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { email, full_name, password, role }: CreateUserWithPasswordRequest = requestData;
    console.log('Parsed request data:', { email, full_name, role, hasPassword: !!password });
    // Validate required fields
    if (!email?.trim()) {
      console.error('Missing email field');
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!full_name?.trim()) {
      console.error('Missing full_name field');
      return new Response(
        JSON.stringify({ error: 'Full name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!password?.trim()) {
      console.error('Missing password field');
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!role?.trim()) {
      console.error('Missing role field');
      return new Response(
        JSON.stringify({ error: 'Role is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('Environment check:', { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceKey: !!serviceKey 
    });
    
    if (!supabaseUrl || !serviceKey) {
      console.error('Missing environment variables:', { supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey });
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
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Attempting to verify token...');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    console.log('Auth result:', { 
      hasUser: !!user, 
      userId: user?.id, 
      userEmail: user?.email,
      authError: authError?.message 
    });
    
    if (authError || !user) {
      console.error('Auth verification failed:', { authError: authError?.message, hasUser: !!user });
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying admin role for user:', user.id);
    
    // Verify admin role
    const { data: profile, error: profileQueryError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('Profile query result:', { 
      profile, 
      profileQueryError: profileQueryError?.message 
    });

    if (profileQueryError || !profile || profile.role !== 'admin') {
      console.error('Admin verification failed:', { 
        profileQueryError: profileQueryError?.message,
        profileRole: profile?.role 
      });
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
        role
      },
    });

    if (createError || !newUser?.user?.id) {
      console.error('User creation failed:', createError);
      throw createError || new Error('User creation failed');
    }

    console.log('User created successfully:', newUser.user.id);

    // Wait a moment for triggers to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if profile was auto-created by trigger
    console.log('Checking if profile was auto-created...');
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', newUser.user.id)
      .single();

    console.log('Existing profile check:', { 
      existingProfile, 
      checkError: checkError?.message 
    });

    // Update the profile that was automatically created by the trigger
    console.log('Updating auto-created profile for user:', newUser.user.id);
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role,
        status: 'active',
      })
      .eq('user_id', newUser.user.id)
      .select()
      .single();

    console.log('Profile update result:', { 
      updatedProfile, 
      profileError: profileError?.message 
    });

    if (profileError) {
      console.error('Profile update failed, cleaning up user:', profileError);
      console.log('Attempting to delete user:', newUser.user.id);
      
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        console.log('User deletion successful');
      } catch (deleteError) {
        console.error('Failed to delete user during cleanup:', deleteError);
      }
      
      throw new Error(`Profile update failed: ${profileError.message}`);
    }

    console.log('User created and profile updated successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: 'User account created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-create-user-with-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create user account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});