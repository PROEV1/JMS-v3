import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateClientUserRequest {
  clientId: string;
  email: string;
  fullName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create regular Supabase client for auth verification
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated and get their user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { clientId, email, fullName }: CreateClientUserRequest = await req.json();

    if (!clientId || !email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clientId, email, fullName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the client exists and doesn't already have a user account
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (client.user_id) {
      return new Response(
        JSON.stringify({ error: 'Client already has a user account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(2)}!`;

    // Create user in Supabase Auth
    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (createUserError || !authUser.user) {
      console.error('Error creating user:', createUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Update client record with user_id
      const { error: updateClientError } = await supabaseAdmin
        .from('clients')
        .update({ user_id: authUser.user.id })
        .eq('id', clientId);

      if (updateClientError) {
        console.error('Error updating client:', updateClientError);
        // If client update fails, clean up the created user
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw updateClientError;
      }

      // Update the user's profile to set role as 'client'
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          role: 'client',
          full_name: fullName,
          email: email
        })
        .eq('user_id', authUser.user.id);

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
        // Continue anyway as the profile might be created by the trigger
      }

      console.log('Successfully created user account for client:', {
        clientId,
        userId: authUser.user.id,
        email
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: authUser.user.id,
          tempPassword: tempPassword
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('Error in transaction:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});