import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('test') === '1') {
      return json({ ok: true, status: 'alive', function: url.pathname }, 200, requestId);
    }

    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, requestId);
    }

    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token) {
      return json({ ok: false, error: 'Survey token is required' }, 400, requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

  // First get the order
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      client_id,
      partner_id,
      is_partner_job,
      survey_required,
      survey_token_expires_at,
      clients!inner (
        id,
        full_name,
        email
      ),
      partners (
        id,
        name,
        logo_url
      )
    `)
    .eq('survey_token', token)
    .maybeSingle();

  if (error || !order) {
    console.error('Order lookup failed:', error);
    if (error?.code === 'PGRST116') {
      return json({ ok: false, error: 'Invalid or expired survey link' }, 404, requestId);
    }
    return json({ ok: false, error: 'Database error occurred' }, 500, requestId);
  }

  // Get the latest survey for this order
  const { data: latestSurvey } = await supabase
    .from('client_surveys')
    .select('id, status, submitted_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check if survey token has expired
  if (order.survey_token_expires_at && new Date(order.survey_token_expires_at) < new Date()) {
    return json({ ok: false, error: 'Survey link has expired' }, 410, requestId);
  }

  // Determine if survey is locked (completed)
  const isLocked = latestSurvey && ['submitted', 'approved', 'under_review', 'resubmitted'].includes(latestSurvey.status);

  return json({ 
    ok: true, 
    data: {
      ...order,
      latest_survey: latestSurvey,
      is_locked: isLocked
    }
  }, 200, requestId);

  } catch (error) {
    console.error('Survey lookup error:', error);
    return json({ ok: false, error: String(error) }, 500, requestId);
  }
});