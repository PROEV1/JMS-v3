import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { corsHeaders } from "../_shared/cors.ts";
import { Resend } from "npm:resend@2.0.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

interface SendRevisedQuoteRequest {
  quoteId: string;
  revisionReason: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse request body
    const { quoteId, revisionReason }: SendRevisedQuoteRequest = await req.json();

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'Missing quoteId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch quote with client details
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients!inner(
          id,
          full_name,
          email,
          user_id
        ),
        quote_items(
          id,
          quantity,
          unit_price,
          total_price,
          product:products(
            name,
            description
          )
        ),
        order:orders(
          id,
          order_number
        )
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      console.error('Quote fetch error:', quoteError);
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get previous quote snapshot for comparison
    const { data: previousSnapshot } = await supabase
      .from('order_quote_snapshots')
      .select('quote_data, created_at')
      .eq('order_id', quote.order?.id)
      .neq('quote_id', quoteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Calculate changes summary
    const currentTotal = quote.total_cost || 0;
    const previousTotal = previousSnapshot?.quote_data?.total_cost || 0;
    const totalDifference = currentTotal - previousTotal;

    // Create quote snapshot
    const { error: snapshotError } = await supabase
      .from('order_quote_snapshots')
      .insert({
        order_id: quote.order?.id,
        quote_id: quote.id,
        quote_data: {
          ...quote,
          quote_items: quote.quote_items
        },
        snapshot_type: 'revision',
        revision_reason: revisionReason,
        created_by: quote.client.user_id
      });

    if (snapshotError) {
      console.error('Snapshot creation error:', snapshotError);
    }

    // Update quote status to 'sent'
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ 
        status: 'sent',
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    if (updateError) {
      console.error('Quote update error:', updateError);
    }

    // Generate portal link
    const portalUrl = `https://qvppvstgconmzzjsryna.lovable.app/client/quotes/${quoteId}`;

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
      }).format(amount);
    };

    // Generate changes summary
    let changesHtml = '';
    if (previousSnapshot && totalDifference !== 0) {
      const changeType = totalDifference > 0 ? 'increased' : 'decreased';
      const changeAmount = Math.abs(totalDifference);
      
      changesHtml = `
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="color: #333; margin-top: 0;">Changes from Previous Quote</h3>
          <p style="color: #666; margin-bottom: 8px;">
            <strong>Reason:</strong> ${revisionReason}
          </p>
          <p style="color: #666; margin-bottom: 0;">
            <strong>Price Change:</strong> Your total has ${changeType} by ${formatCurrency(changeAmount)}
          </p>
        </div>
      `;
    }

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Revised Quote Available</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Your Revised Quote is Ready</h1>
          </div>
          
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
            <p style="margin-top: 0;">Hello ${quote.client.full_name},</p>
            
            <p>Based on your survey responses, we've prepared a revised quote for your installation. Our team has reviewed your requirements and identified some additional work that will be needed.</p>
            
            ${changesHtml}
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="color: #333; margin-top: 0;">Quote Summary</h3>
              <p style="margin: 4px 0;"><strong>Quote Number:</strong> ${quote.quote_number}</p>
              ${quote.order?.order_number ? `<p style="margin: 4px 0;"><strong>Order Number:</strong> ${quote.order.order_number}</p>` : ''}
              <p style="margin: 4px 0;"><strong>Total Amount:</strong> <span style="font-size: 18px; color: #059669;">${formatCurrency(currentTotal)}</span></p>
            </div>
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="${portalUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View & Accept Quote
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              You can review the full details, see exactly what's included and what's changed, and decide whether to proceed with the installation.
            </p>
            
            <p style="font-size: 14px; color: #666;">
              If you have any questions or would like to discuss the changes, please don't hesitate to reach out to our team.
            </p>
          </div>
          
          <div style="text-align: center; font-size: 12px; color: #666;">
            <p>This link will take you to your secure client portal where you can review and respond to your quote.</p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailResult = await resend.emails.send({
      from: 'ProEV <quotes@proev.co.uk>',
      to: [quote.client.email],
      subject: `Revised Quote Available - ${quote.quote_number}`,
      html: emailHtml,
    });

    if (emailResult.error) {
      console.error('Email send error:', emailResult.error);
      return new Response(JSON.stringify({ 
        error: 'Failed to send email',
        details: emailResult.error 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Revised quote email sent successfully:', emailResult);

    return new Response(JSON.stringify({ 
      success: true,
      emailId: emailResult.data?.id,
      portalUrl 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in send-revised-quote function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});