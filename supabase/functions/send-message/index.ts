
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Client with user's token for validation
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('User authentication failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing message from user:', user.id)

    // Get message data from request
    const { content, clientId, quoteId, projectId } = await req.json()

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Message content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile to determine role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine client_id and recipient email based on sender role
    let messageClientId = null
    let recipientEmail = null
    let senderName = profile.full_name || user.email

    if (profile.role === 'admin') {
      // Admin is sending message - clientId is required
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'Client ID is required for admin messages' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      messageClientId = clientId
      
      // Get client email for notification
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('full_name, email')
        .eq('id', clientId)
        .single()

      if (client) {
        recipientEmail = client.email
      }
    } else {
      // Client is sending message - look up their client record
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, full_name, email')
        .eq('user_id', user.id)
        .single()

      if (!client) {
        return new Response(
          JSON.stringify({ error: 'Client record not found for user' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      messageClientId = client.id
      senderName = client.full_name || client.email
      // Send to admin email
      recipientEmail = 'paul@proev.co.uk'
    }

    // Ensure we have a client_id at this point
    if (!messageClientId) {
      return new Response(
        JSON.stringify({ error: 'Unable to determine client context for message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert message into database with client_id
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: user.id,
        sender_role: profile.role,
        content: content,
        client_id: messageClientId,
        quote_id: quoteId || null,
        project_id: projectId || null,
        status: 'sent'
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error inserting message:', messageError)
      return new Response(
        JSON.stringify({ error: 'Failed to save message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Message saved successfully:', message.id)

    // Send email notification if recipient email is available
    if (recipientEmail) {
      const emailSubject = profile.role === 'admin' 
        ? `New message from ProSpaces Team`
        : `New message from ${senderName}`

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            ProSpaces Message
          </h2>
          
          <p><strong>From:</strong> ${senderName}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Message:</h3>
            <p style="white-space: pre-wrap;">${content}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('SUPABASE_URL').replace('supabase.co', 'lovable.app')}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View in ProSpaces Dashboard
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            This message was sent through the ProSpaces client management system.
          </p>
        </div>
      `

      try {
        const emailResponse = await resend.emails.send({
          from: "ProSpaces <onboarding@resend.dev>",
          to: [recipientEmail],
          subject: emailSubject,
          html: emailBody,
        })

        console.log('Email notification sent successfully:', emailResponse)
      } catch (emailError) {
        console.error('Error sending email notification:', emailError)
        // Don't fail the entire request if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: message,
        messageId: message.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-message function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
