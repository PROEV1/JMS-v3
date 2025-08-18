import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

interface SendOfferRequest {
  order_id: string;
  engineer_id: string;
  offered_date: string;
  time_window?: string;
  delivery_channel?: 'email' | 'sms' | 'whatsapp';
  custom_message?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      order_id, 
      engineer_id, 
      offered_date, 
      time_window,
      delivery_channel = 'email',
      custom_message
    }: SendOfferRequest = await req.json();

    console.log('Sending offer for order:', order_id);

    // Get order and client details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        quote:quotes(*)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Get engineer details
    const { data: engineer, error: engineerError } = await supabase
      .from('engineers')
      .select('*')
      .eq('id', engineer_id)
      .single();

    if (engineerError || !engineer) {
      throw new Error('Engineer not found');
    }

    // Get offer configuration
    const { data: config, error: configError } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'offer_config')
      .single();

    if (configError) {
      throw new Error('Offer configuration not found');
    }

    const offerConfig = config.setting_value;
    const ttlHours = offerConfig.default_ttl_hours || 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    // Generate secure client token
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_client_token');

    if (tokenError || !tokenData) {
      throw new Error('Failed to generate client token');
    }

    const clientToken = tokenData;

    // Create job offer record
    const { data: jobOffer, error: offerError } = await supabase
      .from('job_offers')
      .insert({
        order_id,
        engineer_id,
        offered_date,
        time_window,
        expires_at: expiresAt.toISOString(),
        client_token: clientToken,
        delivery_channel,
        delivery_details: {
          sent_at: new Date().toISOString(),
          custom_message
        }
      })
      .select()
      .single();

    if (offerError || !jobOffer) {
      throw new Error('Failed to create job offer: ' + offerError?.message);
    }

    // Generate offer URL
    const offerUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/offer/${clientToken}`;

    // Prepare message content
    const templateData = {
      order_number: order.order_number,
      offered_date: new Date(offered_date).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      engineer_name: engineer.name,
      offer_url: offerUrl,
      time_window: time_window || 'To be confirmed'
    };

    let messageContent = custom_message || offerConfig.templates?.email_body || 
      'We have an installation slot available for your order {{order_number}} on {{offered_date}} with engineer {{engineer_name}}. Please click the link to accept or reject: {{offer_url}}';

    // Replace template variables
    Object.entries(templateData).forEach(([key, value]) => {
      messageContent = messageContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Send via email (primary channel)
    if (delivery_channel === 'email' || offerConfig.auto_fallback_email) {
      try {
        await resend.emails.send({
          from: 'ProEV Scheduling <no-reply@proev.co.uk>',
          to: [order.client.email],
          subject: `Installation Date Offered - ${order.order_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Installation Slot Available</h2>
              <p>Dear ${order.client.full_name},</p>
              <p>${messageContent}</p>
              <div style="margin: 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                <p><strong>Order:</strong> ${order.order_number}</p>
                <p><strong>Proposed Date:</strong> ${templateData.offered_date}</p>
                <p><strong>Engineer:</strong> ${engineer.name}</p>
                <p><strong>Time Window:</strong> ${templateData.time_window}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${offerUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Accept or Reject Offer
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                This offer expires at ${expiresAt.toLocaleString('en-GB')}
              </p>
            </div>
          `
        });

        console.log('Email sent successfully to:', order.client.email);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        if (delivery_channel === 'email') {
          throw new Error('Failed to send email offer');
        }
      }
    }

    // Log activity
    await supabase.rpc('log_order_activity', {
      p_order_id: order_id,
      p_activity_type: 'offer_sent',
      p_description: `Installation offer sent for ${templateData.offered_date} with ${engineer.name}`,
      p_details: {
        engineer_id,
        offered_date,
        time_window,
        expires_at: expiresAt.toISOString(),
        delivery_channel,
        client_token: clientToken
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        job_offer_id: jobOffer.id,
        expires_at: expiresAt.toISOString(),
        offer_url: offerUrl
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in send-offer function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});