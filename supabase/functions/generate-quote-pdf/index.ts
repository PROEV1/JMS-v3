import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received request body:', body)
    
    const { quoteId, type } = body

    if (!quoteId) {
      console.error('Missing quoteId in request body:', body)
      throw new Error('Quote ID is required')
    }

    // Initialize Supabase client with service role for storage operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch quote details with related data
    console.log('Fetching quote with ID:', quoteId)
    
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select(`
        *,
        client:clients(*),
        quote_items(
          *,
          product:products(
            *,
            images:product_images(*)
          )
        )
      `)
      .eq('id', quoteId)
      .single()

    console.log('Quote fetch result:', { quote, quoteError })

    if (quoteError) {
      console.error('Quote fetch error:', quoteError)
      throw quoteError
    }

    if (!quote) {
      console.error('No quote found with ID:', quoteId)
      throw new Error('Quote not found')
    }

    // Generate HTML content for PDF
    const htmlContent = generateQuoteHTML(quote)

    // Instead of storing and redirecting, return the HTML directly
    // This ensures proper content-type handling
    return new Response(htmlContent, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
      status: 200,
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate PDF' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

function generateQuoteHTML(quote: any): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB')
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Quote ${quote.quote_number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .quote-info {
            text-align: right;
        }
        .quote-number {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .quote-date {
            color: #666;
        }
        .client-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .client-info h3 {
            margin-top: 0;
            color: #007bff;
        }
        .items-section {
            margin-bottom: 30px;
        }
        .item {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }
        .item-header {
            background: #f8f9fa;
            padding: 15px;
            border-bottom: 1px solid #ddd;
        }
        .item-content {
            padding: 15px;
        }
        .item-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .item-description {
            color: #666;
            margin-bottom: 15px;
        }
        .configuration {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
        }
        .configuration h4 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #007bff;
        }
        .config-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 14px;
        }
        .pricing-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .pricing-table td {
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        .pricing-table .label {
            font-weight: 500;
        }
        .pricing-table .amount {
            text-align: right;
            font-weight: bold;
        }
        .total-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
        .total-table {
            width: 100%;
            border-collapse: collapse;
        }
        .total-table td {
            padding: 10px 0;
            border-bottom: 1px solid #ddd;
        }
        .total-table .final-total {
            font-size: 18px;
            font-weight: bold;
            color: #007bff;
            border-top: 2px solid #007bff;
            padding-top: 15px;
        }
        .included-section {
            margin-top: 30px;
            background: #e8f5e8;
            padding: 20px;
            border-radius: 8px;
        }
        .included-section h3 {
            color: #28a745;
            margin-top: 0;
        }
        .included-list {
            list-style: none;
            padding: 0;
        }
        .included-list li {
            margin-bottom: 8px;
            position: relative;
            padding-left: 20px;
        }
        .included-list li:before {
            content: "✓";
            color: #28a745;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        .notes-section {
            margin-top: 30px;
            padding: 20px;
            background: #fff3cd;
            border-radius: 8px;
        }
        .notes-section h3 {
            color: #856404;
            margin-top: 0;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">ProSpaces</div>
        <div class="quote-info">
            <div class="quote-number">Quote ${quote.quote_number}</div>
            <div class="quote-date">Date: ${formatDate(quote.created_at)}</div>
            ${quote.expires_at ? `<div class="quote-date">Expires: ${formatDate(quote.expires_at)}</div>` : ''}
        </div>
    </div>

    <div class="client-info">
        <h3>Client Information</h3>
        <strong>${quote.client.full_name}</strong><br>
        ${quote.client.email}<br>
        ${quote.client.phone ? `${quote.client.phone}<br>` : ''}
        ${quote.client.address ? `${quote.client.address}` : ''}
    </div>

    <div class="items-section">
        <h2>Quote Items</h2>
        ${quote.quote_items.map((item: any) => `
            <div class="item">
                <div class="item-header">
                    <div class="item-title">${item.product_name}</div>
                </div>
                <div class="item-content">
                    ${item.product?.description ? `<div class="item-description">${item.product.description}</div>` : ''}
                    
                    ${Object.keys(item.configuration || {}).length > 0 ? `
                        <div class="configuration">
                            <h4>Configuration:</h4>
                            ${Object.entries(item.configuration || {}).map(([key, value]) => `
                                <div class="config-item">
                                    <span>${key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                                    <span>${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <table class="pricing-table">
                        <tr>
                            <td class="label">Quantity:</td>
                            <td class="amount">${item.quantity}</td>
                        </tr>
                        <tr>
                            <td class="label">Unit Price:</td>
                            <td class="amount">${formatCurrency(item.unit_price)}</td>
                        </tr>
                        <tr style="border-top: 2px solid #007bff;">
                            <td class="label"><strong>Item Total:</strong></td>
                            <td class="amount"><strong>${formatCurrency(item.total_price)}</strong></td>
                        </tr>
                    </table>
                </div>
            </div>
        `).join('')}
    </div>

    <div class="total-section">
        <h3>Pricing Summary</h3>
        <table class="total-table">
            <tr>
                <td>Materials Cost:</td>
                <td style="text-align: right;">${formatCurrency(quote.materials_cost)}</td>
            </tr>
            ${quote.includes_installation ? `
                <tr>
                    <td>Installation Cost:</td>
                    <td style="text-align: right;">${formatCurrency(quote.install_cost)}</td>
                </tr>
            ` : ''}
            ${quote.extras_cost > 0 ? `
                <tr>
                    <td>Extras:</td>
                    <td style="text-align: right;">${formatCurrency(quote.extras_cost)}</td>
                </tr>
            ` : ''}
            <tr class="final-total">
                <td><strong>Total Cost:</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(quote.total_cost)}</strong></td>
            </tr>
        </table>
    </div>

    <div class="included-section">
        <h3>What's Always Included</h3>
        <ul class="included-list">
            <li>${quote.warranty_period} warranty</li>
            ${quote.includes_installation ? '<li>Professional installation</li>' : ''}
            <li>Free consultation</li>
            <li>Quality guarantee</li>
        </ul>
    </div>

    ${quote.special_instructions ? `
        <div class="notes-section">
            <h3>Special Instructions</h3>
            <p>${quote.special_instructions}</p>
        </div>
    ` : ''}

    <div class="footer">
        <p>Thank you for choosing ProSpaces. This quote is valid until ${quote.expires_at ? formatDate(quote.expires_at) : 'further notice'}.</p>
        <p>For any questions, please contact us at your convenience.</p>
    </div>
</body>
</html>
  `
}