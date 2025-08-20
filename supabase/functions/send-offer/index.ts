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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
      .select(`
        *,
        engineer_availability(*)
      `)
      .eq('id', engineer_id)
      .single();

    if (engineerError || !engineer) {
      throw new Error('Engineer not found');
    }

    // Check if client has blocked this date
    const offeredDateOnly = new Date(offered_date).toISOString().split('T')[0];
    const { data: blockedDates, error: blockedDateError } = await supabase
      .from('client_blocked_dates')
      .select('blocked_date, reason')
      .eq('client_id', order.client_id)
      .eq('blocked_date', offeredDateOnly);

    if (blockedDateError) {
      console.error('Error checking blocked dates:', blockedDateError);
    } else if (blockedDates && blockedDates.length > 0) {
      console.log(`Date ${offeredDateOnly} is blocked for client ${order.client_id}: ${blockedDates[0].reason}`);
      throw new Error(`This date is not available: ${blockedDates[0].reason || 'Client unavailable'}`);
    }

    // Check engineer availability on offered date
    // Parse the date as local date to avoid timezone issues
    const offerDate = new Date(offered_date + (offered_date.includes('T') ? '' : 'T00:00:00'))
    const dayOfWeek = offerDate.getDay()
    
    console.log(`Checking availability for engineer ${engineer_id} on date ${offered_date}, parsed as ${offerDate.toISOString()}, day of week: ${dayOfWeek}`)
    
    const workingHour = engineer.engineer_availability?.find(
      (wh: any) => wh.day_of_week === dayOfWeek && wh.is_available
    )

    if (!workingHour) {
      throw new Error('Engineer not available on this day of the week');
    }

    // Check engineer's daily capacity including existing offers
    const dateStr = offerDate.toISOString().split('T')[0]
    
    // Check current workload with holds
    const { data: currentWorkload, error: workloadError } = await supabase
      .rpc('get_engineer_daily_workload_with_holds', {
        p_engineer_id: engineer_id,
        p_date: dateStr
      })

    if (workloadError) {
      console.error('Error checking engineer workload:', workloadError)
      throw new Error('Failed to check engineer capacity');
    }

    // Get scheduling settings for max jobs per day
    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'scheduling')
      .single()

    const maxJobsPerDay = settings?.setting_value?.maxJobsPerDay || 3

    if (currentWorkload >= maxJobsPerDay) {
      throw new Error(`Engineer at capacity (${currentWorkload}/${maxJobsPerDay} jobs on this date)`);
    }

    // Check if engineer's working day would be exceeded
    const { data: currentTimeMinutes, error: timeError } = await supabase
      .rpc('get_engineer_daily_time_with_holds', {
        p_engineer_id: engineer_id,
        p_date: dateStr
      })

    if (!timeError && currentTimeMinutes !== null) {
      // Calculate work day duration
      const startTime = workingHour.start_time.split(':').map(Number)
      const endTime = workingHour.end_time.split(':').map(Number)
      const workDayMinutes = (endTime[0] * 60 + endTime[1]) - (startTime[0] * 60 + startTime[1])
      
      // Add estimated duration for this new job
      const jobDurationMinutes = (order.estimated_duration_hours || 3) * 60
      const totalWithNewJob = currentTimeMinutes + jobDurationMinutes
      
      // Allow 15 minutes leniency
      if (totalWithNewJob > workDayMinutes + 15) {
        const overage = totalWithNewJob - workDayMinutes
        throw new Error(`Would exceed working hours by ${Math.floor(overage / 60)}h ${overage % 60}m`);
      }
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

    // Generate offer URL - use the app base URL from config or fallback to current domain
    const appBaseUrl = offerConfig.app_base_url || 'https://proev-installers.lovable.app';
    const offerUrl = `${appBaseUrl}/offers/${clientToken}`;

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

    // Check if communications are suppressed
    const checkSuppression = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'communication_suppression')
          .single();

        if (error || !data) return false;
        
        const settings = data.setting_value as Record<string, unknown>;
        return (
          settings.test_mode_active === true || 
          settings.suppress_offer_emails === true ||
          settings.suppress_client_emails === true
        );
      } catch (error) {
        console.error('Error checking suppression settings:', error);
        return false;
      }
    };

    const isEmailSuppressed = await checkSuppression();

    let deliveryDetails = {
      ...(jobOffer.delivery_details || {}),
      sent_at: new Date().toISOString()
    };

    if (isEmailSuppressed) {
      console.log('Email sending is suppressed - logging offer email without sending');
      
      // Log the suppressed email for audit purposes
      deliveryDetails = {
        ...deliveryDetails,
        email_suppressed: true,
        suppressed_at: new Date().toISOString(),
        suppressed_reason: 'Test mode - communications suppressed',
        would_have_sent_to: order.client.email
      };

      // Update job offer with suppression details
      await supabase
        .from('job_offers')
        .update({ delivery_details: deliveryDetails })
        .eq('id', jobOffer.id);

    } else {
      // Send via email (primary channel)
      if (delivery_channel === 'email' || offerConfig.auto_fallback_email) {
        let emailSent = false;

        // Try primary email address first
        const primaryFromAddress = offerConfig.from_address || 'ProEV Scheduling <no-reply@proev.co.uk>';
        
        try {
          console.log('Sending email offer to:', order.client.email, 'from:', primaryFromAddress, 'with URL:', offerUrl);
          
          const emailResponse = await resend.emails.send({
            from: primaryFromAddress,
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

          console.log('Email sent successfully to:', order.client.email, 'Message ID:', emailResponse.data?.id);
          emailSent = true;
          
          deliveryDetails = {
            ...deliveryDetails,
            email_sent: true,
            resend_message_id: emailResponse.data?.id,
            primary_sender: primaryFromAddress,
            fallback_used: false
          };

        } catch (primaryError) {
          console.error('Primary email send failed:', primaryError);
          console.log('Attempting fallback with onboarding@resend.dev');
          
          // Try fallback email address
          try {
            const fallbackResponse = await resend.emails.send({
              from: 'ProEV Scheduling <onboarding@resend.dev>',
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

            console.log('Fallback email sent successfully to:', order.client.email, 'Message ID:', fallbackResponse.data?.id);
            emailSent = true;
            
            deliveryDetails = {
              ...deliveryDetails,
              email_sent: true,
              resend_message_id: fallbackResponse.data?.id,
              primary_sender: primaryFromAddress,
              primary_error: primaryError.message,
              fallback_used: true,
              fallback_sender: 'onboarding@resend.dev'
            };

          } catch (fallbackError) {
            console.error('Fallback email send also failed:', fallbackError);
            
            deliveryDetails = {
              ...deliveryDetails,
              email_sent: false,
              primary_sender: primaryFromAddress,
              primary_error: primaryError.message,
              fallback_used: true,
              fallback_error: fallbackError.message
            };

            if (delivery_channel === 'email') {
              throw new Error(`Failed to send email offer: Primary (${primaryError.message}), Fallback (${fallbackError.message})`);
            }
          }
        }

        // Update job offer with delivery details
        await supabase
          .from('job_offers')
          .update({ delivery_details: deliveryDetails })
          .eq('id', jobOffer.id);
      }
    }

    // Update order with engineer assignment and set status to date_offered
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        engineer_id: engineer_id,
        status_enhanced: 'date_offered'
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order with engineer assignment:', updateError);
      // Don't fail the whole request, just log the error
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
        client_token: clientToken,
        email_suppressed: isEmailSuppressed
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        job_offer_id: jobOffer.id,
        expires_at: expiresAt.toISOString(),
        offer_url: offerUrl,
        email_suppressed: isEmailSuppressed
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