import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1"
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface EmailRequest {
  orderId: string
  status: string
  clientEmail: string
  clientName: string
  orderNumber: string
  totalAmount?: number
  installDate?: string
  engineerName?: string
  productDetails?: string
}

// Email templates for different order statuses
const emailTemplates = {
  quote_accepted: {
    subject: 'Order Confirmed - Payment Required',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Order Confirmed!</h2>
        <p>Dear {{clientName}},</p>
        <p>Thank you for accepting your quote. Your order {{orderNumber}} has been confirmed.</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Total Amount:</strong> £{{totalAmount}}</p>
        </div>
        <p><strong>Next Steps:</strong> Please complete payment to proceed with installation scheduling.</p>
        <p>Best regards,<br>Pro EV Team</p>
      </div>
    `
  },
  payment_received: {
    subject: 'Payment Received - Installation Scheduling',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Payment Received!</h2>
        <p>Dear {{clientName}},</p>
        <p>We have successfully received your payment for order {{orderNumber}}.</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Amount Paid:</strong> £{{totalAmount}}</p>
          <p><strong>Payment Status:</strong> Confirmed</p>
        </div>
        <p><strong>Next Steps:</strong> Our team will contact you shortly to schedule your installation.</p>
        <p>Best regards,<br>Pro EV Team</p>
      </div>
    `
  },
  scheduled: {
    subject: 'Installation Scheduled',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Installation Scheduled!</h2>
        <p>Dear {{clientName}},</p>
        <p>Great news! Your installation has been scheduled.</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #faf5ff; border-radius: 8px;">
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Installation Date:</strong> {{installDate}}</p>
          <p><strong>Engineer:</strong> {{engineerName}}</p>
        </div>
        <p>Our engineer will contact you to confirm the exact time and any final details.</p>
        <p>Best regards,<br>Pro EV Team</p>
      </div>
    `
  },
  in_progress: {
    subject: 'Installation In Progress',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Installation Started!</h2>
        <p>Dear {{clientName}},</p>
        <p>Your installation is currently underway.</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #fffbeb; border-radius: 8px;">
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Engineer:</strong> {{engineerName}}</p>
          <p><strong>Status:</strong> Installation in progress</p>
        </div>
        <p>If you have any questions, please don't hesitate to contact your engineer.</p>
        <p>Best regards,<br>Pro EV Team</p>
      </div>
    `
  },
  completed: {
    subject: 'Installation Complete!',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Installation Complete!</h2>
        <p>Dear {{clientName}},</p>
        <p>Congratulations! Your installation has been completed successfully.</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #ecfdf5; border-radius: 8px;">
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Completed By:</strong> {{engineerName}}</p>
          <p><strong>Status:</strong> Installation complete</p>
        </div>
        <p>Thank you for choosing Pro EV. We hope you enjoy your new installation!</p>
        <p>Best regards,<br>Pro EV Team</p>
      </div>
    `
  },
  awaiting_agreement: {
    subject: 'Agreement Required - Next Steps',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Agreement Required</h2>
        <p>Dear {{clientName}},</p>
        <p>To proceed with your order {{orderNumber}}, we need you to review and sign the installation agreement.</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #fef2f2; border-radius: 8px;">
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Status:</strong> Awaiting Agreement</p>
        </div>
        <p>Please check your client portal or contact us to complete this step.</p>
        <p>Best regards,<br>Pro EV Team</p>
      </div>
    `
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Require Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No authorization header')
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client for auth verification
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is admin
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('User is not admin:', user.email, 'role:', profile?.role)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin user authenticated:', user.email)

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
      subject = `Installation Scheduled for ${installDate}`;
    }

    // Check if communications are suppressed
    const checkSuppression = async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'communication_suppression')
          .single();

        if (error || !data) return false;
        
        const settings = data.setting_value as Record<string, unknown>;
        return (
          settings.test_mode_active === true || 
          settings.suppress_status_emails === true ||
          settings.suppress_client_emails === true
        );
      } catch (error) {
        console.error('Error checking suppression settings:', error);
        return false;
      }
    };

    const isEmailSuppressed = await checkSuppression();

    if (isEmailSuppressed) {
      console.log('Status email sending is suppressed - logging email without sending');
      
      // Log the suppressed email for audit purposes
      await supabaseAdmin.rpc('log_order_activity', {
        p_order_id: emailData.orderId,
        p_activity_type: 'email_suppressed',
        p_description: `Status email suppressed - would have sent ${emailData.status} notification`,
        p_details: {
          status: emailData.status,
          would_have_sent_to: emailData.clientEmail,
          suppressed_at: new Date().toISOString(),
          suppressed_reason: 'Test mode - communications suppressed'
        }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          suppressed: true, 
          message: 'Email suppressed - test mode active' 
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Initialize Resend only when we need to send email and suppression is off
    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
    
    // Send the email if not suppressed
    let emailBody = template.body;
    
    // Replace template variables
    emailBody = emailBody.replace(/{{clientName}}/g, emailData.clientName);
    emailBody = emailBody.replace(/{{orderNumber}}/g, emailData.orderNumber);
    emailBody = emailBody.replace(/{{totalAmount}}/g, emailData.totalAmount?.toLocaleString() || '0');
    emailBody = emailBody.replace(/{{installDate}}/g, emailData.installDate || 'TBC');
    emailBody = emailBody.replace(/{{engineerName}}/g, emailData.engineerName || 'TBC');
    emailBody = emailBody.replace(/{{productDetails}}/g, emailData.productDetails || '');

    console.log('Sending email to:', emailData.clientEmail, 'Subject:', subject);

    const emailResponse = await resend.emails.send({
      from: 'Pro EV <no-reply@proev.co.uk>',
      to: [emailData.clientEmail],
      subject: subject,
      html: emailBody,
    });

    console.log('Email sent successfully:', emailResponse);

    // Log the email activity
    await supabaseAdmin.rpc('log_order_activity', {
      p_order_id: emailData.orderId,
      p_activity_type: 'email_sent',
      p_description: `Status email sent: ${emailData.status}`,
      p_details: {
        status: emailData.status,
        email_to: emailData.clientEmail,
        resend_id: emailResponse.data?.id,
        subject: subject
      }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully', messageId: emailResponse.data?.id }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in send-order-status-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);