import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuditResults {
  sheet_analysis: {
    total_rows: number;
    total_job_ids: number;
    unique_job_ids: number;
    duplicate_job_ids: string[];
    blank_job_ids: number;
    total_emails: number;
    unique_emails: number;
    duplicate_emails: string[];
    blank_emails: number;
    blank_names: number;
  };
  database_analysis: {
    existing_job_ids_count: number;
    existing_job_ids: string[];
    missing_job_ids_count: number;
    missing_job_ids: string[];
    total_orders_for_partner: number;
    total_clients_for_partner: number;
  };
  recommendations: string[];
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== PARTNER IMPORT AUDIT FUNCTION ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { profile_id } = await req.json();
    console.log('Auditing profile:', profile_id);

    // Fetch the partner import profile
    const { data: profile, error: profileError } = await supabase
      .from('partner_import_profiles')
      .select(`
        *,
        partners (
          id, name
        )
      `)
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Import profile not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Profile found:', profile.name);

    // Fetch Google Sheets data using correct API format
    const { data: sheetsData, error: sheetsError } = await supabase.functions.invoke('google-sheets-preview', {
      body: {
        gsheet_id: profile.gsheet_id,
        sheet_name: profile.gsheet_sheet_name,
        start_row: 0,
        max_rows: 5000 // Get more data for audit
      }
    });

    if (sheetsError || !sheetsData?.success) {
      console.error('Sheets fetch error:', sheetsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch sheet data' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetRows = sheetsData.rows || [];
    const headers = sheetsData.headers || [];
    console.log('Sheet rows fetched:', sheetRows.length);

    // Get column mappings
    const columnMappings = profile.column_mappings || {};
    const jobIdColumn = columnMappings.partner_external_id;
    const clientNameColumn = columnMappings.client_name;
    const clientEmailColumn = columnMappings.client_email;

    console.log('Column mappings:', { jobIdColumn, clientNameColumn, clientEmailColumn });

    // Analyze sheet data
    const jobIds: string[] = [];
    const emails: string[] = [];
    const names: string[] = [];
    let blankJobIds = 0;
    let blankEmails = 0;
    let blankNames = 0;

    sheetRows.forEach((row: any[], index: number) => {
      const rowData: { [key: string]: any } = {};
      headers.forEach((header: string, i: number) => {
        rowData[header] = row[i] || '';
      });

      const jobId = String(rowData[jobIdColumn] || '').trim();
      const email = String(rowData[clientEmailColumn] || '').trim().toLowerCase();
      const name = String(rowData[clientNameColumn] || '').trim();

      if (!jobId) {
        blankJobIds++;
      } else {
        jobIds.push(jobId);
      }

      if (!email) {
        blankEmails++;
      } else {
        emails.push(email);
      }

      if (!name) {
        blankNames++;
      } else {
        names.push(name);
      }
    });

    // Find duplicates
    const jobIdCounts = jobIds.reduce((acc: any, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    const duplicateJobIds = Object.keys(jobIdCounts).filter(id => jobIdCounts[id] > 1);

    const emailCounts = emails.reduce((acc: any, email) => {
      acc[email] = (acc[email] || 0) + 1;
      return acc;
    }, {});
    const duplicateEmails = Object.keys(emailCounts).filter(email => emailCounts[email] > 1);

    const uniqueJobIds = [...new Set(jobIds)];
    const uniqueEmails = [...new Set(emails)];

    console.log('Sheet analysis complete:', {
      totalRows: sheetRows.length,
      uniqueJobIds: uniqueJobIds.length,
      duplicateJobIds: duplicateJobIds.length,
    });

    // Analyze database - fetch ALL orders with pagination
    let allExistingOrders: any[] = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;

    while (hasMore) {
      const { data: orderBatch, error: ordersError } = await supabase
        .from('orders')
        .select('partner_external_id')
        .eq('partner_id', profile.partner_id)
        .not('partner_external_id', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch existing orders' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (orderBatch && orderBatch.length > 0) {
        allExistingOrders = allExistingOrders.concat(orderBatch);
        offset += batchSize;
        hasMore = orderBatch.length === batchSize; // Continue if we got a full batch
      } else {
        hasMore = false;
      }
    }

    const existingJobIds = allExistingOrders?.map(o => o.partner_external_id).filter(Boolean) || [];
    // Remove duplicates from existing job IDs
    const uniqueExistingJobIds = [...new Set(existingJobIds)];
    const missingJobIds = uniqueJobIds.filter(id => !uniqueExistingJobIds.includes(id));

    // Count totals for partner
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', profile.partner_id);

    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', profile.partner_id);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (duplicateJobIds.length > 0) {
      recommendations.push(`Found ${duplicateJobIds.length} duplicate Job IDs in sheet. Remove duplicates before importing.`);
    }
    
    if (blankJobIds > 0) {
      recommendations.push(`Found ${blankJobIds} rows with blank Job IDs. These will be skipped during import.`);
    }
    
    if (blankEmails > 0) {
      recommendations.push(`Found ${blankEmails} rows with blank emails. These will get placeholder emails.`);
    }
    
    if (blankNames > 0) {
      recommendations.push(`Found ${blankNames} rows with blank names. These will be skipped during import.`);
    }

    if (missingJobIds.length > 0) {
      recommendations.push(`${missingJobIds.length} Job IDs from sheet are missing from database. These may have failed to import due to errors.`);
    }

    const auditResults: AuditResults = {
      sheet_analysis: {
        total_rows: sheetRows.length,
        total_job_ids: jobIds.length,
        unique_job_ids: uniqueJobIds.length,
        duplicate_job_ids: duplicateJobIds,
        blank_job_ids: blankJobIds,
        total_emails: emails.length,
        unique_emails: uniqueEmails.length,
        duplicate_emails: duplicateEmails,
        blank_emails: blankEmails,
        blank_names: blankNames,
      },
      database_analysis: {
        existing_job_ids_count: uniqueExistingJobIds.length,
        existing_job_ids: uniqueExistingJobIds,
        missing_job_ids_count: missingJobIds.length,
        missing_job_ids: missingJobIds,
        total_orders_for_partner: totalOrders || 0,
        total_clients_for_partner: totalClients || 0,
      },
      recommendations,
    };

    console.log('Audit complete:', {
      sheetRows: sheetRows.length,
      uniqueJobIds: uniqueJobIds.length,
      existingInDB: uniqueExistingJobIds.length,
      missingFromDB: missingJobIds.length,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      audit_results: auditResults 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Audit function error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})