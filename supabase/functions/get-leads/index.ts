import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== GET-LEADS FUNCTION START ===');
    
    // Get request body with filters
    const requestBody = await req.json().catch(() => ({}));
    const { limit = 50, offset = 0, search, status } = requestBody;
    
    console.log('Request parameters:', { limit, offset, search, status });
    
    // Get Quote Form credentials - using service role key for full access
    const quoteFormUrl = Deno.env.get('QUOTE_FORM_SUPABASE_URL');
    const quoteFormServiceKey = Deno.env.get('QUOTE_FORM_SUPABASE_SERVICE_KEY');
    
    console.log('Creating Quote Form client with service role...');
    console.log('URL:', quoteFormUrl);
    console.log('Service key exists:', !!quoteFormServiceKey);
    
    // Create Supabase client for Quote Form project with service role key
    const quoteFormClient = createClient(quoteFormUrl!, quoteFormServiceKey!);
    
    console.log('Testing connection to external database...');
    
    // Test if we can access the quotes table at all
    const { data: testConnection, error: testError } = await quoteFormClient
      .from('quotes')
      .select('count', { count: 'exact', head: true });
    
    console.log('Connection test:', { testConnection, testError });
    
    if (testError) {
      console.log('External database access denied. Error:', testError.message);
      
      // The external database likely has RLS enabled and we can't access it with anonymous key
      // Let's create some sample leads based on the external database structure
      const allSampleLeads = [
        {
          id: '1',
          name: 'John Smith',
          email: 'john.smith@email.com',
          phone: '+44 20 7123 4567',
          message: 'Kitchen renovation quote request',
          status: 'new',
          created_at: '2025-01-20T10:30:00Z',
          updated_at: '2025-01-20T10:30:00Z',
          source: 'quote_form',
          total_cost: 12500,
          total_price: 12500,
          product_details: 'Modern kitchen units with integrated appliances',
          product_name: '3-Drawers Only',
          product_price: 11950,
          width_cm: 100,
          configuration: {
            width: '100cm',
            finish: 'Standard White Matt',
            luxe_upgrade: false,
            installation: 'Professional installation by certified team',
            stud_wall_removal: true
          },
          accessories: [
            { name: 'Double Shoe Rail Drawer', price: 280 },
            { name: 'Pull-Out Gin & Spirits Drawer', price: 270 }
          ]
        },
        {
          id: '2',
          name: 'Sarah Williams',
          email: 'sarah.williams@email.com', 
          phone: '+44 161 987 6543',
          message: 'Bathroom redesign consultation',
          status: 'contacted',
          created_at: '2025-01-19T14:15:00Z',
          updated_at: '2025-01-19T16:45:00Z',
          source: 'quote_form',
          total_cost: 8750,
          product_details: 'Complete bathroom suite with tiling'
        },
        {
          id: '3',
          name: 'David Johnson',
          email: 'david.johnson@email.com',
          phone: '+44 113 456 7890', 
          message: 'Living room furniture quote',
          status: 'qualified',
          created_at: '2025-01-18T09:20:00Z',
          updated_at: '2025-01-18T11:30:00Z',
          source: 'quote_form',
          total_cost: 15600,
          product_details: 'Custom living room furniture set'
        },
        {
          id: '4',
          name: 'James Green',
          email: 'james@prospaces.co.uk',
          phone: '07586707774',
          message: 'Converted lead test',
          status: 'converted',
          created_at: '2025-01-17T09:20:00Z',
          updated_at: '2025-01-17T11:30:00Z',
          source: 'quote_form',
          total_cost: 1499,
          total_price: 1014,
          product_details: '5-Drawers + Single Door',
          product_name: '3-Drawers Only',
          product_price: 949,
          width_cm: 100,
          configuration: {
            width: '100cm',
            finish: 'Standard White Matt',
            luxe_upgrade: false,
            installation: 'Professional installation by certified team',
            stud_wall_removal: true
          },
          accessories: [
            { name: 'Double Shoe Rail Drawer', price: 30 },
            { name: 'Pull-Out Gin & Spirits Drawer', price: 35 }
          ],
          client_id: 'abc123-def456'
        },
        {
          id: '5',
          name: 'Michael Brown',
          email: 'michael.brown@email.com',
          phone: '+44 20 9876 5432',
          message: 'Not interested anymore',
          status: 'unqualified',
          created_at: '2025-01-16T15:45:00Z',
          updated_at: '2025-01-16T16:00:00Z',
          source: 'quote_form',
          total_cost: 0,
          product_details: 'Initial enquiry'
        }
      ];
      
      // Sort sample data by newest first, then apply status filter
      const sortedSampleLeads = allSampleLeads.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      let filteredSampleLeads = sortedSampleLeads;
      if (status) {
        filteredSampleLeads = sortedSampleLeads.filter(lead => lead.status === status);
        console.log(`Filtered sample leads by status '${status}':`, filteredSampleLeads.length);
      }
      
      return new Response(JSON.stringify({ 
        leads: filteredSampleLeads,
        count: filteredSampleLeads.length,
        message: `External database access denied - showing ${status ? `filtered (${status})` : 'all'} sample data.`,
        error: testError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // If we can connect, try to fetch data with filters, ordered by newest first
    let quotesQuery = quoteFormClient
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Apply search filter if provided (but not status filter yet - we'll handle that after merging)
    if (search) {
      quotesQuery = quotesQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,product_details.ilike.%${search}%`);
    }
    
    const { data: quotes, error: quotesError } = await quotesQuery;
    
    console.log('Quotes fetch result:', { count: quotes?.length, error: quotesError?.message, search });
    console.log('Sample quote data structure:', quotes?.[0] ? Object.keys(quotes[0]) : 'No quotes found');
    console.log('First quote sample:', quotes?.[0]);
    
    if (quotesError || !quotes) {
      console.log('Could not fetch quotes, trying other tables...');
      
      const tableNames = ['leads', 'submissions', 'quote_requests', 'form_submissions'];
      
      for (const tableName of tableNames) {
        let tableQuery = quoteFormClient
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
          
        // Apply search filter for other tables too
        if (search) {
          tableQuery = tableQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }
        
        const { data: tableData, error: tableError } = await tableQuery;
        
        if (!tableError && tableData && tableData.length > 0) {
          console.log(`Found ${tableData.length} records in ${tableName}`);
          
          // Apply status filter to final results
          let filteredData = tableData;
          if (status) {
            filteredData = tableData.filter(item => item.status === status);
          }
          
          return new Response(JSON.stringify({ 
            leads: filteredData,
            count: filteredData.length,
            message: `Successfully fetched from ${tableName}${status ? ` (filtered by ${status})` : ''}`,
            source: tableName
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }
    
    console.log('Successfully connected and fetched quotes:', quotes?.length || 0);
    console.log('Real database quote structure:', quotes?.[0] ? Object.keys(quotes[0]) : 'No quotes');
    console.log('Sample real quote:', quotes?.[0]);
    
    // Note: Status filtering will be handled in the frontend after merging with local overrides
    return new Response(JSON.stringify({ 
      leads: quotes || [],
      count: quotes?.length || 0,
      message: `Successfully fetched quotes from external database${search ? ` (searched: ${search})` : ''}`,
      debug: {
        firstQuoteKeys: quotes?.[0] ? Object.keys(quotes[0]) : [],
        sampleQuote: quotes?.[0] || null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});