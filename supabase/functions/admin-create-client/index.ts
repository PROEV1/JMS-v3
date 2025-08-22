import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(`[admin-create-client] CORS ready - ${req.method} request from origin:`, origin);
  
  // Handle CORS preflight requests first - return 204 instead of 200
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request with headers:", corsHeaders);
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
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

    // Create client with the authorization header to get the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error("User token validation failed:", userError);
      throw new Error(`Invalid user token: ${userError.message}`);
    }
    
    if (!userData.user) {
      console.error("No user data found in token");
      throw new Error("Invalid user token - no user data");
    }

    console.log("Validating admin role for user:", userData.user.id);
    console.log("Function v1 - Force Deploy 20250116b - CORS Fix");

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
    const { full_name, email, phone, address, postcode } = await req.json();

    // Normalize phone number
    function normalizePhone(phone: string | null | undefined): string | null {
      if (!phone || typeof phone !== 'string') {
        return null;
      }

      // Handle scientific notation (e.g., "4.41234567891E12" -> "441234567891")
      let normalizedPhone = phone.toString();
      if (normalizedPhone.includes('E') || normalizedPhone.includes('e')) {
        try {
          // Convert scientific notation to regular number string
          const numValue = parseFloat(normalizedPhone);
          if (!isNaN(numValue)) {
            normalizedPhone = numValue.toFixed(0);
          }
        } catch (e) {
          console.warn('Failed to parse scientific notation phone:', phone);
        }
      }

      // Remove all non-digit characters
      const digitsOnly = normalizedPhone.replace(/\D/g, '');
      
      if (!digitsOnly) {
        return null;
      }

      // Handle UK phone numbers
      if (digitsOnly.startsWith('44')) {
        // Convert 44XXXXXXXXXX to 0XXXXXXXXXX (UK format)
        const ukNumber = '0' + digitsOnly.substring(2);
        if (ukNumber.length === 11) {
          return ukNumber;
        }
      } else if (digitsOnly.length === 10) {
        // Add leading 0 to 10-digit numbers (assuming UK)
        return '0' + digitsOnly;
      } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        // Already correct UK format
        return digitsOnly;
      }

      // Return as-is if it doesn't match common patterns
      return digitsOnly.length >= 10 ? digitsOnly : null;
    }

    const normalizedPhone = normalizePhone(phone);

    // Validate required fields
    if (!full_name || !email) {
      return new Response(JSON.stringify({ error: "Full name and email are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    console.log("Attempting to create/connect client with email:", normalizedEmail);

    // Step 1: Try to find user_id via profiles (faster, assumes profiles sync with auth)
    let userId = null;
    let tempPassword = null;
    let isNewUser = false;
    
    const { data: profileData, error: profileLookupError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileData) {
      userId = profileData.user_id;
      console.log(`Found existing user via profiles: ${userId}`);
    } else if (profileLookupError && profileLookupError.code !== 'PGRST116') { // Ignore 'no rows' error
      console.error("Profile lookup failed:", profileLookupError);
      return new Response(JSON.stringify({ error: `Profile lookup failed: ${profileLookupError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    } else {
      // Step 2: Fallback to paginated auth.admin.listUsers if no profile
      console.log("No profile found, searching auth users...");
      let page = 1;
      const perPage = 1000; // Max per Supabase docs to minimize loops
      let foundUser = null;
      
      while (true) {
        const { data: listUsersResponse, error: listError } = await supabaseAdmin.auth.admin.listUsers({ 
          page, 
          perPage 
        });
        
        if (listError) {
          console.error("Error listing users:", listError);
          return new Response(JSON.stringify({ error: `User lookup failed: ${listError.message}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        foundUser = listUsersResponse.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (foundUser || listUsersResponse.users.length < perPage) break; // Stop if found or no more pages
        page++;
      }

      if (foundUser) {
        userId = foundUser.id;
        console.log(`Found existing user via auth list: ${userId}`);
      } else {
        // Step 3: Create new user if not found anywhere
        console.log("Creating new auth user");
        
        // Generate stronger temporary password using crypto
        const randomBytes = crypto.getRandomValues(new Uint8Array(16));
        const randomString = Array.from(randomBytes, byte => byte.toString(36)).join('');
        tempPassword = randomString.slice(0, 12) + 'A1!';
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          user_metadata: {
            full_name: full_name,
          },
          email_confirm: true
        });

        if (authError) {
          console.error("Auth user creation error:", authError);
          return new Response(JSON.stringify({ error: `Auth creation failed: ${authError.message}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        
        if (!authData.user) {
          return new Response(JSON.stringify({ error: "Failed to create user - no user data returned" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        
        userId = authData.user.id;
        isNewUser = true;
        console.log("Created new user with ID:", userId);
      }
    }

    // Check for duplicate clients before creating (case-insensitive email check)
    const { data: existingClient, error: clientCheckError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .or(`user_id.eq.${userId},email.ilike.${normalizedEmail}`)
      .maybeSingle();
      
    if (clientCheckError) {
      console.error("Error checking existing client:", clientCheckError);
      return new Response(JSON.stringify({ error: `Client check failed: ${clientCheckError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    if (existingClient) {
      return new Response(JSON.stringify({ error: "This email already has a client account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create client record using service role (bypasses RLS)
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        user_id: userId,
        full_name: full_name,
        email: normalizedEmail,
        phone: phone || null,
        address: address || null,
        postcode: postcode || null
      })
      .select()
      .single();

    if (clientError) {
      console.error("Client creation failed:", clientError);
      // If client creation fails and we created a new user, clean up the auth user
      if (isNewUser && userId) {
        console.log("Cleaning up auth user due to client creation failure");
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      return new Response(JSON.stringify({ error: `Client creation failed: ${clientError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("Client created successfully:", clientData.id);

    // Create profile for new users
    if (isNewUser && userId) {
      console.log("Creating profile for new user");
      const { error: profileCreationError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          email: normalizedEmail,
          full_name: full_name,
          role: 'client'
        });

      if (profileCreationError) {
        console.error("Profile creation failed:", profileCreationError);
        // Don't fail the whole operation, but log it
        console.log("Continuing despite profile creation failure");
      } else {
        console.log("Profile created successfully");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        client: clientData,
        temporaryPassword: tempPassword,
        isNewUser: isNewUser
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in admin-create-client:", error, {
      message: error.message,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});