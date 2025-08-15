import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletionNotificationRequest {
  orderId: string;
  engineerName: string;
  orderNumber: string;
  clientName: string;
  jobAddress: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      orderId, 
      engineerName, 
      orderNumber, 
      clientName, 
      jobAddress 
    }: CompletionNotificationRequest = await req.json();

    console.log('Processing completion notification:', { orderId, engineerName, orderNumber });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Get admin users to notify
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'admin')
      .eq('status', 'active');

    if (adminError) {
      console.error('Error fetching admin users:', adminError);
      throw adminError;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log('No admin users found to notify');
      return new Response(
        JSON.stringify({ message: 'No admin users to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send notification emails to all admins
    const emailPromises = adminUsers.map(async (admin) => {
      const emailResponse = await resend.emails.send({
        from: "ProSpaces Portal <info@portal.prospaces.co.uk>",
        to: [admin.email],
        subject: `🎉 Installation Complete - ${orderNumber}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Installation Complete</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding: 20px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                      <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, hsl(178, 33%, 69%) 0%, hsl(178, 33%, 79%) 100%); border-radius: 12px 12px 0 0;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: white; text-align: center;">
                          🎉 Installation Complete!
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: hsl(221, 20%, 20%);">
                          Hello ${admin.full_name || 'Admin'},
                        </h2>
                        
                        <p style="margin: 0 0 20px 0; font-size: 16px; color: hsl(221, 20%, 30%); line-height: 1.5;">
                          Great news! An installation has been completed and signed off by the engineer.
                        </p>
                        
                        <div style="background-color: hsl(122, 20%, 95%); border-left: 4px solid hsl(122, 39%, 49%); padding: 20px; margin: 20px 0; border-radius: 8px;">
                          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: hsl(122, 39%, 29%);">
                            📋 Job Details
                          </h3>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: hsl(122, 20%, 30%);">
                            <strong>Order:</strong> ${orderNumber}
                          </p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: hsl(122, 20%, 30%);">
                            <strong>Client:</strong> ${clientName}
                          </p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: hsl(122, 20%, 30%);">
                            <strong>Address:</strong> ${jobAddress}
                          </p>
                          <p style="margin: 0; font-size: 14px; color: hsl(122, 20%, 30%);">
                            <strong>Engineer:</strong> ${engineerName}
                          </p>
                        </div>
                        
                        <p style="margin: 20px 0; font-size: 16px; color: hsl(221, 20%, 30%); line-height: 1.5;">
                          The engineer has completed the installation checklist and uploaded all required documentation. You can now review the job details and process final payment if applicable.
                        </p>
                        
                        <!-- CTA Button -->
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="https://preview--pro-spaces-client-portal.lovable.app/admin/orders/${orderId}" 
                             style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, hsl(178, 33%, 69%) 0%, hsl(178, 33%, 59%) 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 4px 12px hsla(178, 33%, 69%, 0.3);">
                            📊 View Order Details
                          </a>
                        </div>
                        
                        <p style="margin: 20px 0 0 0; font-size: 14px; color: hsl(221, 20%, 50%); line-height: 1.4;">
                          Best regards,<br>
                          <strong style="color: hsl(178, 33%, 40%);">ProSpaces Portal</strong>
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });

      console.log(`Notification sent to ${admin.email}:`, emailResponse);
      return emailResponse;
    });

    await Promise.all(emailPromises);

    console.log('All completion notifications sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Completion notifications sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error sending completion notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);