import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(`[admin-create-client-v2] CORS ready - ${req.method} request from origin:`, origin);
  
  // Handle CORS preflight requests first - return 204 instead of 200
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request with headers:", corsHeaders);
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // Initialize Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    // Get current user data for validation
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("Validating admin role for user:", userData.user.id);
    console.log("Function v2 - Force Deploy 20250116b - CORS Fix");

    // Check if user is admin using service role to avoid RLS issues
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('Admin validation failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("Admin validation successful");

    // Parse request body
    const body = await req.json();
    const { full_name, email, phone, address, postcode } = body;

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

    console.log("Attempting to create/connect client with email:", email);

    // Validate required fields
    if (!full_name?.trim() || !email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // First, check if a user exists in the profiles table with this email
    const { data: existingProfile, error: profileSearchError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, full_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    console.log("Profile search result:", { existingProfile, profileSearchError });

    let existingUser = null;
    let existingUserId = null;

    if (existingProfile) {
      existingUserId = existingProfile.user_id;
      existingUser = { id: existingUserId, email: existingProfile.email };
      console.log("Found existing user via profiles:", existingUser);
    } else {
      // If not found in profiles, search in auth.users using listUsers
      console.log("User not found in profiles, searching auth users...");
      const { data: authUsersData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authUsersError) {
        console.error('Error listing auth users:', authUsersError);
        return new Response(
          JSON.stringify({ error: 'Failed to search for existing users' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const foundUser = authUsersData.users.find(u => 
        u.email?.toLowerCase() === email.trim().toLowerCase()
      );

      if (foundUser) {
        existingUser = foundUser;
        existingUserId = foundUser.id;
        console.log("Found existing user in auth:", existingUser);
      }
    }

    let isNewUser = false;
    let temporaryPassword = null;

    // If no existing user found, create a new one
    if (!existingUser) {
      console.log("Creating new user...");
      
      // Generate a temporary password
      temporaryPassword = Math.random().toString(36).slice(-12) + 'A1!';
      
      const { data: newUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim()
        }
      });

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        return new Response(
          JSON.stringify({ 
            error: createUserError.message || 'Failed to create user account' 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      existingUser = newUserData.user;
      existingUserId = newUserData.user.id;
      isNewUser = true;
      console.log("New user created:", existingUser.id);
    }

    // Check if client already exists
    const { data: existingClient, error: clientSearchError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .or(`user_id.eq.${existingUserId},email.eq.${email.trim().toLowerCase()}`)
      .maybeSingle();

    if (clientSearchError) {
      console.error('Error searching for existing client:', clientSearchError);
      
      // If we created a new user but client creation failed, clean up
      if (isNewUser && existingUserId) {
        console.log("Cleaning up newly created user due to client search error");
        await supabaseAdmin.auth.admin.deleteUser(existingUserId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to check for existing client' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingClient) {
      console.log("Client already exists:", existingClient.id);
      return new Response(
        JSON.stringify({ 
          error: 'A client with this email already exists',
          existingClient: {
            id: existingClient.id,
            full_name: existingClient.full_name,
            email: existingClient.email
          }
        }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create the client record
    console.log("Creating client record...");
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        user_id: existingUserId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        postcode: postcode?.trim() || null
      })
      .select()
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      
      // If we created a new user but client creation failed, clean up
      if (isNewUser && existingUserId) {
        console.log("Cleaning up newly created user due to client creation error");
        await supabaseAdmin.auth.admin.deleteUser(existingUserId);
      }
      
      return new Response(
        JSON.stringify({ 
          error: clientError.message || 'Failed to create client record' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If we created a new user, also create their profile
    if (isNewUser && existingUserId) {
      console.log("Creating profile for new user...");
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: existingUserId,
          email: email.trim().toLowerCase(),
          full_name: full_name.trim(),
          role: 'client'
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Note: We don't fail here as the client and user are created successfully
      }
    }

    console.log("Client created successfully:", newClient);

    return new Response(
      JSON.stringify({
        success: true,
        client: newClient,
        isNewUser,
        temporaryPassword: isNewUser ? temporaryPassword : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in admin-create-client-v2:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});