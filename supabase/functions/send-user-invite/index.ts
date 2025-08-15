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

  try {
    console.log('=== SEND USER INVITE FUNCTION START ===');
    const body = await req.json();
    const { email, full_name, role, region } = body;
    
    console.log('Request data:', { email, full_name, role, region });
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment check:');
    console.log('- SUPABASE_URL exists:', !!supabaseUrl);
    console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseKey);
    console.log('- RESEND_API_KEY exists:', !!resendKey);
    
    if (!supabaseUrl || !supabaseKey || !resendKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created successfully');
    
    // Check if user already exists
    console.log('Checking if user exists with email:', email);
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      console.error('Failed to check existing users:', listError);
      return new Response(
        JSON.stringify({ error: `Failed to check existing users: ${listError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = existingUsers.users.find(user => user.email === email);
    console.log('Existing user check result:', { 
      exists: !!existingUser, 
      userId: existingUser?.id 
    });

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // User exists, update their profile
      console.log('User exists, updating profile for user:', existingUser.id);
      userId = existingUser.id;
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email,
          full_name,
          role,
          region: region || '',
          status: 'active',
        }, {
          onConflict: 'user_id'
        });

      console.log('Profile update result:', { profileError });

      if (profileError) {
        console.error('Profile update failed:', profileError);
        return new Response(
          JSON.stringify({ error: `Failed to update profile: ${profileError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // User doesn't exist, create new user
      console.log('Creating new user with admin API...');
      isNewUser = true;
      const temporaryPassword = `temp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name, role, region: region || '' },
      });

      console.log('User creation result:', { user: authData?.user?.id, error: authError });

      if (authError) {
        console.error('User creation failed:', authError);
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${authError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!authData?.user?.id) {
        console.error('User creation succeeded but no user ID returned');
        throw new Error('User creation succeeded but no user ID returned');
      }

      userId = authData.user.id;

      // Update the profile that was automatically created by the trigger
      console.log('Updating auto-created profile for user:', userId);
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name,
          role,
          region: region || '',
          status: 'active',
        })
        .eq('user_id', userId);

      console.log('Profile update result:', { profileError });

      if (profileError) {
        console.error('Profile update failed, cleaning up user:', profileError);
        await supabase.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: `Failed to update profile: ${profileError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate password reset link for the user with our custom redirect
    console.log('Generating password reset link for user:', userId);
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://preview--pro-spaces-client-portal.lovable.app/auth/setup-password'
      }
    });

    console.log('Password reset link generation result:', { 
      action_link: resetData?.properties?.action_link ? 'generated' : 'missing',
      error: resetError 
    });

    if (resetError || !resetData?.properties?.action_link) {
      console.error('Failed to generate password reset link:', resetError);
      if (isNewUser) {
        await supabase.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ error: `Failed to generate password setup link: ${resetError?.message || 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the action link directly - Supabase handles the tokens internally
    const passwordSetupUrl = resetData.properties.action_link;
    console.log('Password setup URL generated:', passwordSetupUrl);

    // Send email using Resend API
    console.log('Sending invitation email to:', email);
    console.log('Using Resend API key (first 8 chars):', resendKey.substring(0, 8) + '...');
    
    const emailPayload = {
      from: 'ProSpaces Portal <info@portal.prospaces.co.uk>',
      to: [email],
      subject: 'Welcome to ProSpaces Portal - Your Account is Ready!',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ProSpaces Portal</title>
          <!--[if mso]>
          <noscript>
            <xml>
              <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
              </o:OfficeDocumentSettings>
            </xml>
          </noscript>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <!-- Main Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  
                  <!-- Header with Logo -->
                  <tr>
                    <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, hsl(178, 33%, 69%) 0%, hsl(178, 33%, 79%) 100%); border-radius: 12px 12px 0 0;">
                      <img src="https://preview--pro-spaces-client-portal.lovable.app/lovable-uploads/3add86aa-4857-42e8-9672-5ea09a594bb2.png" 
                           alt="ProSpaces Logo" 
                           width="180" 
                           height="auto" 
                           style="display: block; max-width: 180px; height: auto;">
                    </td>
                  </tr>
                  
                  <!-- Welcome Section -->
                  <tr>
                    <td style="padding: 40px 40px 0 40px;">
                      <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: 700; color: hsl(221, 20%, 20%); text-align: center; line-height: 1.2;">
                        Welcome to ProSpaces Portal
                      </h1>
                      <p style="margin: 0 0 20px 0; font-size: 18px; color: hsl(221, 20%, 30%); text-align: center; line-height: 1.4;">
                        Hi <strong>${full_name}</strong>,
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content Section -->
                  <tr>
                    <td style="padding: 0 40px;">
                      <div style="background-color: hsl(44, 39%, 95%); border-left: 4px solid hsl(178, 33%, 69%); padding: 20px; margin: 20px 0; border-radius: 8px;">
                        <p style="margin: 0; font-size: 16px; color: hsl(221, 20%, 30%); line-height: 1.5;">
                          You've been invited to join ProSpaces Portal with the role of <strong style="color: hsl(178, 33%, 40%);">${role}</strong>${region ? ` in the <strong>${region}</strong> region` : ''}.
                        </p>
                      </div>
                      
                       <p style="margin: 20px 0; font-size: 16px; color: hsl(221, 20%, 30%); line-height: 1.5; text-align: center;">
                         Your account has been created! Click the button below to set up your password and access your portal.
                       </p>
                    </td>
                  </tr>
                  
                  <!-- CTA Button -->
                  <tr>
                    <td align="center" style="padding: 30px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                           <td style="background: linear-gradient(135deg, hsl(178, 33%, 69%) 0%, hsl(178, 33%, 59%) 100%); border-radius: 8px; box-shadow: 0 4px 12px hsla(178, 33%, 69%, 0.3);">
                             <a href="${passwordSetupUrl}" 
                                style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; transition: all 0.3s ease;">
                               🔐 Set Up Your Password
                             </a>
                           </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Account Details -->
                  <tr>
                    <td style="padding: 0 40px 30px 40px;">
                      <div style="background-color: hsl(221, 20%, 98%); border: 1px solid hsl(221, 20%, 92%); border-radius: 8px; padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: hsl(221, 20%, 30%);">
                          📧 Your Account Details
                        </h3>
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: hsl(221, 20%, 40%);">
                          <strong>Email:</strong> ${email}
                        </p>
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: hsl(221, 20%, 40%);">
                          <strong>Role:</strong> ${role}
                        </p>
                        ${region ? `<p style="margin: 0; font-size: 14px; color: hsl(221, 20%, 40%);"><strong>Region:</strong> ${region}</p>` : ''}
                      </div>
                    </td>
                  </tr>
                  
                  <!-- What to Expect -->
                  <tr>
                    <td style="padding: 0 40px 30px 40px;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: hsl(221, 20%, 30%);">
                        🎯 What to Expect
                      </h3>
                      <ul style="margin: 0; padding-left: 20px; color: hsl(221, 20%, 40%); font-size: 14px; line-height: 1.6;">
                        <li style="margin-bottom: 8px;">Set up your secure password</li>
                        <li style="margin-bottom: 8px;">Access your personalized dashboard</li>
                        <li style="margin-bottom: 8px;">Manage projects and collaborate with your team</li>
                        <li style="margin-bottom: 0;">Get support from our dedicated team</li>
                      </ul>
                    </td>
                  </tr>
                  
                  <!-- Support Section -->
                  <tr>
                    <td style="padding: 0 40px 40px 40px;">
                      <div style="background: linear-gradient(135deg, hsl(328, 36%, 92%) 0%, hsl(328, 36%, 96%) 100%); border-radius: 8px; padding: 20px; text-align: center;">
                        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: hsl(221, 20%, 30%);">
                          💬 Need Help?
                        </h3>
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: hsl(221, 20%, 40%);">
                          Our support team is here to help you get started.
                        </p>
                        <a href="mailto:support@prospaces.co.uk" 
                           style="color: hsl(328, 36%, 50%); text-decoration: none; font-weight: 600; font-size: 14px;">
                          support@prospaces.co.uk
                        </a>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: hsl(221, 20%, 98%); border-radius: 0 0 12px 12px; border-top: 1px solid hsl(221, 20%, 92%);">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="center">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: hsl(221, 20%, 50%); line-height: 1.4;">
                              Best regards,<br>
                              <strong style="color: hsl(178, 33%, 40%);">The ProSpaces Team</strong>
                            </p>
                            <p style="margin: 0; font-size: 11px; color: hsl(221, 20%, 60%); line-height: 1.4;">
                              This email was sent to ${email}. If you have any questions, please contact our support team.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };
    
    console.log('Email payload:', JSON.stringify(emailPayload, null, 2));
    
    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      console.log('Email response status:', emailResponse.status);
      console.log('Email response headers:', Object.fromEntries(emailResponse.headers.entries()));
      
      const responseText = await emailResponse.text();
      console.log('Email response body:', responseText);

      if (emailResponse.status !== 200) {
        console.error('Email sending failed - Status:', emailResponse.status);
        console.error('Email sending failed - Response:', responseText);
        
        let errorMessage = 'Unknown error';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || responseText;
        } catch {
          errorMessage = responseText;
        }
        
        return new Response(
          JSON.stringify({ error: `Email failed (${emailResponse.status}): ${errorMessage}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Parse successful response
      let emailData;
      try {
        emailData = JSON.parse(responseText);
        console.log('Email sent successfully - Email ID:', emailData.id);
      } catch {
        console.log('Email sent successfully - Raw response:', responseText);
      }
      
    } catch (emailError: any) {
      console.error('Email sending exception:', emailError);
      return new Response(
        JSON.stringify({ error: `Email failed: ${emailError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User invited successfully');
    return new Response(
      JSON.stringify({ 
        success: true,
        message: isNewUser ? 'User created and invited successfully' : 'Existing user re-invited successfully',
        user_id: userId,
        is_new_user: isNewUser
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);