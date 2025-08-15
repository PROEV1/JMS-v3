import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClientInviteRequest {
  clientId: string;
  clientName: string;
  clientEmail: string;
  temporaryPassword: string;
  siteUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, clientName, clientEmail, temporaryPassword, siteUrl }: ClientInviteRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "ProSpaces <onboarding@resend.dev>",
      to: [clientEmail],
      subject: "Welcome to ProSpaces - Your Account Details",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            Welcome to ProSpaces
          </h1>
          
          <p>Hello ${clientName},</p>
          
          <p>Your ProSpaces client account has been created. You can now access your personalized dashboard to view quotes, projects, and communicate with our team.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Your Login Details:</h3>
            <p><strong>Email:</strong> ${clientEmail}</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            <p style="color: #dc2626; font-size: 14px;">
              <em>Please change your password after your first login for security.</em>
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}/auth" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Access Your Dashboard
            </a>
          </div>
          
          <p>Once logged in, you'll be able to:</p>
          <ul>
            <li>View and respond to quotes</li>
            <li>Track project progress</li>
            <li>Upload and download project files</li>
            <li>Communicate with our team</li>
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>The ProSpaces Team</p>
          
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280; text-align: center;">
            This email was sent to ${clientEmail}. If you received this in error, please contact us.
          </p>
        </div>
      `,
    });

    console.log("Client invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-client-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);