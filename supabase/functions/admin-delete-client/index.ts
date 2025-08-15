import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client with user's token for validation
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating admin role for user:', user.id);

    // Validate admin role using service role client
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      console.error('User is not admin:', profile);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin validation successful');

    // Get client data from request
    const { clientId, userId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Client ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deleting client:', clientId, 'with user ID:', userId || 'none');

    // First get the client to check if it has a user_id
    const { data: clientData, error: clientFetchError } = await supabaseAdmin
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .single();

    if (clientFetchError) {
      console.error('Error fetching client:', clientFetchError);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the client record (this will cascade to related records due to foreign key constraints)
    const { error: clientDeleteError } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (clientDeleteError) {
      console.error('Error deleting client record:', clientDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete client record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only delete profile and auth user if the client had a user account
    if (clientData.user_id) {
      const actualUserId = clientData.user_id;
      
      // Delete the profile record
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', actualUserId);

      if (profileDeleteError) {
        console.error('Error deleting profile:', profileDeleteError);
      }

      // Finally delete the auth user
      const { error: userDeleteError } = await supabaseAdmin.auth.admin.deleteUser(actualUserId);

      if (userDeleteError) {
        console.error('Error deleting auth user:', userDeleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Client and associated user deleted successfully');
    } else {
      console.log('Client deleted successfully (no associated user account)');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Client deleted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-delete-client function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});