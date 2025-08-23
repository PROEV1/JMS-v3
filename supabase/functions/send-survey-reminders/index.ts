import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const siteUrl = Deno.env.get('SITE_URL') || 'https://qvppvstgconmzzjsryna.supabase.co';

    // Find orders that need survey reminders (created 48+ hours ago, no survey submitted)
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

    const { data: orders, error } = await supabaseClient
      .from('orders')
      .select(`
        id,
        order_number,
        survey_token,
        survey_required,
        created_at,
        clients!inner (
          id,
          full_name,
          email
        ),
        partners (
          id,
          name,
          logo_url
        )
      `)
      .eq('survey_required', true)
      .lt('created_at', twoDaysAgo.toISOString())
      .not('survey_token', 'is', null);

    if (error) {
      console.error('Failed to fetch orders for reminders:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No orders need survey reminders', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter orders that don't have submitted surveys
    const ordersNeedingReminders = [];
    
    for (const order of orders) {
      const { data: survey } = await supabaseClient
        .from('client_surveys')
        .select('id, status')
        .eq('order_id', order.id)
        .in('status', ['submitted', 'under_review', 'approved', 'resubmitted'])
        .single();

      if (!survey) {
        ordersNeedingReminders.push(order);
      }
    }

    console.log(`Found ${ordersNeedingReminders.length} orders needing survey reminders`);

    let successCount = 0;
    let errorCount = 0;

    // Send reminder emails
    for (const order of ordersNeedingReminders) {
      try {
        const surveyUrl = `${siteUrl}/survey/${order.id}?token=${order.survey_token}`;
        const partnerName = order.partners?.name || 'ProEV';
        
        const emailResult = await resend.emails.send({
          from: 'ProEV Support <noreply@proev.co.uk>',
          to: [order.clients.email],
          subject: `Reminder: Complete Your EV Charger Installation Survey - Order #${order.order_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #E30613; margin-bottom: 10px;">Survey Reminder</h1>
                <p style="color: #666; font-size: 16px;">Order #${order.order_number}</p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.5; color: #333;">
                Dear ${order.clients.full_name},
              </p>
              
              <p style="font-size: 16px; line-height: 1.5; color: #333;">
                This is a friendly reminder that we're still waiting for you to complete your property survey for your EV charger installation.
              </p>
              
              <p style="font-size: 16px; line-height: 1.5; color: #333;">
                The survey helps us understand your property setup and ensures we can provide the best installation service possible. It only takes a few minutes to complete.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${surveyUrl}" 
                   style="background-color: #E30613; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Complete Survey Now
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; text-align: center;">
                If you're unable to click the button, copy and paste this link into your browser:<br>
                <a href="${surveyUrl}" style="color: #E30613; word-break: break-all;">${surveyUrl}</a>
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                <p style="color: #666; font-size: 14px;">
                  Need help? Contact our support team or reply to this email.
                </p>
                <p style="color: #666; font-size: 12px;">
                  This email was sent by ${partnerName} via ProEV.
                </p>
              </div>
            </div>
          `,
        });

        if (emailResult.error) {
          console.error(`Failed to send reminder for order ${order.id}:`, emailResult.error);
          errorCount++;
        } else {
          console.log(`Sent survey reminder for order ${order.id}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error sending reminder for order ${order.id}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Survey reminders processed',
        total: ordersNeedingReminders.length,
        sent: successCount,
        failed: errorCount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Survey reminders error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})