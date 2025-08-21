import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { parse } from "https://deno.land/std@0.192.0/csv/parse.ts";

interface ImportProfile {
  id: string;
  partner_id: string;
  name: string;
  csv_column_mapping: Record<string, string>;
  status_mappings: Record<string, string>;
  status_override_rules: Record<string, string>;
  status_actions: Record<string, any>;
  engineer_mapping: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface MappedData {
  partner_external_id: string;
  status?: string;
  job_type?: string;
  postcode?: string;
  address?: string;
  city?: string;
  county?: string;
  country?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  engineer_name?: string;
  engineer_email?: string;
  fault_description?: string;
  reported_fault?: string;
  job_notes?: string;
  created_at?: string;
  scheduled_date?: string;
  product_description?: string;
  product_model?: string;
  serial_number?: string;
  warranty_status?: string;
  purchase_date?: string;
  supplier?: string;
  sub_partner?: string;
  priority?: string;
  contact_method?: string;
  internal_notes?: string;
  customer_ref?: string;
  engineer_id?: string;
  is_partner_job?: boolean;
  partner_id?: string;
  partner_status?: string;
  partner_confirmed_externally?: boolean;
  partner_confirmed_at?: string;
  external_confirmation_source?: string;
  scheduling_suppressed?: boolean;
  scheduling_suppressed_reason?: string;
  status_enhanced?: string;
}

interface ProcessedRow {
  success: boolean;
  data?: MappedData;
  error?: string;
}

interface Results {
  data: MappedData[];
  errors: { row: number; message: string; data: any }[];
  warnings: { row: number; message: string; data: any }[];
  skipped: number;
}

async function fetchImportProfile(supabase: any, partnerImportProfileId: string): Promise<ImportProfile | null> {
  const { data, error } = await supabase
    .from('partner_import_profiles')
    .select('*')
    .eq('id', partnerImportProfileId)
    .single();

  if (error) {
    console.error('Error fetching import profile:', error);
    return null;
  }

  return data;
}

async function fetchPartner(supabase: any, partnerId: string) {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)
    .single();

  if (error) {
    console.error('Error fetching partner:', error);
    return null;
  }

  return data;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      partnerImportProfileId, 
      csvData, 
      dryRun = false 
    } = await req.json()

    if (!partnerImportProfileId || !csvData) {
      return new Response(JSON.stringify({ error: 'Missing partnerImportProfileId or csvData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        },
      }
    )

    const importProfile = await fetchImportProfile(supabase, partnerImportProfileId);
    if (!importProfile) {
      return new Response(JSON.stringify({ error: 'Import profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const partner = await fetchPartner(supabase, importProfile.partner_id);
    if (!partner) {
      return new Response(JSON.stringify({ error: 'Partner not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Results = {
      data: [],
      errors: [],
      warnings: [],
      skipped: 0,
    };

    const columnMapping = importProfile.csv_column_mapping || {};
    const statusMapping = importProfile.status_mappings || {};
    const statusOverrideRules = importProfile.status_override_rules || {};
    const engineerMapping = importProfile.engineer_mapping || {};

    // Parse CSV data
    const parsedCsv = await parse(csvData, {
      skipFirstRow: true,
      header: true,
    });

    const batchSize = 100;
    for (let batchStart = 0; batchStart < parsedCsv.length; batchStart += batchSize) {
      const batch = parsedCsv.slice(batchStart, batchStart + batchSize);

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];

        const processRow = (row: any, i: number): ProcessedRow => {
          try {
            const mappedData: MappedData = {
              partner_external_id: row[columnMapping['partner_external_id']]?.toString()?.trim() || null,
              status: row[columnMapping['status']]?.toString()?.trim() || null,
              job_type: row[columnMapping['job_type']]?.toString()?.trim() || null,
              postcode: row[columnMapping['postcode']]?.toString()?.trim() || null,
              address: row[columnMapping['address']]?.toString()?.trim() || null,
              city: row[columnMapping['city']]?.toString()?.trim() || null,
              county: row[columnMapping['county']]?.toString()?.trim() || null,
              country: row[columnMapping['country']]?.toString()?.trim() || null,
              client_name: row[columnMapping['client_name']]?.toString()?.trim() || null,
              client_email: row[columnMapping['client_email']]?.toString()?.trim() || null,
              client_phone: row[columnMapping['client_phone']]?.toString()?.trim() || null,
              engineer_name: row[columnMapping['engineer_name']]?.toString()?.trim() || null,
              engineer_email: row[columnMapping['engineer_email']]?.toString()?.trim() || null,
              fault_description: row[columnMapping['fault_description']]?.toString()?.trim() || null,
              reported_fault: row[columnMapping['reported_fault']]?.toString()?.trim() || null,
              job_notes: row[columnMapping['job_notes']]?.toString()?.trim() || null,
              created_at: row[columnMapping['created_at']]?.toString()?.trim() || null,
              scheduled_date: row[columnMapping['scheduled_date']]?.toString()?.trim() || null,
              product_description: row[columnMapping['product_description']]?.toString()?.trim() || null,
              product_model: row[columnMapping['product_model']]?.toString()?.trim() || null,
              serial_number: row[columnMapping['serial_number']]?.toString()?.trim() || null,
              warranty_status: row[columnMapping['warranty_status']]?.toString()?.trim() || null,
              purchase_date: row[columnMapping['purchase_date']]?.toString()?.trim() || null,
              supplier: row[columnMapping['supplier']]?.toString()?.trim() || null,
              sub_partner: row[columnMapping['sub_partner']]?.toString()?.trim() || null,
              priority: row[columnMapping['priority']]?.toString()?.trim() || null,
              contact_method: row[columnMapping['contact_method']]?.toString()?.trim() || null,
              internal_notes: row[columnMapping['internal_notes']]?.toString()?.trim() || null,
              customer_ref: row[columnMapping['customer_ref']]?.toString()?.trim() || null,
              partner_status: row[columnMapping['partner_status']]?.toString()?.trim() || null,
            };

            if (!mappedData.partner_external_id) {
              results.skipped++;
              return { success: false, error: 'Missing partner_external_id' };
            }

            let mappedStatus = mappedData.status || 'unknown';
            
            // Apply status mapping from profile
            const statusMapping = importProfile.status_mappings || {};
            if (statusMapping[mappedStatus]) {
              mappedStatus = statusMapping[mappedStatus];
            }
            
            // Apply status override rules
            const statusOverrides = importProfile.status_override_rules || {};
            if (statusOverrides[mappedStatus]) {
              mappedStatus = statusOverrides[mappedStatus];
            }

            // Get status actions from the profile
            const statusActions = importProfile.status_actions || {};
            const actionConfig = statusActions[mappedData.status] || {};
            
            let jmsStatus = mappedStatus;
            let suppressScheduling = false;
            let suppressionReason = null;
            
            // Use actions configuration if available
            if (actionConfig.jms_status) {
              jmsStatus = actionConfig.jms_status;
            }
            
            if (actionConfig.actions) {
              if (actionConfig.actions.suppress_scheduling === true) {
                suppressScheduling = true;
                suppressionReason = actionConfig.actions.suppression_reason || `partner_status_${mappedData.status.toLowerCase()}`;
              } else if (actionConfig.actions.suppress_scheduling === false) {
                suppressScheduling = false;
                suppressionReason = null;
              }
            }

            // Validate JMS status is a valid database enum value
            const validOrderStatuses = [
              'quote_accepted', 'awaiting_payment', 'payment_received', 'awaiting_agreement', 
              'agreement_signed', 'awaiting_install_booking', 'scheduled', 'in_progress',
              'install_completed_pending_qa', 'completed', 'revisit_required', 'cancelled',
              'needs_scheduling', 'date_offered', 'date_accepted', 'date_rejected', 
              'offer_expired', 'on_hold_parts_docs', 'awaiting_final_payment'
            ];
            
            if (!validOrderStatuses.includes(jmsStatus)) {
              const statusDefaults: Record<string, string> = {
                'pending': 'awaiting_install_booking',
                'confirmed': 'scheduled', 
                'complete': 'completed',
                'completed': 'completed',
                'scheduled': 'scheduled',
                'in_progress': 'in_progress',
                'cancelled': 'cancelled',
                'on_hold': 'on_hold_parts_docs'
              };
              
              const defaultStatus = statusDefaults[jmsStatus.toLowerCase()] || 'awaiting_install_booking';
              console.warn(`Invalid status '${jmsStatus}' mapped to default: ${defaultStatus}`);
              
              results.warnings.push({
                row: i + batch.indexOf(row) + 1,
                message: `Invalid mapped status '${jmsStatus}' - using default '${defaultStatus}' instead`,
                data: mappedData
              });
              
              jmsStatus = defaultStatus;
            }

            console.log(`Status flow: ${mappedData.status} -> JMS: ${jmsStatus}, Suppressed: ${suppressScheduling}`);

            let mappedEngineerId: string | null = null;
            const mappedEngineer = row[engineerMapping['engineer_email']]?.toString()?.trim() || null;

            if (mappedEngineer) {
              const { data: engineerData, error: engineerError } = await supabase
                .from('engineers')
                .select('id')
                .eq('email', mappedEngineer)
                .single();

              if (engineerError) {
                console.error('Error fetching engineer:', engineerError);
              } else if (engineerData) {
                mappedEngineerId = engineerData.id;
              } else {
                console.warn(`Engineer with email ${mappedEngineer} not found`);
                results.warnings.push({
                  row: i + batch.indexOf(row) + 1,
                  message: `Engineer with email ${mappedEngineer} not found`,
                  data: mappedData
                });
              }
            }

            return {
              success: true,
              data: {
                ...mappedData,
                status_enhanced: jmsStatus,
                scheduling_suppressed: suppressScheduling,
                scheduling_suppressed_reason: suppressionReason,
                engineer_id: mappedEngineerId,
                is_partner_job: true,
                partner_id: importProfile.partner_id,
                partner_confirmed_externally: false,
                external_confirmation_source: 'partner_import',
              }
            };

          } catch (error) {
            console.error('Error processing row:', error);
            results.errors.push({
              row: i + batch.indexOf(row) + 1,
              message: error.message,
              data: row,
            });
            return { success: false, error: error.message };
          }
        };

        const processedRow = processRow(row, i);

        if (processedRow.success && processedRow.data) {
          results.data.push(processedRow.data);
        } else {
          results.errors.push({
            row: i + batch.indexOf(row) + 1,
            message: processedRow.error || 'Unknown error',
            data: row,
          });
        }
      }
    }

    // When updating orders, include the new scheduling fields
    if (!dryRun && results.data.length > 0) {
      const { error: updateError } = await supabase
        .from('orders')
        .upsert(results.data.map(item => ({
          ...item,
          updated_at: new Date().toISOString()
        })), {
          onConflict: 'partner_external_id,partner_id'
        });

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({ 
        data: results.data, 
        errors: results.errors, 
        warnings: results.warnings,
        skipped: results.skipped,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error(error)
    return new Response(String(error), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    })
  }
}
