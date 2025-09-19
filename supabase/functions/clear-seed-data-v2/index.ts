import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

// Dynamic CORS handler for Lovable preview domains and localhost
const getCorsHeaders = (origin?: string | null) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    /^https?:\/\/preview--.*\.lovable\.app$/,
    /^https?:\/\/.*\.lovable\.dev$/
  ];

  let allowOrigin = '*';
  
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
    'Vary': 'Origin'
  };
};

serve(async (req) => {
  console.log('[clear-seed-data-v2] Build 2025-01-17-v2-deploy - FRESH DEPLOY with 204 preflight');
  
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log(`${req.method} request from origin: ${origin || 'none'}`);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request with 204 status');
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user is admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting seed data cleanup...');

    let deletedCounts = {
      orders: 0,
      quote_items: 0,
      quotes: 0,
      clients: 0,
      profiles: 0,
      users: 0
    };

    // Find seed clients by email pattern
    const { data: seedClients } = await supabaseAdmin
      .from('clients')
      .select('id, user_id, email')
      .or('email.like.%@seed.local,full_name.like.Seed Client %');

    if (!seedClients || seedClients.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No seed data found to clean up',
        counts: deletedCounts
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${seedClients.length} seed clients to clean up`);

    const clientIds = seedClients.map(c => c.id);
    const userIds = seedClients.map(c => c.user_id).filter(Boolean);

    // Delete in correct order to respect foreign key constraints

    // 1. Delete orders (includes order_completion_checklist and engineer_uploads via cascade)
    const { data: seedOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .in('client_id', clientIds);

    if (seedOrders && seedOrders.length > 0) {
      console.log(`Deleting ${seedOrders.length} orders...`);
      
      // Delete order completion checklist items
      await supabaseAdmin
        .from('order_completion_checklist')
        .delete()
        .in('order_id', seedOrders.map(o => o.id));

      // Delete engineer uploads  
      await supabaseAdmin
        .from('engineer_uploads')
        .delete()
        .in('order_id', seedOrders.map(o => o.id));

      // Delete order activity
      await supabaseAdmin
        .from('order_activity')
        .delete()
        .in('order_id', seedOrders.map(o => o.id));

      // Delete order payments
      await supabaseAdmin
        .from('order_payments')
        .delete()
        .in('order_id', seedOrders.map(o => o.id));

      // Delete charger dispatches (added for seed data cleanup)
      await supabaseAdmin
        .from('charger_dispatches')
        .delete()
        .in('order_id', seedOrders.map(o => o.id));

      // Delete job offers
      await supabaseAdmin
        .from('job_offers')
        .delete()
        .in('order_id', seedOrders.map(o => o.id));

      // Delete orders
      const { error: ordersError } = await supabaseAdmin
        .from('orders')
        .delete()
        .in('client_id', clientIds);
      
      if (ordersError) {
        console.error('Error deleting orders:', ordersError);
      } else {
        deletedCounts.orders = seedOrders.length;
      }
    }

    // 2. Delete quote items
    const { data: seedQuotes } = await supabaseAdmin
      .from('quotes')
      .select('id')
      .in('client_id', clientIds);

    if (seedQuotes && seedQuotes.length > 0) {
      console.log(`Deleting quote items for ${seedQuotes.length} quotes...`);
      
      const { error: quoteItemsError } = await supabaseAdmin
        .from('quote_items')
        .delete()
        .in('quote_id', seedQuotes.map(q => q.id));
      
      if (quoteItemsError) {
        console.error('Error deleting quote items:', quoteItemsError);
      } else {
        // Count deleted quote items
        const { count } = await supabaseAdmin
          .from('quote_items')
          .select('*', { count: 'exact', head: true })
          .in('quote_id', seedQuotes.map(q => q.id));
        deletedCounts.quote_items = count || 0;
      }
    }

    // 3. Delete quotes
    if (seedQuotes && seedQuotes.length > 0) {
      console.log(`Deleting ${seedQuotes.length} quotes...`);
      
      const { error: quotesError } = await supabaseAdmin
        .from('quotes')
        .delete()
        .in('client_id', clientIds);
      
      if (quotesError) {
        console.error('Error deleting quotes:', quotesError);
      } else {
        deletedCounts.quotes = seedQuotes.length;
      }
    }

    // 4. Delete messages
    await supabaseAdmin
      .from('messages')
      .delete()
      .in('client_id', clientIds);

    // 5. Delete files
    await supabaseAdmin
      .from('files')
      .delete()
      .in('client_id', clientIds);

    // 6. Delete lead history
    await supabaseAdmin
      .from('lead_history')
      .delete()
      .in('client_id', clientIds);

    // 7. Delete client blocked dates
    await supabaseAdmin
      .from('client_blocked_dates')
      .delete()
      .in('client_id', clientIds);

    // 8. Delete clients
    console.log(`Deleting ${clientIds.length} clients...`);
    const { error: clientsError } = await supabaseAdmin
      .from('clients')
      .delete()
      .in('id', clientIds);
    
    if (clientsError) {
      console.error('Error deleting clients:', clientsError);
    } else {
      deletedCounts.clients = clientIds.length;
    }

    // 9. Delete profiles
    if (userIds.length > 0) {
      console.log(`Deleting ${userIds.length} profiles...`);
      const { error: profilesError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .in('user_id', userIds);
      
      if (profilesError) {
        console.error('Error deleting profiles:', profilesError);
      } else {
        deletedCounts.profiles = userIds.length;
      }
    }

    // 10. Delete auth users (handle non-existent users gracefully)
    if (userIds.length > 0) {
      console.log(`Attempting to delete ${userIds.length} auth users...`);
      
      for (const userId of userIds) {
        try {
          // First check if user exists
          const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
          
          if (getUserError && getUserError.status === 404) {
            // User doesn't exist, skip silently
            console.log(`User ${userId} already deleted or doesn't exist, skipping...`);
            continue;
          }
          
          if (getUserError) {
            console.error(`Error checking user ${userId}:`, getUserError);
            continue;
          }

          // User exists, now delete them
          const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (userError) {
            if (userError.status === 404) {
              console.log(`User ${userId} was already deleted, continuing...`);
            } else {
              console.error(`Error deleting user ${userId}:`, userError);
            }
          } else {
            deletedCounts.users++;
            console.log(`Successfully deleted user ${userId}`);
          }
        } catch (error) {
          // Handle any unexpected errors gracefully
          if (error.message?.includes('User not found') || error.status === 404) {
            console.log(`User ${userId} not found, skipping...`);
          } else {
            console.error(`Failed to delete user ${userId}:`, error.message);
          }
        }
      }
    }

    console.log('Seed data cleanup completed:', deletedCounts);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully cleaned up seed data: ${deletedCounts.clients} clients, ${deletedCounts.orders} orders, ${deletedCounts.quotes} quotes`,
      counts: deletedCounts
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in clear-seed-data-v2 function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});