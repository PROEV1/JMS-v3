import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SurveyReworkEmailRequest {
  orderId: string
  surveyId: string
  reworkReason: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, surveyId, reworkReason }: SurveyReworkEmailRequest = await req.json()

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    
    // Get order and client details
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: orderData } = await supabaseClient
      .from('orders')
      .select(`
        order_number,
        is_partner_job,
        partner_id,
        clients!inner (
          full_name,
          email
        ),
        partners (
          name,
          logo_url,
          primary_color
        )
      `)
      .eq('id', orderId)
      .single()

    if (!orderData) {
      throw new Error('Order not found')
    }

    const client = orderData.clients
    const partner = orderData.partners
    const baseUrl = Deno.env.get('SITE_URL') || 'https://app.proev.co.uk'
    const surveyUrl = `${baseUrl}/survey/${orderId}`

    const subject = `${partner ? `${partner.name} + ` : ''}ProEV Survey Rework Required - Order ${orderData.order_number}`
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Survey Rework Required</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .brand-bar { height: 4px; background: ${partner?.primary_color || '#E30613'}; margin-bottom: 20px; }
          .logos { display: flex; justify-content: ${partner ? 'space-between' : 'center'}; align-items: center; }
          .content { margin: 30px 0; }
          .cta-button { display: inline-block; background: #E30613; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .rework-section { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand-bar"></div>
          
          <div class="header">
            <div class="logos">
              ${partner ? `<img src="${partner.logo_url}" alt="${partner.name}" style="height: 40px;">` : ''}
              <img src="${baseUrl}/prospace-logo.png" alt="ProEV" style="height: 40px;">
            </div>
          </div>

          <div class="content">
            <h1>Survey Rework Required</h1>
            
            <p>Hi ${client.full_name},</p>
            
            <p>Thank you for submitting your installation survey for order #${orderData.order_number}. Our team has reviewed your submission and we need some additional information or modifications.</p>
            
            <div class="rework-section">
              <h3 style="margin-top: 0; color: #92400e;">What needs to be updated:</h3>
              <p style="margin-bottom: 0;">${reworkReason}</p>
            </div>
            
            <p>Please click the link below to resume your survey and make the necessary changes. Your previous responses have been saved, so you only need to update the areas mentioned above.</p>
            
            <p style="text-align: center;">
              <a href="${surveyUrl}" class="cta-button">Resume Survey</a>
            </p>
            
            <p><strong>What you need to do:</strong></p>
            <ul>
              <li>Review the feedback above</li>
              <li>Make the necessary updates to your survey</li>
              <li>Submit your revised survey for review</li>
            </ul>
            
            <p>If you have any questions about the requested changes, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br>
            The ${partner ? partner.name + ' + ' : ''}ProEV Team</p>
          </div>

          <div class="footer">
            <p>This email was sent regarding your EV charger installation survey for order #${orderData.order_number}.</p>
            <p>Resume survey: <a href="${surveyUrl}">${surveyUrl}</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    const emailResponse = await resend.emails.send({
      from: 'ProEV <noreply@proev.co.uk>',
      to: [client.email],
      subject: subject,
      html: emailHtml,
    })

    console.log(`Survey rework email sent to ${client.email} for order ${orderData.order_number}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Survey rework email sent successfully',
        emailId: emailResponse.data?.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error sending survey rework email:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})