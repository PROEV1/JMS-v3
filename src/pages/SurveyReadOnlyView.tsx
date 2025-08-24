import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SurveyReadOnlyView } from '@/components/survey/SurveyReadOnlyView';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function SurveyReadOnlyViewPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { data: surveyData, isLoading, error } = useQuery({
    queryKey: ['survey-readonly', orderId, token],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');

      // If we have a token, use survey-lookup for public access
      if (token) {
        const { data, error } = await supabase.functions.invoke('survey-lookup', {
          body: { token }
        });

        if (error) throw new Error(error.message || 'Failed to access survey');
        if (!data.ok) throw new Error(data.error || 'Failed to access survey');
        
        // Fetch the survey data for this order
        const { data: surveyResult, error: surveyError } = await supabase
          .from('client_surveys')
          .select(`
            *,
            client_survey_media (*)
          `)
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (surveyError) throw surveyError;
        if (!surveyResult) throw new Error('No survey found for this order');

        return {
          survey: surveyResult,
          order: data.data
        };
      }

      // Otherwise use authenticated access
      const [surveyResult, orderResult] = await Promise.all([
        supabase
          .from('client_surveys')
          .select(`
            *,
            client_survey_media (*)
          `)
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('orders')
          .select(`
            id,
            order_number,
            client_id,
            partner_id,
            is_partner_job,
            survey_required,
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
          .eq('id', orderId)
          .maybeSingle()
      ]);

      if (surveyResult.error && surveyResult.error.code !== 'PGRST116') throw surveyResult.error;
      if (orderResult.error) throw orderResult.error;
      if (!surveyResult.data) throw new Error('No survey found for this order');

      return {
        survey: surveyResult.data,
        order: orderResult.data
      };
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error || !surveyData?.survey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Survey Not Found
            </h1>
            <p className="text-slate-600 mb-4">
              We couldn't find the survey you're looking for. Please check your link or contact support.
            </p>
            <p className="text-sm text-slate-500">
              Error: {error?.message || 'Survey not accessible'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SurveyReadOnlyView 
      survey={surveyData.survey}
      media={surveyData.survey.client_survey_media || []}
    />
  );
}
