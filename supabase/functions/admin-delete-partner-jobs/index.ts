
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface DeleteStats {
  orders: number;
  job_offers: number;
  order_activity: number;
  order_completion_checklist: number;
  engineer_uploads: number;
  order_payments: number;
  quotes: number;
  clients: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    console.log('JWT extracted successfully')

    // Verify the JWT and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid token')
    }

    console.log(`User authenticated successfully: ${user.email}`)

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Admin access required')
    }

    console.log(`Admin access verified for user: ${user.email}`)

    const { partner_id, import_run_id, dry_run } = await req.json()
    
    console.log('Delete partner jobs request:', {
      partner_id,
      import_run_id,
      dry_run,
      user_id: user.id
    })

    const startTime = performance.now()

    // Build the base query for finding orders
    let ordersQuery = supabase
      .from('orders')
      .select('id, client_id')

    if (import_run_id) {
      // Filter by specific import run
      ordersQuery = ordersQuery.eq('partner_metadata->>import_run_id', import_run_id)
    } else {
      // Filter by partner
      ordersQuery = ordersQuery
        .eq('is_partner_job', true)
        .eq('partner_id', partner_id)
    }

    const { data: orders, error: ordersError } = await ordersQuery
    
    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`)
    }

    const orderIds = orders?.map(o => o.id) || []
    const clientIds = orders?.map(o => o.client_id) || []
    
    // Also find standalone partner clients (clients created but no orders)
    let standalonePartnerClients = [];
    
    if (partner_id) {
      const { data: foundStandaloneClients, error: standaloneError } = await supabase
        .from('clients')
        .select('id, full_name, email, partner_id, is_partner_client')
        .eq('partner_id', partner_id)
        .eq('is_partner_client', true);

      if (standaloneError) {
        console.error('Error finding standalone partner clients:', standaloneError);
      } else {
        standalonePartnerClients = foundStandaloneClients || [];
        console.log(`Found standalone partner clients:`, standalonePartnerClients);
      }
    }

    const standaloneClientIds = standalonePartnerClients?.map(c => c.id) || [];
    
    // Also find ALL partner clients associated with this partner (for debugging)
    if (partner_id) {
      const { data: allPartnerClients } = await supabase
        .from('clients')
        .select('id, full_name, email, partner_id, is_partner_client')
        .eq('partner_id', partner_id);
      
      console.log(`Total clients with partner_id ${partner_id}:`, allPartnerClients?.length || 0);
      console.log(`All partner clients:`, allPartnerClients);
    }
    
    console.log(`Found ${orderIds.length} orders and ${standaloneClientIds.length} standalone partner clients to process`)

    if (orderIds.length === 0 && standaloneClientIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        stats: {
          orders: 0,
          job_offers: 0,
          order_activity: 0,
          order_completion_checklist: 0,
          engineer_uploads: 0,
          order_payments: 0,
          quotes: 0,
          clients: 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let stats: DeleteStats = {
      orders: 0,
      job_offers: 0,
      order_activity: 0,
      order_completion_checklist: 0,
      engineer_uploads: 0,
      order_payments: 0,
      quotes: 0,
      clients: 0
    }

    if (dry_run) {
      // Efficient batch counts for dry run
      const [
        jobOffersCount,
        activityCount,
        checklistCount,
        uploadsCount,
        paymentsCount,
        quotesCount
      ] = await Promise.all([
        supabase.from('job_offers').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
        supabase.from('order_activity').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
        supabase.from('order_completion_checklist').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
        supabase.from('engineer_uploads').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
        supabase.from('order_payments').select('id', { count: 'exact', head: true }).in('order_id', orderIds),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).in('client_id', clientIds)
      ])

      // Count orphaned clients using two-step approach
      let orphanedClientsCount = 0;
      if (clientIds.length > 0) {
        // Step 1: Get clients that still have orders after deletion
        const { data: remainingClients } = await supabase
          .from('orders')
          .select('client_id')
          .in('client_id', clientIds)
          .not('id', 'in', orderIds);
        
        const stillUsedClientIds = new Set(remainingClients?.map(r => r.client_id) || []);
        orphanedClientsCount = clientIds.filter(id => !stillUsedClientIds.has(id)).length;
      }

      // Add standalone partner clients
      const totalClientsToDelete = orphanedClientsCount + standaloneClientIds.length;

      stats = {
        orders: orderIds.length,
        job_offers: jobOffersCount.count || 0,
        order_activity: activityCount.count || 0,
        order_completion_checklist: checklistCount.count || 0,
        engineer_uploads: uploadsCount.count || 0,
        order_payments: paymentsCount.count || 0,
        quotes: quotesCount.count || 0,
        clients: totalClientsToDelete
      }

      console.log('Dry run complete:', stats)
      
      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Actual deletion with batching
    console.log('Starting actual deletions...')
    
    let totalStats: DeleteStats = {
      orders: 0,
      job_offers: 0,
      order_activity: 0,
      order_completion_checklist: 0,
      engineer_uploads: 0,
      order_payments: 0,
      quotes: 0,
      clients: 0
    }

    // Process orders if they exist
    if (orderIds.length > 0) {
      const BATCH_SIZE = 100
      const batches = []
      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        batches.push(orderIds.slice(i, i + BATCH_SIZE))
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        console.log(`Processing batch ${i + 1}, orders ${i * BATCH_SIZE + 1}-${Math.min((i + 1) * BATCH_SIZE, orderIds.length)}`)
        
        const batchStartTime = performance.now()

        // Delete dependent records in parallel batches
        const [
          jobOffersResult,
          activityResult,
          checklistResult,
          uploadsResult,
          paymentsResult
        ] = await Promise.all([
          supabase.from('job_offers').delete().in('order_id', batch),
          supabase.from('order_activity').delete().in('order_id', batch),
          supabase.from('order_completion_checklist').delete().in('order_id', batch),
          supabase.from('engineer_uploads').delete().in('order_id', batch),
          supabase.from('order_payments').delete().in('order_id', batch)
        ])

        // Handle errors
        if (jobOffersResult.error) console.error('Job offers deletion error:', jobOffersResult.error)
        if (activityResult.error) console.error('Activity deletion error:', activityResult.error)
        if (checklistResult.error) console.error('Checklist deletion error:', checklistResult.error)
        if (uploadsResult.error) console.error('Uploads deletion error:', uploadsResult.error)
        if (paymentsResult.error) console.error('Payments deletion error:', paymentsResult.error)

        // Get client IDs for this batch
        const batchClientIds = orders?.filter(o => batch.includes(o.id)).map(o => o.client_id) || []

        // Delete quotes for these clients
        const quotesResult = await supabase
          .from('quotes')
          .delete()
          .in('client_id', batchClientIds)

        if (quotesResult.error) console.error('Quotes deletion error:', quotesResult.error)

        // Delete the orders themselves
        const ordersResult = await supabase
          .from('orders')
          .delete()
          .in('id', batch)

        if (ordersResult.error) console.error('Orders deletion error:', ordersResult.error)

        // Find and delete orphaned clients using proper two-step approach
        if (batchClientIds.length > 0) {
          // Step 1: Get clients that still have orders after deletion
          const { data: remainingClients } = await supabase
            .from('orders')
            .select('client_id')
            .in('client_id', batchClientIds);
          
          const stillUsedClientIds = new Set(remainingClients?.map(r => r.client_id) || []);
          const orphanedClientIds = batchClientIds.filter(id => !stillUsedClientIds.has(id));
          
          if (orphanedClientIds.length > 0) {
            const clientsResult = await supabase
              .from('clients')
              .delete()
              .in('id', orphanedClientIds);
            
            if (clientsResult.error) console.error('Clients deletion error:', clientsResult.error);
            totalStats.clients += orphanedClientIds.length;
            console.log(`Deleted ${orphanedClientIds.length} orphaned clients in batch ${i + 1}`);
          }
        }

        // Update stats (approximate counts since we don't get exact counts from delete)
        totalStats.orders += batch.length
        totalStats.job_offers += batch.length  // Approximate
        totalStats.order_activity += batch.length  // Approximate
        totalStats.order_completion_checklist += batch.length  // Approximate
        totalStats.engineer_uploads += batch.length  // Approximate
        totalStats.order_payments += batch.length  // Approximate
        totalStats.quotes += batchClientIds.length  // Approximate

        const batchTime = performance.now() - batchStartTime
        console.log(`Batch ${i + 1} completed in ${Math.round(batchTime)}ms`)
      }
    }

    // After all order-related deletions, delete standalone partner clients
    if (standaloneClientIds.length > 0) {
      console.log(`Deleting ${standaloneClientIds.length} standalone partner clients...`);
      
      const { error: standaloneClientsError } = await supabase
        .from('clients')
        .delete()
        .in('id', standaloneClientIds);
      
      if (standaloneClientsError) {
        console.error('Standalone clients deletion error:', standaloneClientsError);
      } else {
        totalStats.clients += standaloneClientIds.length;
        console.log(`Deleted ${standaloneClientIds.length} standalone partner clients`);
      }
    }

    const totalTime = performance.now() - startTime
    console.log(`Deletion complete in ${Math.round(totalTime)}ms:`, totalStats)

    return new Response(JSON.stringify({ success: true, stats: totalStats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
