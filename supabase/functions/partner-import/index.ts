import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parse } from 'https://deno.land/std@0.208.0/csv/mod.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ImportProfile {
  id: string;
  partner_id: string;
  gsheet_id?: string;
  gsheet_sheet_name?: string;
  source_type: 'csv' | 'gsheet';
  column_mappings: Record<string, string>;
  status_mappings: Record<string, string>;
  status_actions: Record<string, any>;
  engineer_mapping_rules: Array<{
    partner_identifier: string;
    engineer_id: string;
  }>;
}

interface MappedData {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  customer_address_line_1?: string;
  customer_address_line_2?: string;
  customer_address_city?: string;
  customer_address_post_code?: string;
  job_address?: string;
  postcode?: string;
  partner_status?: string;
  status?: string;
  partner_external_id?: string;
  partner_external_url?: string;
  quote_id?: string;
  quote_amount?: string;
  client_id?: string;
  engineer_identifier?: string;
  engineer_name?: string;
  engineer_email?: string;
  is_partner_job?: boolean;
  sub_partner?: string;
  scheduled_date?: string;
  job_notes?: string;
  job_type?: string;
  type?: string;
}

interface ProcessedRow {
  type: 'insert' | 'update' | 'skip';
  data: any;
  reason?: string;
}

interface Results {
  inserted: ProcessedRow[];
  updated: ProcessedRow[];
  skipped: ProcessedRow[];
  warnings: Array<{ row: number; column?: string; message: string; data?: any }>;
  errors: Array<{ row: number; message: string; data?: any }>;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Handle scientific notation (e.g., "4.41234567891E12" -> "441234567891")
  let normalizedPhone = phone.toString();
  if (normalizedPhone.includes('E') || normalizedPhone.includes('e')) {
    try {
      // Convert scientific notation to regular number string
      const numValue = parseFloat(normalizedPhone);
      if (!isNaN(numValue)) {
        normalizedPhone = numValue.toFixed(0);
      }
    } catch (e) {
      console.warn('Failed to parse scientific notation phone:', phone);
    }
  }

  // Remove all non-digit characters
  const digitsOnly = normalizedPhone.replace(/\D/g, '');
  
  if (!digitsOnly) {
    return null;
  }

  // Handle UK phone numbers
  if (digitsOnly.startsWith('44')) {
    // Convert 44XXXXXXXXXX to 0XXXXXXXXXX (UK format)
    const ukNumber = '0' + digitsOnly.substring(2);
    if (ukNumber.length === 11) {
      return ukNumber;
    }
  } else if (digitsOnly.length === 10) {
    // Add leading 0 to 10-digit numbers (assuming UK)
    return '0' + digitsOnly;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    // Already correct UK format
    return digitsOnly;
  }

  // Return as-is if it doesn't match common patterns
  return digitsOnly.length >= 10 ? digitsOnly : null;
}

function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }
  
  const trimmed = dateStr.trim();
  
  // If already in YYYY-MM-DD format, return as is (remove time if present)
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
    return trimmed.split('T')[0].split(' ')[0]; // Remove time component if present
  }
  
  // Strip time component from various formats (e.g., "22/08/2025 14:00" -> "22/08/2025")
  const dateOnly = trimmed.split(' ')[0];
  
  // Try to parse DD/MM/YYYY format first (UK format - preferred)
  const ddmmyyyyMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    
    // Validate date components
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
      return null;
    }
    
    // Convert to YYYY-MM-DD format
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    // Validate the final date is actually valid
    const testDate = new Date(isoDate);
    if (testDate.getFullYear() != parseInt(year) || 
        testDate.getMonth() + 1 != monthNum || 
        testDate.getDate() != dayNum) {
      return null;
    }
    
    return isoDate;
  }
  
  // Try MM/DD/YYYY format (US format - fallback)
  const mmddyyyyMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch;
    
    // Validate date components
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
      return null;
    }
    
    // For ambiguous dates (like 01/02/2025), prefer DD/MM unless it's clearly MM/DD
    // If day > 12, it must be DD/MM format, so this is MM/DD
    if (monthNum > 12) {
      return null; // Invalid month in MM/DD format
    }
    
    // Convert to YYYY-MM-DD format
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    // Validate the final date is actually valid
    const testDate = new Date(isoDate);
    if (testDate.getFullYear() != parseInt(year) || 
        testDate.getMonth() + 1 != monthNum || 
        testDate.getDate() != dayNum) {
      return null;
    }
    
    return isoDate;
  }
  
  // Try other common formats like DD-MM-YYYY or MM-DD-YYYY
  const dashMatch = dateOnly.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, first, second, year] = dashMatch;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    
    // Assume DD-MM-YYYY if first > 12, otherwise treat as MM-DD-YYYY
    let day, month;
    if (firstNum > 12) {
      day = firstNum;
      month = secondNum;
    } else {
      month = firstNum;
      day = secondNum;
    }
    
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return null;
    }
    
    const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    // Validate the final date
    const testDate = new Date(isoDate);
    if (testDate.getFullYear() != parseInt(year) || 
        testDate.getMonth() + 1 != month || 
        testDate.getDate() != day) {
      return null;
    }
    
    return isoDate;
  }
  
  return null;
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

async function getGoogleSheetsAuth() {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('Google Service Account Key not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  console.log('Google credentials parsed successfully, client_email:', credentials.client_email);

  const jwt = await createJWT(credentials);
  console.log('JWT generated successfully');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('No access token received');
  }
  console.log('Access token obtained successfully');
  
  return tokenData.access_token;
}

async function getTotalRowCount(sheetId: string, sheetName: string, accessToken: string): Promise<number> {
  // Get all values in column A to count non-empty rows
  const range = `${sheetName}!A:A`;
  const sheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!sheetResponse.ok) {
    const errorText = await sheetResponse.text();
    console.error('Sheets API error getting row count:', errorText);
    throw new Error(`Failed to get row count: ${errorText}`);
  }

  const sheetData = await sheetResponse.json();
  const rows = sheetData.values || [];
  
  // Count non-empty rows, subtract 1 for header
  const totalRows = Math.max(0, rows.filter(row => row && row[0] && row[0].toString().trim()).length - 1);
  console.log(`Total data rows found: ${totalRows}`);
  
  return totalRows;
}

async function fetchGoogleSheetData(sheetId: string, sheetName: string, startRow: number = 0, maxRows: number = 1000, totalRows?: number) {
  const accessToken = await getGoogleSheetsAuth();
  
  // Always fetch headers first
  const headersRange = `${sheetName}!A1:ZZ1`;
  const headersResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(headersRange)}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!headersResponse.ok) {
    const errorText = await headersResponse.text();
    console.error('Sheets API error getting headers:', errorText);
    throw new Error(`Failed to fetch headers: ${errorText}`);
  }

  const headersData = await headersResponse.json();
  const headers = headersData.values?.[0] || [];
  
  if (headers.length === 0) {
    throw new Error('No headers found in the sheet');
  }

  // Get total row count only if not provided
  if (totalRows === undefined) {
    totalRows = await getTotalRowCount(sheetId, sheetName, accessToken);
  }
  
  // If no data rows available, return early
  if (totalRows === 0) {
    console.log('No data rows found in sheet');
    return { headers, dataRows: [], totalRows: 0 };
  }

  // Calculate actual data range (add 2 to account for 1-based indexing and header row)
  const dataStartRow = startRow + 2;
  const dataEndRow = Math.min(startRow + maxRows + 1, totalRows + 1);
  
  // Fetch the actual data chunk
  const dataRange = `${sheetName}!A${dataStartRow}:ZZ${dataEndRow}`;
  console.log(`Fetching data range: ${dataRange} (rows ${startRow + 1}-${Math.min(startRow + maxRows, totalRows)} of ${totalRows})`);
  
  const dataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(dataRange)}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!dataResponse.ok) {
    const errorText = await dataResponse.text();
    console.error('Sheets API error getting data:', errorText);
    throw new Error(`Failed to fetch data: ${errorText}`);
  }

  const sheetData = await dataResponse.json();
  const rows = sheetData.values || [];
  
  console.log(`Google Sheets: Fetched ${rows.length} data rows for range ${dataRange}`);

  // Convert to objects
  const dataRows = rows.map((row: any[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });

  return { headers, dataRows, totalRows };
}

async function createJWT(credentials: any) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(JSON.stringify(header));
  const payloadBytes = encoder.encode(JSON.stringify(payload));

  const headerB64 = btoa(String.fromCharCode(...headerBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(String.fromCharCode(...payloadBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const message = `${headerB64}.${payloadB64}`;
  const messageBytes = encoder.encode(message);

  // Import the private key
  const pemKey = credentials.private_key.replace(/\\n/g, '\n');
  const keyData = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, messageBytes);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${message}.${signatureB64}`;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing partner import request...');
    const requestBody = await req.json();
    console.log('Request data received');

    const profileId = requestBody.profile_id || requestBody.partnerImportProfileId;
    const csvData = requestBody.csv_data || requestBody.csvData;
    const dryRun = requestBody.dry_run ?? requestBody.dryRun ?? true;
    const createMissingOrders = requestBody.create_missing_orders ?? requestBody.createMissingOrders ?? true;
    
    // Chunking parameters
    const startRow = requestBody.start_row ?? 0;
    const maxRows = requestBody.max_rows ?? 200;  // Increased default chunk size
    const chunkInfo = requestBody.chunk_info || null;
    const totalRowsFromPrevious = requestBody.total_rows || null;
    const verbose = requestBody.verbose ?? false;

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profile_id or partnerImportProfileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Creating Supabase client...');
    const supabase = createClient(
      supabaseUrl!,
      supabaseKey!,
      {
        global: {
          headers: { Authorization: `Bearer ${supabaseKey}` }
        }
      }
    );

    console.log('Fetching import profile...');
    const importProfile = await fetchImportProfile(supabase, profileId);
    if (!importProfile) {
      return new Response(JSON.stringify({ error: 'Import profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const partner = await fetchPartner(supabase, importProfile.partner_id);
    if (!partner) {
      return new Response(JSON.stringify({ error: 'Partner not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Import profile:', {
      id: importProfile.id,
      partner_id: importProfile.partner_id,
      source_type: importProfile.source_type,
      column_mappings_count: Object.keys(importProfile.column_mappings || {}).length,
      status_mappings_count: Object.keys(importProfile.status_mappings || {}).length
    });

    let parsedData: any[] = [];
    let totalRows = 0;

    // Fetch data based on source type
    if (importProfile.source_type === 'gsheet' && !csvData) {
      if (!importProfile.gsheet_id) {
        return new Response(JSON.stringify({ error: 'Google Sheet ID not configured for this profile' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('Fetching Google Sheet data...');
      const sheetResult = await fetchGoogleSheetData(
        importProfile.gsheet_id, 
        importProfile.gsheet_sheet_name || 'Sheet1',
        startRow,
        maxRows,
        totalRowsFromPrevious // Pass total rows to avoid re-counting
      );
      parsedData = sheetResult.dataRows;
      totalRows = sheetResult.totalRows;
    } else if (csvData) {
      const allCsvData = parse(csvData, {
        skipFirstRow: true,
        columns: undefined
      }) as any[];
      
      totalRows = allCsvData.length;
      const endRow = Math.min(startRow + maxRows, totalRows);
      
      if (startRow > 0 || maxRows < totalRows) {
        console.log(`Processing CSV chunk: rows ${startRow + 1}-${endRow} of ${totalRows}`);
        parsedData = allCsvData.slice(startRow, endRow);
      } else {
        parsedData = allCsvData;
      }
    } else {
      return new Response(JSON.stringify({ error: 'No data source provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const endRow = Math.min(startRow + parsedData.length, totalRows);

    if (verbose) {
      console.log(`Processing ${parsedData.length} rows in chunk (${startRow + 1}-${endRow} of ${totalRows})...`);
      
      // Log first and last few Job IDs for reconciliation
      if (parsedData.length > 0) {
        const firstFewIds = parsedData.slice(0, 3).map((row, idx) => 
          `Row ${startRow + idx + 1}: ${row['Job ID'] || 'N/A'}`
        ).join(', ');
        const lastFewIds = parsedData.slice(-3).map((row, idx) => 
          `Row ${startRow + parsedData.length - 3 + idx + 1}: ${row['Job ID'] || 'N/A'}`
        ).join(', ');
        console.log(`Sheet reconciliation - Chunk first rows: ${firstFewIds}`);
        console.log(`Sheet reconciliation - Chunk last rows: ${lastFewIds}`);
      }
    }

    const results: Results = {
      inserted: [],
      updated: [],
      skipped: [],
      warnings: [],
      errors: []
    };

    const columnMappings = importProfile.column_mappings || {};
    const statusMappings = importProfile.status_mappings || {};
    const statusActions = importProfile.status_actions || {};
    const engineerMapping: Record<string, string> = {};

    // Build engineer mapping from rules
    if (importProfile.engineer_mapping_rules) {
      for (const rule of importProfile.engineer_mapping_rules) {
        if (rule.partner_identifier && rule.engineer_id) {
          engineerMapping[rule.partner_identifier.toLowerCase()] = rule.engineer_id;
        }
      }
    }

    // Log first few headers and first mapped row for debugging
    if (verbose && parsedData.length > 0) {
      const firstRow = parsedData[0];
      console.log('Available columns:', Object.keys(firstRow));
      console.log('Column mappings:', columnMappings);
    }

    // Prepare batch collections for bulk operations
    const clientsToCreate: any[] = [];
    const clientsToFind: string[] = [];
    const ordersToProcess: any[] = [];
    const processedRows: ProcessedRow[] = [];

    // STEP 1: Map and validate all rows first
    for (const [index, row] of parsedData.entries()) {
      const rowIndex = startRow + index;  // Adjust for chunk offset
        
      try {
        // Map columns based on configuration
        const mappedData: MappedData = {};
        
        for (const [dbField, csvColumn] of Object.entries(columnMappings)) {
          if (csvColumn && row[csvColumn] !== undefined) {
            (mappedData as any)[dbField] = row[csvColumn];
          }
        }

        if (verbose) {
          console.log(`Row ${rowIndex + 1} mapped data:`, mappedData);
        }

          // Build consolidated customer address
          const addressParts = [
            mappedData.customer_address_line_1,
            mappedData.customer_address_line_2,
            mappedData.customer_address_city
          ].filter(Boolean);
          const consolidatedCustomerAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

          // Set job_address if not provided but customer address is available
          if (!mappedData.job_address && consolidatedCustomerAddress) {
            mappedData.job_address = consolidatedCustomerAddress;
          }

          // Set postcode from customer fields if not provided
          if (!mappedData.postcode && mappedData.customer_address_post_code) {
            mappedData.postcode = mappedData.customer_address_post_code;
          }

          // Parse and sanitize quote amount
          let sanitizedQuoteAmount = 0;
          if (mappedData.quote_amount) {
            const cleanAmount = String(mappedData.quote_amount)
              .replace(/[£,$\s]/g, '')  // Remove currency symbols, commas, and whitespace
              .trim();
            
            const parsedAmount = parseFloat(cleanAmount);
            
            // Check if the parsed amount is a valid finite number
            if (isFinite(parsedAmount) && !isNaN(parsedAmount)) {
              sanitizedQuoteAmount = parsedAmount;
            } else {
              console.log(`Invalid quote amount '${mappedData.quote_amount}' -> setting to 0`);
              results.warnings.push({
                row: rowIndex + 1,
                column: 'quote_amount',
                message: `Invalid quote amount '${mappedData.quote_amount}' converted to 0`,
                data: { original_amount: mappedData.quote_amount }
              });
            }
          }
          mappedData.quote_amount = sanitizedQuoteAmount.toString();

          // Generate partner external ID if missing
          if (!mappedData.partner_external_id) {
            mappedData.partner_external_id = `${partner.name}-${rowIndex + 1}-${Date.now()}`;
          }

          // Set partner job flag
          mappedData.is_partner_job = true;

          // Map status
          const partnerStatusFromColumn = mappedData.partner_status || mappedData.status;
          const originalPartnerStatus = partnerStatusFromColumn ? String(partnerStatusFromColumn).trim().toUpperCase() : 'UNKNOWN';
          const mappedStatus = statusMappings[originalPartnerStatus] || originalPartnerStatus.toLowerCase();

          if (verbose) {
            console.log(`Processing row ${rowIndex + 1}: Partner Status = '${originalPartnerStatus}'`);
          }

          // Use status actions as primary mapping
          const actionConfig = statusActions[originalPartnerStatus] || {};
          
          let jmsStatus = mappedStatus;
          let suppressScheduling = false;
          let suppressionReason = null;

          // Prefer status_actions over old status_mappings
          if (actionConfig.jms_status) {
            jmsStatus = actionConfig.jms_status;
            if (verbose) {
              console.log(`Using status action mapping: ${originalPartnerStatus} -> ${jmsStatus}`);
            }
          } else {
            // Default mappings for common partner statuses
            const defaultPartnerMappings: Record<string, string> = {
              'AWAITING_INSTALL_DATE': 'awaiting_install_booking',
              'AWAITING_QUOTATION': 'awaiting_install_booking',
              'CANCELLATION_REQUESTED': 'cancelled',
              'CANCELLED': 'cancelled',
              'COMPLETE': 'completed',
              'INSTALL_DATE_CONFIRMED': 'scheduled',
              'INSTALLED': 'install_completed_pending_qa',
              'ON_HOLD': 'on_hold_parts_docs',
              'SWITCH_JOB_SUB_TYPE_REQUESTED': 'on_hold_parts_docs',
              'UNKNOWN': 'awaiting_install_booking'
            };
            
            if (defaultPartnerMappings[originalPartnerStatus]) {
              jmsStatus = defaultPartnerMappings[originalPartnerStatus];
              if (verbose) {
                console.log(`Using default mapping: ${originalPartnerStatus} -> ${jmsStatus}`);
              }
            }
          }
          
          if (actionConfig.actions) {
            if (actionConfig.actions.suppress_scheduling === true) {
              suppressScheduling = true;
              suppressionReason = actionConfig.actions.suppression_reason || `partner_status_${originalPartnerStatus.toLowerCase()}`;
            } else if (actionConfig.actions.suppress_scheduling === false) {
              suppressScheduling = false;
              suppressionReason = null;
            }
          } else {
            // Default suppression rules for certain statuses
            const suppressByDefault = ['AWAITING_QUOTATION', 'CANCELLED', 'CANCELLATION_REQUESTED', 'COMPLETE', 'ON_HOLD'];
            suppressScheduling = suppressByDefault.includes(originalPartnerStatus);
            if (suppressScheduling) {
              suppressionReason = `partner_status_${originalPartnerStatus.toLowerCase()}`;
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
              'unknown': 'awaiting_install_booking',
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
            console.log(`Status flow: Invalid '${jmsStatus}' -> Default: ${defaultStatus}`);
            
            results.warnings.push({
              row: rowIndex + 1,
              column: 'status',
              message: `Invalid status '${jmsStatus}' mapped to '${defaultStatus}'`,
              data: { original_status: originalPartnerStatus, mapped_status: jmsStatus }
            });
            
            jmsStatus = defaultStatus;
          }

          // Map engineer
          let engineerId = null;
          const engineerIdentifier = mappedData.engineer_identifier || mappedData.engineer_name || mappedData.engineer_email;
          
          if (engineerIdentifier) {
            const engineerKey = String(engineerIdentifier).toLowerCase().trim();
            
            if (engineerMapping[engineerKey]) {
              engineerId = engineerMapping[engineerKey];
            } else {
              if (verbose) {
                console.log(`No engineer mapping found for: '${engineerKey}'`);
              }
              
              results.warnings.push({
                row: rowIndex + 1,
                column: 'engineer_identifier',
                message: `No engineer mapping found for identifier: '${engineerIdentifier}'`,
                data: { engineer_identifier: engineerIdentifier }
              });
            }
          }

          // Store client info for batch processing
          let clientId = mappedData.client_id;
          let needsClientCreation = false;
          
          if (!clientId && createMissingOrders && (mappedData.client_name || mappedData.client_email)) {
            // For batch processing, we'll create a unique key for client lookup
            const clientKey = `${mappedData.client_email || 'no-email'}_${mappedData.client_name || 'no-name'}`;
            
            if (mappedData.client_email) {
              clientsToFind.push(mappedData.client_email);
            }
            
            if (!dryRun) {
              needsClientCreation = true;
              
              const normalizedPhone = normalizePhone(mappedData.client_phone);
              if (mappedData.client_phone && !normalizedPhone) {
                results.warnings.push({
                  row: rowIndex + 1,
                  column: 'client_phone',
                  message: `Invalid phone number format: '${mappedData.client_phone}'. Phone number skipped.`,
                  data: { original_phone: mappedData.client_phone }
                });
              }

              const clientData = {
                full_name: mappedData.client_name || 'Unknown Client',
                email: mappedData.client_email || null,
                phone: normalizedPhone,
                address: consolidatedCustomerAddress || null,
                postcode: mappedData.customer_address_post_code || mappedData.postcode || null,
                is_partner_client: true,
                partner_id: partner.id,
                _clientKey: clientKey // Add for matching later
              };
              
              clientsToCreate.push(clientData);
            } else {
              // For dry run, simulate client creation
              clientId = 'placeholder-client-id';
            }
          }

          // Build order data with fingerprint for change detection
          const orderData: any = {
            partner_id: partner.id,
            client_id: clientId,
            partner_external_id: mappedData.partner_external_id,
            partner_external_url: mappedData.partner_external_url || null,
            job_address: mappedData.job_address || null,
            postcode: mappedData.postcode || null,
            status_enhanced: jmsStatus,
            partner_status: originalPartnerStatus, // Store the original partner status
            is_partner_job: true,
            engineer_id: engineerId,
            job_type: (mappedData.job_type || mappedData.type || 'installation').toLowerCase(),
            installation_notes: mappedData.job_notes || null,
            sub_partner: mappedData.sub_partner || null,
            total_amount: sanitizedQuoteAmount,
            scheduling_suppressed: suppressScheduling,
            scheduling_suppressed_reason: suppressionReason,
            // order_number will be auto-generated by trigger
            status: 'awaiting_payment',
            deposit_amount: 0,
            amount_paid: 0,
            _needsClientCreation: needsClientCreation,
            _clientKey: needsClientCreation ? `${mappedData.client_email || 'no-email'}_${mappedData.client_name || 'no-name'}` : null,
            _rowIndex: rowIndex
          };

          // Handle scheduled date
          if (mappedData.scheduled_date) {
            const parsedDate = parseDate(mappedData.scheduled_date);
            if (parsedDate) {
              orderData.scheduled_install_date = parsedDate;
              
              // If both engineer and date are assigned, force status to 'scheduled'
              if (engineerId && !suppressScheduling) {
                if (verbose) {
                  console.log(`Row ${rowIndex + 1}: Both engineer and date assigned, forcing status to 'scheduled'`);
                }
                orderData.status_enhanced = 'scheduled';
                orderData.scheduling_suppressed = false;
                orderData.scheduling_suppressed_reason = null;
              }
            } else {
              results.warnings.push({
                row: rowIndex + 1,
                column: 'scheduled_date',
                message: `Invalid date format: '${mappedData.scheduled_date}'. Expected DD/MM/YYYY HH:MM, MM/DD/YYYY HH:MM, or YYYY-MM-DD formats. Time component will be ignored.`,
                data: { scheduled_date: mappedData.scheduled_date }
              });
            }
          }

          // Create fingerprint for change detection
          const fingerprint = JSON.stringify({
            status: orderData.status_enhanced,
            partner_status: orderData.partner_status,
            engineer_id: orderData.engineer_id,
            scheduled_date: orderData.scheduled_install_date,
            job_address: orderData.job_address,
            total_amount: orderData.total_amount,
            suppressed: orderData.scheduling_suppressed
          });
          
          orderData.partner_metadata = orderData.partner_metadata || {};
          orderData.partner_metadata.import_fingerprint = fingerprint;

          ordersToProcess.push(orderData);

        } catch (error: any) {
          console.error(`Error processing row ${rowIndex + 1}:`, error);
          results.errors.push({
            row: rowIndex + 1,
            message: `Processing error: ${error.message}`,
            data: row
          });
        }
      }

      // STEP 2: Batch database operations for performance
      if (!dryRun) {
        try {
          // Batch 1: Find existing clients
          const existingClientEmails = [...new Set(clientsToFind)].filter(Boolean);
          const existingClientsMap = new Map();
          
          if (existingClientEmails.length > 0) {
            const { data: existingClients } = await supabase
              .from('clients')
              .select('id, email, full_name')
              .in('email', existingClientEmails);
              
            existingClients?.forEach(client => {
              existingClientsMap.set(client.email, client.id);
            });
          }

          // Batch 2: Create unique clients only
          const uniqueClientsToCreate = new Map();
          clientsToCreate.forEach(client => {
            if (!existingClientsMap.has(client.email) && !uniqueClientsToCreate.has(client._clientKey)) {
              uniqueClientsToCreate.set(client._clientKey, client);
            }
          });

          const newClientsMap = new Map();
          if (uniqueClientsToCreate.size > 0) {
            const clientsArray = Array.from(uniqueClientsToCreate.values());
            const { data: newClients, error: clientError } = await supabase
              .from('clients')
              .insert(clientsArray.map(({_clientKey, ...client}) => client))
              .select('id, email, full_name');

            if (clientError) {
              console.error('Batch client creation error:', clientError);
              // Individual error handling would need to be more sophisticated
            } else if (newClients) {
              clientsArray.forEach((client, index) => {
                if (newClients[index]) {
                  newClientsMap.set(client._clientKey, newClients[index].id);
                  existingClientsMap.set(client.email, newClients[index].id);
                }
              });
            }
          }

          // Batch 3: Get existing orders for fingerprint comparison
          const externalIds = ordersToProcess.map(order => order.partner_external_id).filter(Boolean);
          const existingOrdersMap = new Map();
          
          if (externalIds.length > 0) {
            const { data: existingOrders } = await supabase
              .from('orders')
              .select('id, partner_external_id, partner_metadata')
              .in('partner_external_id', externalIds)
              .eq('partner_id', partner.id);
              
            existingOrders?.forEach(order => {
              existingOrdersMap.set(order.partner_external_id, {
                id: order.id,
                fingerprint: order.partner_metadata?.import_fingerprint
              });
            });
          }

          // STEP 3: Process orders with fingerprint checking
          const ordersToInsert: any[] = [];
          const ordersToUpdate: any[] = [];
          
          for (const orderData of ordersToProcess) {
            try {
              // Map client ID from batch operations
              if (orderData._needsClientCreation && orderData._clientKey) {
                orderData.client_id = newClientsMap.get(orderData._clientKey) || existingClientsMap.get(orderData.client_id);
              }

              const existingOrder = existingOrdersMap.get(orderData.partner_external_id);
              const currentFingerprint = orderData.partner_metadata.import_fingerprint;
              
              // Clean up temp fields
              delete orderData._needsClientCreation;
              delete orderData._clientKey;
              const rowIndex = orderData._rowIndex;
              delete orderData._rowIndex;
              
              if (existingOrder) {
                // Check fingerprint to avoid unnecessary updates
                if (existingOrder.fingerprint !== currentFingerprint) {
                  ordersToUpdate.push({
                    id: existingOrder.id,
                    data: orderData,
                    rowIndex
                  });
                } else {
                  results.skipped.push({
                    type: 'skip',
                    data: { ...orderData, id: existingOrder.id },
                    reason: 'No changes detected'
                  });
                }
              } else {
                ordersToInsert.push({
                  data: orderData,
                  rowIndex
                });
              }
            } catch (error: any) {
              results.errors.push({
                row: orderData._rowIndex + 1,
                message: `Order processing error: ${error.message}`,
                data: orderData
              });
            }
          }

          // Batch 4: Bulk insert new orders
          if (ordersToInsert.length > 0) {
            const { data: insertedOrders, error: insertError } = await supabase
              .from('orders')
              .insert(ordersToInsert.map(item => item.data))
              .select('id');

            if (insertError) {
              console.error('Batch order insert error:', insertError);
              ordersToInsert.forEach(item => {
                results.errors.push({
                  row: item.rowIndex + 1,
                  message: `Failed to insert order: ${insertError.message}`,
                  data: item.data
                });
              });
            } else if (insertedOrders) {
              ordersToInsert.forEach((item, index) => {
                if (insertedOrders[index]) {
                  results.inserted.push({
                    type: 'insert',
                    data: { ...item.data, id: insertedOrders[index].id }
                  });
                  if (verbose) {
                    console.log(`Inserted order: ${insertedOrders[index].id}`);
                  }
                }
              });
            }
          }

          // Batch 5: Optimized bulk update for existing orders
          if (ordersToUpdate.length > 0) {
            // Process updates in chunks of 50 to avoid query complexity limits
            const updateChunkSize = 50;
            for (let i = 0; i < ordersToUpdate.length; i += updateChunkSize) {
              const updateChunk = ordersToUpdate.slice(i, i + updateChunkSize);
              
              try {
                // For small batches, use individual updates for safety
                if (updateChunk.length <= 5) {
                  for (const updateItem of updateChunk) {
                    const { error: updateError } = await supabase
                      .from('orders')
                      .update(updateItem.data)
                      .eq('id', updateItem.id);

                    if (updateError) {
                      results.errors.push({
                        row: updateItem.rowIndex + 1,
                        message: `Failed to update order: ${updateError.message}`,
                        data: updateItem.data
                      });
                    } else {
                      results.updated.push({
                        type: 'update',
                        data: { ...updateItem.data, id: updateItem.id }
                      });
                      if (verbose) {
                        console.log(`Updated order: ${updateItem.id}`);
                      }
                    }
                  }
                } else {
                  // For larger batches, use upsert operation
                  const upsertData = updateChunk.map(item => ({
                    id: item.id,
                    ...item.data,
                    updated_at: new Date().toISOString()
                  }));

                  const { data: upsertedOrders, error: upsertError } = await supabase
                    .from('orders')
                    .upsert(upsertData, { 
                      onConflict: 'id',
                      ignoreDuplicates: false
                    })
                    .select('id');

                  if (upsertError) {
                    console.error('Batch order upsert error:', upsertError);
                    updateChunk.forEach(item => {
                      results.errors.push({
                        row: item.rowIndex + 1,
                        message: `Failed to update order: ${upsertError.message}`,
                        data: item.data
                      });
                    });
                  } else if (upsertedOrders) {
                    updateChunk.forEach((item, index) => {
                      if (upsertedOrders[index]) {
                        results.updated.push({
                          type: 'update',
                          data: { ...item.data, id: item.id }
                        });
                        if (verbose) {
                          console.log(`Updated order: ${item.id}`);
                        }
                      }
                    });
                  }
                }
              } catch (error: any) {
                updateChunk.forEach(item => {
                  results.errors.push({
                    row: item.rowIndex + 1,
                    message: `Update batch error: ${error.message}`,
                    data: item.data
                  });
                });
              }
            }
          }

        } catch (batchError: any) {
          console.error('Batch processing error:', batchError);
          results.errors.push({
            row: 0,
            message: `Batch processing failed: ${batchError.message}`,
            data: { error: batchError }
          });
        }
      } else {
        // For dry run, simulate all orders as inserts
        ordersToProcess.forEach(orderData => {
          const processedRow: ProcessedRow = {
            type: 'insert',
            data: orderData
          };
          results.inserted.push(processedRow);
        });
      }

    // Log results summary
    console.log('Import chunk completed:', {
      chunk_rows: parsedData.length,
      chunk_range: `${startRow + 1}-${endRow}`,
      total_available: totalRows,
      inserted: results.inserted.length,
      updated: results.updated.length,
      skipped: results.skipped.length,
      warnings: results.warnings.length,
      errors: results.errors.length,
      dry_run: dryRun
    });

    // Log import run to database (only if not dry run)
    if (!dryRun) {
      try {
        await supabase.rpc('log_partner_import', {
          p_run_id: `import-${Date.now()}`,
          p_partner_id: partner.id,
          p_profile_id: importProfile.id,
          p_dry_run: dryRun,
          p_total_rows: parsedData.length,
          p_inserted_count: results.inserted.length,
          p_updated_count: results.updated.length,
          p_skipped_count: results.skipped.length,
          p_warnings: results.warnings,
          p_errors: results.errors
        });
      } catch (logError) {
        console.error('Failed to log import run:', logError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      chunk_info: {
        start_row: startRow,
        end_row: endRow,
        processed_count: parsedData.length,
        total_rows: totalRows,
        has_more: endRow < totalRows,
        next_start_row: endRow < totalRows ? endRow : null
      },
      results: {
        inserted: results.inserted.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        warnings: results.warnings.length,
        errors: results.errors.length
      },
      // Add backward compatibility for UI
      summary: {
        processed: parsedData.length,
        inserted_count: results.inserted.length,
        updated_count: results.updated.length,
        skipped_count: results.skipped.length,
        errors: results.errors,
        warnings: results.warnings,
        dry_run: dryRun
      },
      details: {
        inserted: results.inserted,
        updated: results.updated,
        skipped: results.skipped,
        warnings: results.warnings,
        errors: results.errors
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Partner import error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      details: error.stack || null,
      results: {
        inserted: 0,
        updated: 0,
        skipped: 0,
        warnings: 0,
        errors: 1
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});