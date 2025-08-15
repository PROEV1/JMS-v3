import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error("User token validation failed:", userError);
      throw new Error(`Invalid user token: ${userError.message}`);
    }
    
    if (!userData.user) {
      console.error("No user data found in token");
      throw new Error("Invalid user token - no user data");
    }

    console.log("Validating admin role for user:", userData.user.id);

    // Check if user is admin using service role to avoid RLS issues
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      throw new Error(`Profile fetch failed: ${profileError.message}`);
    }

    if (profile?.role !== 'admin') {
      console.error("User is not admin. Role:", profile?.role);
      throw new Error("Unauthorized: Admin access required");
    }

    console.log("Admin validation successful");

    // Get client data from request
    const { full_name, email, phone, address } = await req.json();

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

    // Create the auth user using admin client (won't affect current session)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      user_metadata: {
        full_name: full_name,
      },
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Auth creation failed: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    // Create client record using service role (bypasses RLS)
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        user_id: authData.user.id,
        full_name: full_name,
        email: email,
        phone: phone || null,
        address: address || null
      })
      .select()
      .single();

    if (clientError) {
      // If client creation fails, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Client creation failed: ${clientError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        client: clientData,
        temporaryPassword: tempPassword 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in admin-create-client:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});