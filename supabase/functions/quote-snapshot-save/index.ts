import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface QuoteSnapshotRequest {
  quoteId: string
  orderId: string
  snapshotType: 'original' | 'revision'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Set the user's JWT for RLS
    const jwt = authHeader.replace('Bearer ', '')
    await supabase.auth.setSession({ access_token: jwt, refresh_token: '' })

    const { quoteId, orderId, snapshotType }: QuoteSnapshotRequest = await req.json()

    console.log('Creating quote snapshot:', { quoteId, orderId, snapshotType })

    // Fetch complete quote data with all related information
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients(*),
        quote_items:quote_items(
          *,
          product:products(*)
        )
      `)
      .eq('id', quoteId)
      .single()

    if (quoteError) {
      console.error('Error fetching quote:', quoteError)
      throw new Error(`Failed to fetch quote: ${quoteError.message}`)
    }

    // Generate HTML content for the snapshot
    const htmlContent = generateQuoteHTML(quoteData)

    // Save the snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('order_quote_snapshots')
      .insert({
        order_id: orderId,
        quote_id: quoteId,
        snapshot_type: snapshotType,
        quote_data: quoteData,
        html_content: htmlContent
      })
      .select()
      .single()

    if (snapshotError) {
      console.error('Error saving snapshot:', snapshotError)
      throw new Error(`Failed to save snapshot: ${snapshotError.message}`)
    }

    console.log('Quote snapshot saved successfully:', snapshot.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        snapshotId: snapshot.id,
        message: 'Quote snapshot saved successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in quote-snapshot-save function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to save quote snapshot' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
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
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote ${quote.quote_number}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .quote-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    .section h2 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    .item { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
    .pricing { background-color: #f9f9f9; padding: 20px; border-radius: 5px; }
    .total { font-size: 1.2em; font-weight: bold; color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Quote ${quote.quote_number}</h1>
    <p>Generated on ${formatDate(quote.created_at)}</p>
    ${quote.expires_at ? `<p>Valid until ${formatDate(quote.expires_at)}</p>` : ''}
  </div>

  <div class="quote-info">
    <div>
      <h3>Client Information</h3>
      <p><strong>Name:</strong> ${quote.client.full_name}</p>
      <p><strong>Email:</strong> ${quote.client.email}</p>
      ${quote.client.phone ? `<p><strong>Phone:</strong> ${quote.client.phone}</p>` : ''}
      ${quote.client.address ? `<p><strong>Address:</strong> ${quote.client.address}</p>` : ''}
    </div>
    <div>
      <h3>Quote Details</h3>
      <p><strong>Status:</strong> ${quote.status}</p>
      <p><strong>Installation:</strong> ${quote.includes_installation ? 'Included' : 'Not included'}</p>
      ${quote.warranty_period ? `<p><strong>Warranty:</strong> ${quote.warranty_period}</p>` : ''}
    </div>
  </div>

  ${quote.quote_items && quote.quote_items.length > 0 ? `
  <div class="section">
    <h2>Quote Items</h2>
    ${quote.quote_items.map((item: any) => `
      <div class="item">
        <h4>${item.product?.name || 'Product'}</h4>
        <p><strong>Quantity:</strong> ${item.quantity}</p>
        <p><strong>Unit Price:</strong> ${formatCurrency(item.unit_price)}</p>
        <p><strong>Total:</strong> ${formatCurrency(item.total_price)}</p>
        ${item.configuration ? `<p><strong>Configuration:</strong> ${JSON.stringify(item.configuration)}</p>` : ''}
        ${item.notes ? `<p><strong>Notes:</strong> ${item.notes}</p>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="section pricing">
    <h2>Pricing Summary</h2>
    <p><strong>Materials Cost:</strong> ${formatCurrency(quote.materials_cost)}</p>
    <p><strong>Installation Cost:</strong> ${formatCurrency(quote.install_cost)}</p>
    <p><strong>Extras Cost:</strong> ${formatCurrency(quote.extras_cost)}</p>
    <p class="total"><strong>Total Cost:</strong> ${formatCurrency(quote.total_cost)}</p>
  </div>

  ${quote.special_instructions ? `
  <div class="section">
    <h2>Special Instructions</h2>
    <p>${quote.special_instructions}</p>
  </div>
  ` : ''}

  ${quote.notes ? `
  <div class="section">
    <h2>Notes</h2>
    <p>${quote.notes}</p>
  </div>
  ` : ''}
</body>
</html>
  `
}