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
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, requestId);
    }

    const body = await req.json().catch(() => ({}));
    const { token, responses, surveyId } = body;

    if (!token) {
      return json({ ok: false, error: 'Survey token is required' }, 400, requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the token and get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, client_id, partner_id')
      .eq('survey_token', token)
      .maybeSingle();

    if (orderError || !order) {
      return json({ ok: false, error: 'Invalid survey token' }, 404, requestId);
    }

    // First ensure we have a survey to submit
    let currentSurveyId = surveyId;

    if (!currentSurveyId) {
      // Create survey if it doesn't exist
      const contextType = order.partner_id ? 'partner' : 'direct';
      const { data: activeForm } = await supabase.rpc('get_active_survey_form', { 
        p_context_type: contextType 
      }).maybeSingle();

      const { data: survey, error: surveyError } = await supabase
        .from('client_surveys')
        .insert({
          order_id: order.id,
          client_id: order.client_id,
          partner_id: order.partner_id,
          form_version_id: activeForm?.version_id,
          responses,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (surveyError) {
        console.error('Error creating survey:', surveyError);
        return json({ ok: false, error: 'Failed to create survey' }, 500, requestId);
      }

      currentSurveyId = survey.id;
    } else {
      // Update existing survey and mark as submitted
      const { error: updateError } = await supabase
        .from('client_surveys')
        .update({ 
          responses,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', currentSurveyId)
        .eq('order_id', order.id); // Ensure we own this survey

      if (updateError) {
        console.error('Error updating survey:', updateError);
        return json({ ok: false, error: 'Failed to submit survey' }, 500, requestId);
      }
    }

    // The order status will be updated automatically by the database trigger

    return json({ 
      ok: true, 
      data: { 
        surveyId: currentSurveyId,
        message: 'Survey submitted successfully'
      }
    }, 200, requestId);

  } catch (error) {
    console.error('Survey submit error:', error);
    return json({ ok: false, error: String(error) }, 500, requestId);
  }
});