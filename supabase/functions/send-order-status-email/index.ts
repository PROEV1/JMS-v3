import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  orderId: string;
  status: string;
  clientEmail: string;
  clientName: string;
  orderNumber: string;
  installDate?: string;
  engineerName?: string;
}

const emailTemplates = {
  quote_accepted: {
    subject: "Thanks – we've received your order",
    template: (data: EmailRequest) => `
      <h1>Thank you for your order, ${data.clientName}!</h1>
      <p>We've received your order <strong>${data.orderNumber}</strong> and we're excited to get started.</p>
      <h2>What happens next?</h2>
      <ul>
        <li>Complete your payment to secure your installation slot</li>
        <li>Review and sign the installation agreement</li>
        <li>Choose your preferred installation dates</li>
        <li>We'll schedule and complete your installation</li>
      </ul>
      <p><a href="${Deno.env.get('SUPABASE_URL')}/client" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Your Order</a></p>
      <p>Best regards,<br>The ProSpaces Team</p>
    `
  },
  
  payment_received: {
    subject: "Payment Received – Next Step: Sign Agreement",
    template: (data: EmailRequest) => `
      <h1>Payment Confirmed!</h1>
      <p>Hi ${data.clientName},</p>
      <p>We've received your payment for order <strong>${data.orderNumber}</strong>. Thank you!</p>
      <h2>Next Step: Sign Your Agreement</h2>
      <p>Please review and sign your installation agreement to move forward with scheduling.</p>
      <p><a href="${Deno.env.get('SUPABASE_URL')}/client" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Sign Agreement</a></p>
      <p>Best regards,<br>The ProSpaces Team</p>
    `
  },
  
  agreement_signed: {
    subject: "Thanks – Final Step: Choose Install Date",
    template: (data: EmailRequest) => `
      <h1>Agreement Signed Successfully!</h1>
      <p>Hi ${data.clientName},</p>
      <p>Thank you for signing your installation agreement for order <strong>${data.orderNumber}</strong>.</p>
      <h2>Final Step: Installation Preferences</h2>
      <p>Please let us know your preferred installation dates and we'll schedule your appointment with one of our expert engineers.</p>
      <p><a href="${Deno.env.get('SUPABASE_URL')}/client" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Submit Preferences</a></p>
      <p>Best regards,<br>The ProSpaces Team</p>
    `
  },
  
  scheduled: {
    subject: `Installation Confirmed for ${new Date().toLocaleDateString()}`,
    template: (data: EmailRequest) => `
      <h1>Your Installation is Confirmed! 🎉</h1>
      <p>Hi ${data.clientName},</p>
      <p>Great news! Your installation for order <strong>${data.orderNumber}</strong> has been scheduled.</p>
      <h2>Installation Details:</h2>
      <ul>
        <li><strong>Date:</strong> ${data.installDate ? new Date(data.installDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBC'}</li>
        ${data.engineerName ? `<li><strong>Engineer:</strong> ${data.engineerName}</li>` : ''}
        <li><strong>What to expect:</strong> Professional installation of your under-stairs storage solution</li>
      </ul>
      <h2>Before Your Installation:</h2>
      <ul>
        <li>Ensure the area is clear and accessible</li>
        <li>Remove any items from under your stairs</li>
        <li>Ensure adequate lighting in the area</li>
      </ul>
      <p><a href="${Deno.env.get('SUPABASE_URL')}/client" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Installation Details</a></p>
      <p>Best regards,<br>The ProSpaces Team</p>
    `
  },
  
  completed: {
    subject: "Your Installation is Complete 🎉",
    template: (data: EmailRequest) => `
      <h1>Installation Complete!</h1>
      <p>Hi ${data.clientName},</p>
      <p>Congratulations! Your under-stairs storage installation for order <strong>${data.orderNumber}</strong> is now complete.</p>
      <h2>Your Warranty is Now Active</h2>
      <p>Your 5-year warranty period has begun. We're confident you'll love your new storage solution!</p>
      <h2>Need Support?</h2>
      <p>If you have any questions or need assistance, we're here to help:</p>
      <ul>
        <li>Email: support@prospaces.co.uk</li>
        <li>Phone: 01234 567890</li>
      </ul>
      <h2>Leave a Review</h2>
      <p>We'd love to hear about your experience! Please consider leaving us a review.</p>
      <p><a href="${Deno.env.get('SUPABASE_URL')}/client" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Completed Order</a></p>
      <p>Thank you for choosing ProSpaces!</p>
      <p>Best regards,<br>The ProSpaces Team</p>
    `
  },
  
  revisit_required: {
    subject: "We're Following Up on Your Installation",
    template: (data: EmailRequest) => `
      <h1>Installation Follow-Up Required</h1>
      <p>Hi ${data.clientName},</p>
      <p>We need to follow up on your installation for order <strong>${data.orderNumber}</strong>.</p>
      <p>Our team will be in touch shortly to discuss the next steps and ensure everything meets our high standards.</p>
      <p>If you have any immediate concerns, please don't hesitate to contact us:</p>
      <ul>
        <li>Email: support@prospaces.co.uk</li>
        <li>Phone: 01234 567890</li>
      </ul>
      <p><a href="${Deno.env.get('SUPABASE_URL')}/client" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Your Order</a></p>
      <p>Best regards,<br>The ProSpaces Team</p>
    `
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: EmailRequest = await req.json();
    
    console.log('Sending email for status:', emailData.status);
    
    const template = emailTemplates[emailData.status as keyof typeof emailTemplates];
    if (!template) {
      throw new Error(`No email template found for status: ${emailData.status}`);
    }

    // Update subject for scheduled emails with actual date
    let subject = template.subject;
    if (emailData.status === 'scheduled' && emailData.installDate) {
      const installDate = new Date(emailData.installDate).toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
      subject = `Installation Confirmed for ${installDate}`;
    }

    const emailResponse = await resend.emails.send({
      from: "ProSpaces <orders@prospaces.co.uk>",
      to: [emailData.clientEmail],
      subject: subject,
      html: template.template(emailData),
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email sending in the order activity
    await supabase.rpc('log_order_activity', {
      p_order_id: emailData.orderId,
      p_activity_type: 'email_sent',
      p_description: `Email sent: ${subject}`,
      p_details: {
        email_type: emailData.status,
        recipient: emailData.clientEmail,
        subject: subject
      }
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-order-status-email function:", error);
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