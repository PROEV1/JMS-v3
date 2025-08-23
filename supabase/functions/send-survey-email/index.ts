import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SurveyEmailRequest {
  orderId: string
  clientEmail: string
  clientName: string
  orderNumber: string
  isPartnerJob?: boolean
  partnerId?: string
  surveyToken?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, clientEmail, clientName, orderNumber, isPartnerJob, partnerId, surveyToken }: SurveyEmailRequest = await req.json()

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    // Initialize Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get partner branding if this is a partner job
    let partnerData = null
    if (isPartnerJob && partnerId) {
      const { data: partner } = await supabaseClient
        .from('partners')
        .select('name, logo_url, primary_color')
        .eq('id', partnerId)
        .single()
      
      partnerData = partner
    }

    // Generate survey URL
    const baseUrl = Deno.env.get('SITE_URL') || 'https://app.proev.co.uk'
    const surveyUrl = `${baseUrl}/survey/${orderId}${surveyToken ? `?token=${surveyToken}` : ''}`

    // Prepare email content
    const subject = `${partnerData ? `${partnerData.name} + ` : ''}ProEV Installation Survey - Order ${orderNumber}`
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Installation Survey</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .brand-bar { height: 4px; background: ${partnerData?.primary_color || '#E30613'}; margin-bottom: 20px; }
          .logos { display: flex; justify-content: ${partnerData ? 'space-between' : 'center'}; align-items: center; }
          .content { margin: 30px 0; }
          .cta-button { display: inline-block; background: #E30613; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand-bar"></div>
          
          <div class="header">
            <div class="logos">
              ${partnerData ? `<img src="${partnerData.logo_url}" alt="${partnerData.name}" style="height: 40px;">` : ''}
              <img src="${baseUrl}/prospace-logo.png" alt="ProEV" style="height: 40px;">
            </div>
          </div>

          <div class="content">
            <h1>Complete Your Installation Survey</h1>
            
            <p>Hi ${clientName},</p>
            
            <p>Thank you for choosing ${partnerData ? partnerData.name + ' and ' : ''}ProEV for your EV charger installation (Order #${orderNumber}).</p>
            
            <p>Before we can schedule your installation, we need you to complete a quick survey about your property. This helps our engineers prepare for your installation and ensures everything goes smoothly.</p>
            
            <p><strong>The survey takes approximately 8-10 minutes</strong> and includes:</p>
            <ul>
              <li>Property details and parking arrangements</li>
              <li>Photos of your preferred charger location</li>
              <li>Photos of your consumer unit/fuse box</li>
              <li>Optional short video walkthrough</li>
            </ul>
            
            <p>You can save your progress and return later if needed.</p>
            
            <p style="text-align: center;">
              <a href="${surveyUrl}" class="cta-button">Start Survey</a>
            </p>
            
            <p><strong>Important:</strong> Please complete this survey within the next 48 hours to avoid any delays to your installation.</p>
            
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br>
            The ${partnerData ? partnerData.name + ' + ' : ''}ProEV Team</p>
          </div>

          <div class="footer">
            <p>This email was sent regarding your EV charger installation order #${orderNumber}.</p>
            <p>Survey link: <a href="${surveyUrl}">${surveyUrl}</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: 'ProEV <noreply@proev.co.uk>',
      to: [clientEmail],
      subject: subject,
      html: emailHtml,
    })

    if (!emailResponse.data) {
      throw new Error(`Email send failed: ${emailResponse.error?.message || 'Unknown error'}`)
    }

    console.log(`Survey email sent to ${clientEmail} for order ${orderNumber}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Survey email sent successfully',
        surveyUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error sending survey email:', error)
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