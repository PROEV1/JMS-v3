import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getCorsHeaders } from '../_shared/cors.ts'

const corsHeaders = {
  ...getCorsHeaders(),
  'Content-Type': 'application/json'
}

interface DeleteJobsRequest {
  partner_id: string
  import_run_id?: string
  dry_run: boolean
}

interface DeleteStats {
  orders: number
  job_offers: number
  order_activity: number
  order_completion_checklist: number
  engineer_uploads: number
  order_payments: number
  quotes: number
  clients: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const jwt = authHeader.replace('Bearer ', '')
    console.log('JWT extracted successfully')

    // Create Supabase client for server-side operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      console.error('Authentication failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }
    
    console.log('User authenticated successfully:', user.email)

    // Create admin client for privilege checks
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user is admin using secure RPC function
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('is_admin', { 
      user_uuid: user.id 
    })

    if (adminCheckError) {
      console.error('Failed to check admin status:', adminCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!isAdmin) {
      console.error('Access denied: User is not admin. User ID:', user.id, 'Email:', user.email)
      return new Response(
        JSON.stringify({ error: 'Access denied: Admin role required' }),
        { status: 403, headers: corsHeaders }
      )
    }

    console.log('Admin access verified for user:', user.email)

    const { partner_id, import_run_id, dry_run }: DeleteJobsRequest = await req.json()

    if (!partner_id) {
      return new Response(
        JSON.stringify({ error: 'partner_id is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Delete partner jobs request:', { partner_id, import_run_id, dry_run, user_id: user.id })

    // Build filter conditions
    let orderQuery = supabaseAdmin
      .from('orders')
        .select('id, quote_id')
      .eq('is_partner_job', true)
      .eq('partner_id', partner_id)

    if (import_run_id) {
      orderQuery = orderQuery.eq('partner_metadata->>import_run_id', import_run_id)
    }

    const { data: targetOrders, error: ordersError } = await orderQuery

    if (ordersError) {
      console.error('Failed to fetch orders:', ordersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch target orders' }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!targetOrders || targetOrders.length === 0) {
      console.log('No matching orders found')
      return new Response(
        JSON.stringify({ 
          message: 'No matching orders found',
          stats: { orders: 0, job_offers: 0, order_activity: 0, order_completion_checklist: 0, engineer_uploads: 0, order_payments: 0, quotes: 0, clients: 0 }
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    const orderIds = targetOrders.map(o => o.id)
    console.log(`Found ${targetOrders.length} orders to process`)

    // Get quote IDs for partner import quotes to delete
    const { data: partnerQuotes } = await supabaseAdmin
      .from('quotes')
      .select('id, client_id')
      .eq('quote_template', 'partner_import')
      .in('id', targetOrders.map(o => o.quote_id).filter(Boolean))

    const quoteIds = partnerQuotes?.map(q => q.id) || []
    const clientIdsFromQuotes = partnerQuotes?.map(q => q.client_id) || []

    // Find orphaned clients (user_id is null and no remaining orders/quotes/payments)
    const { data: potentialOrphanClients } = await supabaseAdmin
      .from('clients')
      .select('id')
      .is('user_id', null)
      .in('id', clientIdsFromQuotes)

    let orphanedClients: string[] = []
    if (potentialOrphanClients) {
      for (const client of potentialOrphanClients) {
        // Check if client will have any remaining orders after deletion
        const [remainingOrders, remainingQuotes, remainingPayments] = await Promise.all([
          supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', client.id).not('id', 'in', `(${orderIds.join(',')})`),
          supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true }).eq('client_id', client.id).not('id', 'in', `(${quoteIds.join(',')})`),
          supabaseAdmin.from('payments').select('id', { count: 'exact', head: true }).eq('client_id', client.id)
        ])
        
        if ((remainingOrders.count || 0) === 0 && (remainingQuotes.count || 0) === 0 && (remainingPayments.count || 0) === 0) {
          orphanedClients.push(client.id)
        }
      }
    }

    // Count related records for stats
    const [offersCount, activityCount, checklistCount, uploadsCount, paymentsCount] = await Promise.all([
      supabaseAdmin.from('job_offers').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
      supabaseAdmin.from('order_activity').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
      supabaseAdmin.from('order_completion_checklist').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
      supabaseAdmin.from('engineer_uploads').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
      supabaseAdmin.from('order_payments').select('id', { count: 'exact', head: true }).in('order_id', orderIds)
    ])

    const stats: DeleteStats = {
      orders: targetOrders.length,
      job_offers: offersCount.count || 0,
      order_activity: activityCount.count || 0,
      order_completion_checklist: checklistCount.count || 0,
      engineer_uploads: uploadsCount.count || 0,
      order_payments: paymentsCount.count || 0,
      quotes: quoteIds.length,
      clients: orphanedClients.length
    }

    if (dry_run) {
      console.log('Dry run complete:', stats)
      return new Response(
        JSON.stringify({ 
          message: 'Dry run complete',
          stats,
          order_ids_sample: orderIds.slice(0, 5) // Show first 5 order IDs as sample
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Perform actual deletions in order (related records first)
    console.log('Starting actual deletions...')

    // Delete in batches to avoid timeouts
    const BATCH_SIZE = 200
    let deletedStats: DeleteStats = {
      orders: 0,
      job_offers: 0,
      order_activity: 0,
      order_completion_checklist: 0,
      engineer_uploads: 0,
      order_payments: 0,
      quotes: 0,
      clients: 0
    }

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch = orderIds.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, orders ${i + 1}-${Math.min(i + BATCH_SIZE, orderIds.length)}`)

      // Delete related records first
      const [
        offersResult,
        activityResult,
        checklistResult,
        uploadsResult,
        paymentsResult,
        ordersResult
      ] = await Promise.all([
        supabaseAdmin.from('job_offers').delete().in('order_id', batch),
        supabaseAdmin.from('order_activity').delete().in('order_id', batch),
        supabaseAdmin.from('order_completion_checklist').delete().in('order_id', batch),
        supabaseAdmin.from('engineer_uploads').delete().in('order_id', batch),
        supabaseAdmin.from('order_payments').delete().in('order_id', batch),
        supabaseAdmin.from('orders').delete().in('id', batch)
      ])

      // Count deletions (approximate based on batch)
      const batchRatio = batch.length / orderIds.length
      deletedStats.job_offers += Math.round(stats.job_offers * batchRatio)
      deletedStats.order_activity += Math.round(stats.order_activity * batchRatio)
      deletedStats.order_completion_checklist += Math.round(stats.order_completion_checklist * batchRatio)
      deletedStats.engineer_uploads += Math.round(stats.engineer_uploads * batchRatio)
      deletedStats.order_payments += Math.round(stats.order_payments * batchRatio)
      deletedStats.orders += batch.length

      if (ordersResult.error) {
        console.error(`Error deleting orders batch:`, ordersResult.error)
        return new Response(
          JSON.stringify({ error: 'Failed to delete orders', details: ordersResult.error.message }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    // Delete partner import quotes
    if (quoteIds.length > 0) {
      const { error: quotesError } = await supabaseAdmin
        .from('quotes')
        .delete()
        .in('id', quoteIds)
      
      if (quotesError) {
        console.error('Error deleting quotes:', quotesError)
        return new Response(
          JSON.stringify({ error: 'Failed to delete quotes', details: quotesError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
      deletedStats.quotes = quoteIds.length
    }

    // Delete orphaned clients
    if (orphanedClients.length > 0) {
      const { error: clientsError } = await supabaseAdmin
        .from('clients')
        .delete()
        .in('id', orphanedClients)
      
      if (clientsError) {
        console.error('Error deleting clients:', clientsError)
        return new Response(
          JSON.stringify({ error: 'Failed to delete clients', details: clientsError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
      deletedStats.clients = orphanedClients.length
    }

    // Log the action
    await supabaseAdmin.rpc('log_user_action', {
      p_action_type: 'bulk_partner_jobs_deleted',
      p_target_user_id: user.id,
      p_details: {
        partner_id,
        import_run_id,
        deleted_stats: deletedStats,
        total_orders_deleted: deletedStats.orders
      }
    })

    console.log('Deletion complete:', deletedStats)

    return new Response(
      JSON.stringify({
        message: 'Jobs deleted successfully',
        stats: deletedStats
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})