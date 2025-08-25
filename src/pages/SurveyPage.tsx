import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isSurveyRequiredForOrder, getSurveyRequirementReason } from "@/utils/surveyUtils";
import { ClientSurveyWizard } from '@/components/survey/UpdatedClientSurveyWizard';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function SurveyPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Check if orderId is actually a survey token (32-character hex string)
  const isTokenInPath = orderId && /^[a-f0-9]{32}$/i.test(orderId);
  const surveyToken = isTokenInPath ? orderId : token;
  const actualOrderId = isTokenInPath ? undefined : orderId;

  const { data: orderData, isLoading, error } = useQuery({
    queryKey: ['survey-order', actualOrderId, surveyToken],
    queryFn: async () => {
      // If we have a survey token, use survey-lookup for public access
      if (surveyToken) {
        const { data, error } = await supabase.functions.invoke('survey-lookup', {
          body: { token: surveyToken }
        });

        if (error) throw new Error(error.message || 'Failed to access survey');
        if (!data.ok) throw new Error(data.error || 'Failed to access survey');
        return data.data;
      }

      // Otherwise use authenticated access with order ID
      if (!actualOrderId) throw new Error('Order ID is required');
      
      const { data, error } = await supabase
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
        .eq('id', actualOrderId)
        .maybeSingle();

      if (error) throw error;
      return { ...data, is_locked: false }; // No survey status for authenticated access
    },
    enabled: !!(actualOrderId || surveyToken),
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

  if (error || !orderData) {
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

  // Check if survey is required
  if (!isSurveyRequiredForOrder(orderData)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Survey Not Required
            </h1>
            <p className="text-slate-600">
              {getSurveyRequirementReason(orderData)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if survey is already completed (locked)
  if (orderData.is_locked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Survey Already Submitted
            </h1>
            <p className="text-slate-600 mb-4">
              This survey has already been completed and submitted for review.
            </p>
            {orderData.latest_survey?.submitted_at && (
              <p className="text-sm text-slate-500">
                Submitted on {new Date(orderData.latest_survey.submitted_at).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const partnerBrand = orderData.partners ? {
    name: orderData.partners.name,
    logo_url: orderData.partners.logo_url,
    hex: '#E30613', // Default color since primary_color doesn't exist
  } : undefined;

  return (
    <ClientSurveyWizard
      orderId={orderData.id}
      clientId={orderData.client_id}
      partnerId={orderData.partner_id}
      partnerBrand={partnerBrand}
      surveyToken={surveyToken}
      existingSurvey={orderData.latest_survey}
    />
  );
}
