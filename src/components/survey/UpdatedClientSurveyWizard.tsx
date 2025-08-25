import React, { useState, useEffect } from 'react';
import { useActiveSurveyForm } from '@/hooks/useSurveyForms';
import { SurveyFormSchema, SurveyStep } from '@/types/survey-forms';
import { DynamicSurveyWizard } from './DynamicSurveyWizard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClientSurveyWizardProps {
  orderId: string;
  clientId: string;
  partnerId?: string;
  partnerBrand?: {
    name: string;
    logo_url?: string;
  };
  surveyToken?: string;
  existingSurvey?: any;
}

export function ClientSurveyWizard({ orderId, clientId, partnerId, partnerBrand, surveyToken: initialSurveyToken, existingSurvey: initialExistingSurvey }: ClientSurveyWizardProps) {
  const { toast } = useToast();
  const contextType = partnerId ? 'partner' : 'direct';
  const { data: activeForm, isLoading } = useActiveSurveyForm(contextType);
  const [existingSurvey, setExistingSurvey] = useState<any>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [surveyToken, setSurveyToken] = useState<string | null>(initialSurveyToken || null);

  useEffect(() => {
    if (initialExistingSurvey) {
      setExistingSurvey(initialExistingSurvey);
      setSurveyId(initialExistingSurvey.id);
    } else {
      loadExistingSurvey();
    }
  }, [orderId, initialExistingSurvey]);

  const loadExistingSurvey = async () => {
    try {
      // Get order and survey data
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('survey_token')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      setSurveyToken(orderData.survey_token);

      const { data, error } = await supabase
        .from('client_surveys')
        .select(`
          id,
          responses,
          status,
          form_version_id,
          client_survey_media (
            id,
            field_key,
            file_url,
            file_name,
            media_type,
            file_size,
            storage_path,
            storage_bucket
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const survey = data[0];
        setExistingSurvey(survey);
        setSurveyId(survey.id);
      }
    } catch (error) {
      console.error('Error loading existing survey:', error);
    }
  };

  const saveDraft = async (responses: Record<string, any>, media: Record<string, any[]>) => {
    try {
      if (surveyToken) {
        // Use token-based saving for public access
        const { data, error } = await supabase.functions.invoke('survey-save', {
          body: { 
            token: surveyToken, 
            responses, 
            surveyId 
          }
        });

        if (error) throw new Error(error.message || 'Failed to save survey');
        if (!data.ok) throw new Error(data.error || 'Failed to save survey');
        
        if (data.data.surveyId && !surveyId) {
          setSurveyId(data.data.surveyId);
        }
      } else {
        // Use authenticated saving
        let currentSurveyId = surveyId;

        if (!currentSurveyId) {
          // Create new survey
          const { data: survey, error: surveyError } = await supabase
            .from('client_surveys')
            .insert({
              order_id: orderId,
              client_id: clientId,
              partner_id: partnerId,
              form_version_id: activeForm?.version_id,
              responses,
              status: 'draft'
            })
            .select()
            .single();

          if (surveyError) throw surveyError;
          currentSurveyId = survey.id;
          setSurveyId(currentSurveyId);
        } else {
          // Update existing survey
          const { error: updateError } = await supabase
            .from('client_surveys')
            .update({ responses })
            .eq('id', currentSurveyId);

          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Draft saved",
        description: "Your progress has been saved"
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive"
      });
    }
  };

  const submitSurvey = async (responses: Record<string, any>, media: Record<string, any[]>) => {
    try {
      if (surveyToken) {
        // Use token-based submission for public access
        const { data, error } = await supabase.functions.invoke('survey-submit', {
          body: { 
            token: surveyToken, 
            responses, 
            surveyId 
          }
        });

        if (error) throw new Error(error.message || 'Failed to submit survey');
        if (!data.ok) throw new Error(data.error || 'Failed to submit survey');
      } else {
        // Use authenticated submission
        await saveDraft(responses, media);

        // Update survey status to submitted
        const { error: statusError } = await supabase
          .from('client_surveys')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString()
          })
          .eq('id', surveyId);

        if (statusError) throw statusError;

        // Update order status
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status_enhanced: 'awaiting_survey_review'
          })
          .eq('id', orderId);

        if (orderError) throw orderError;
      }

      // Redirect to success page
      window.location.href = `/survey/${orderId}/success`;
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast({
        title: "Error",
        description: "Failed to submit survey",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading survey...</p>
        </div>
      </div>
    );
  }

  if (!activeForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Survey Not Available</h1>
          <p className="text-muted-foreground">
            No survey form is currently configured for this order type.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DynamicSurveyWizard
      schema={activeForm.schema as unknown as SurveyFormSchema}
      orderId={orderId}
      surveyId={surveyId}
      token={surveyToken}
      partnerBrand={partnerBrand}
      existingResponses={existingSurvey?.responses || {}}
      existingMedia={existingSurvey?.client_survey_media || []}
      onSaveDraft={saveDraft}
      onSubmit={submitSurvey}
    />
  );
}