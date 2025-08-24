import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const surveyId = formData.get('surveyId') as string;
    const mediaType = formData.get('mediaType') as string;
    const fieldKey = formData.get('fieldKey') as string;
    const token = formData.get('token') as string;
    const position = parseInt(formData.get('position') as string) || 0;
    const isMain = formData.get('isMain') === 'true';

    // Validate required fields
    if (!file || !orderId || !mediaType || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify survey token and get order info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, survey_token, survey_token_expires_at, client_id')
      .eq('id', orderId)
      .eq('survey_token', token)
      .single();

    if (orderError || !order) {
      console.error('Invalid survey token:', orderError);
      return new Response(
        JSON.stringify({ error: 'Invalid survey token' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token has expired
    if (order.survey_token_expires_at && new Date(order.survey_token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Survey token has expired' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const storagePath = `surveys/${orderId}/${fieldKey || mediaType}/${timestamp}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(storagePath, file, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signed URL for immediate access
    const { data: urlData, error: urlError } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (urlError) {
      console.error('URL generation error:', urlError);
      // Continue without signed URL as fallback
    }

    // Save to database with storage info
    const { data: mediaData, error: dbError } = await supabase
      .from('client_survey_media')
      .insert({
        survey_id: surveyId,
        order_id: orderId,
        media_type: mediaType,
        file_name: file.name,
        file_size: file.size,
        storage_bucket: 'client-documents',
        storage_path: storagePath,
        file_url: urlData?.signedUrl || '', // Fallback to empty string
        field_key: fieldKey,
        position: position,
        is_main: isMain,
        uploaded_by: null, // Anonymous upload via token
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      
      // Clean up uploaded file on database error
      await supabase.storage
        .from('client-documents')
        .remove([storagePath]);

      return new Response(
        JSON.stringify({ error: 'Failed to save file metadata' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File uploaded successfully:', { 
      orderId, 
      fileName: file.name, 
      storagePath, 
      mediaId: mediaData.id 
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: mediaData.id,
          file_name: file.name,
          file_size: file.size,
          storage_path: storagePath,
          storage_bucket: 'client-documents',
          media_type: mediaType,
          position: position,
          is_main: isMain,
          signed_url: urlData?.signedUrl,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in survey-upload:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});