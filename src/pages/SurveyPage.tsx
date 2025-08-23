import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientSurveyWizard } from '@/components/survey/ClientSurveyWizard';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function SurveyPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { data: orderData, isLoading, error } = useQuery({
    queryKey: ['survey-order', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');

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
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
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
  if (!orderData.survey_required) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              Survey Not Required
            </h1>
            <p className="text-slate-600">
              A survey is not required for this order. If you believe this is an error, please contact support.
            </p>
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
    />
  );
}