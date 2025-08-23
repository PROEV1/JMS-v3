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
  temporaryPassword?: string;
  siteUrl: string;
  companyName?: string;
  companyLogoUrl?: string;
  partnerName?: string;
  partnerLogoUrl?: string;
  nextSteps?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      clientId, 
      clientName, 
      clientEmail, 
      temporaryPassword, 
      siteUrl,
      companyName = "Pro EV",
      companyLogoUrl,
      partnerName = "ProSpace", 
      partnerLogoUrl,
      nextSteps = [
        "Log in to your dashboard",
        "Change your password for security",
        "Review and update your profile & address",
        "Expect project updates via email and dashboard"
      ]
    }: ClientInviteRequest = await req.json();

    const logoSection = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 30px; padding: 20px; border-bottom: 2px solid #e6004e;">
        ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName}" style="height: 50px; max-width: 150px;">` : `<h2 style="margin: 0; color: #e6004e; font-size: 24px;">${companyName}</h2>`}
        ${partnerLogoUrl ? `<img src="${partnerLogoUrl}" alt="${partnerName}" style="height: 50px; max-width: 150px;">` : `<h2 style="margin: 0; color: #666; font-size: 24px;">${partnerName}</h2>`}
      </div>
    `;

    const loginSection = temporaryPassword ? `
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">Your Login Details:</h3>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        <p style="color: #dc2626; font-size: 14px;">
          <em>Please change your password after your first login for security.</em>
        </p>
      </div>
    ` : `
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">Get Started:</h3>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p>You'll need to <a href="${siteUrl}/reset-password" style="color: #e6004e;">set your password</a> before accessing your dashboard.</p>
      </div>
    `;

    const nextStepsList = nextSteps.map(step => `<li>${step}</li>`).join('');

    const emailResponse = await resend.emails.send({
      from: "Pro EV <onboarding@resend.dev>",
      to: [clientEmail],
      subject: `Welcome to ${companyName} - Your Account Details`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${logoSection}
          
          <p>Hello ${clientName},</p>
          
          <p>Your client account has been created in partnership with ${companyName} and ${partnerName}. You can now access your personalized dashboard to view quotes, projects, and communicate with our team.</p>
          
          ${loginSection}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}/auth" 
               style="background-color: #e6004e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Access Your Dashboard
            </a>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ul>
            ${nextStepsList}
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>The ${companyName} Team</p>
          
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