import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { isSurveyRequiredForOrder, getSurveyRequirementReason } from "@/utils/surveyUtils";

export function EnhancedSurveySection({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = React.useState('');
  const [reworkReason, setReworkReason] = React.useState('');

  // Fetch survey and order data
  const { data: surveyData, isLoading } = useQuery({
    queryKey: ['order-survey', orderId],
    queryFn: async () => {
      const { data: survey, error: surveyError } = await supabase
        .from('client_surveys')
        .select(`
          *,
          survey_form_versions (
            schema,
            version_number,
            survey_forms (
              name
            )
          ),
          client_survey_media (
            id,
            field_key,
            file_url,
            file_name,
            media_type,
            position
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (surveyError) throw surveyError;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('survey_required, survey_token, survey_token_expires_at')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      return { survey: survey?.[0] || null, order };
    }
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('client_surveys')
        .update({
          status: 'approved',
          review_notes: reviewNotes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', surveyData?.survey.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-survey', orderId] });
      toast({ title: "Survey approved", description: "Survey has been approved and client notified" });
      setReviewNotes('');
    }
  });

  // Request rework mutation
  const requestReworkMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('client_surveys')
        .update({
          status: 'rework_requested',
          rework_reason: reworkReason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', surveyData?.survey.id);

      if (error) throw error;

      // Send rework notification email
      await supabase.functions.invoke('send-survey-rework-email', {
        body: { orderId, reason: reworkReason }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-survey', orderId] });
      toast({ title: "Rework requested", description: "Client has been notified of required changes" });
      setReworkReason('');
    }
  });

  if (isLoading) return <div>Loading survey...</div>;

  const survey = surveyData?.survey;
  const order = surveyData?.order;

  if (!isSurveyRequiredForOrder(order)) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {getSurveyRequirementReason(order)}
        </CardContent>
      </Card>
    );
  }

  if (!survey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Survey</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No survey submitted yet</p>
          {order.survey_token && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-sm">Survey link: <code>/survey/{orderId}?token={order.survey_token}</code></p>
              {order.survey_token_expires_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expires: {new Date(order.survey_token_expires_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      submitted: { variant: 'outline' as const, label: 'Awaiting Review' },
      under_review: { variant: 'outline' as const, label: 'Under Review' },
      approved: { variant: 'default' as const, label: 'Approved' },
      rework_requested: { variant: 'destructive' as const, label: 'Rework Requested' },
      resubmitted: { variant: 'outline' as const, label: 'Resubmitted' }
    };
    
    const config = variants[status as keyof typeof variants] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderDynamicResponses = () => {
    if (!survey.survey_form_versions?.schema) return null;

    const schema = survey.survey_form_versions.schema as any;
    const responses = survey.responses as Record<string, any>;
    const mediaByField = (survey.client_survey_media || []).reduce((acc: any, media: any) => {
      if (!acc[media.field_key]) acc[media.field_key] = [];
      acc[media.field_key].push(media);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {schema.steps?.map((step: any, stepIndex: number) => (
          <Card key={step.key}>
            <CardHeader>
              <CardTitle className="text-lg">{step.title}</CardTitle>
              {step.description && (
                <p className="text-sm text-muted-foreground">{step.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {step.fields?.map((field: any) => {
                const value = responses[field.key];
                const media = mediaByField[field.key] || [];

                return (
                  <div key={field.key} className="border-b pb-4 last:border-b-0">
                    <h4 className="font-medium mb-2">
                      {field.settings.label}
                      {field.settings.required && <span className="text-destructive ml-1">*</span>}
                    </h4>
                    
                    {field.type === 'photo' || field.type === 'video' || field.type === 'file' ? (
                      <div className="space-y-2">
                        {media.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {media.map((item: any) => (
                              <div key={item.id} className="relative group">
                                {item.media_type === 'photo' && (
                                  <img
                                    src={item.file_url}
                                    alt={item.file_name}
                                    className="w-full h-24 object-cover rounded border cursor-pointer hover:shadow-md"
                                    onClick={() => window.open(item.file_url, '_blank')}
                                  />
                                )}
                                {item.media_type === 'video' && (
                                  <div className="w-full h-24 bg-muted rounded border flex items-center justify-center cursor-pointer hover:shadow-md"
                                       onClick={() => window.open(item.file_url, '_blank')}>
                                    <Video className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                                {item.media_type === 'file' && (
                                  <div className="w-full h-24 bg-muted rounded border flex items-center justify-center cursor-pointer hover:shadow-md"
                                       onClick={() => window.open(item.file_url, '_blank')}>
                                    <FileText className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                                <p className="text-xs text-center mt-1 truncate">{item.file_name}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No files uploaded</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm">
                        {Array.isArray(value) ? (
                          <ul className="list-disc list-inside">
                            {value.map((item, idx) => <li key={idx}>{item}</li>)}
                          </ul>
                        ) : typeof value === 'object' && value !== null ? (
                          <pre className="bg-muted p-2 rounded text-xs">{JSON.stringify(value, null, 2)}</pre>
                        ) : (
                          <span>{value || 'No response'}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Survey Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Survey Response
            {getStatusBadge(survey.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Form:</strong> {survey.survey_form_versions?.survey_forms?.name} v{survey.survey_form_versions?.version_number}
            </div>
            <div>
              <strong>Submitted:</strong> {survey.submitted_at ? new Date(survey.submitted_at).toLocaleString() : 'Not submitted'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Survey Responses */}
      {survey.status !== 'draft' && renderDynamicResponses()}

      {/* Review Actions */}
      {(survey.status === 'submitted' || survey.status === 'resubmitted') && (
        <Card>
          <CardHeader>
            <CardTitle>Review Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="approve">
              <TabsList>
                <TabsTrigger value="approve">Approve</TabsTrigger>
                <TabsTrigger value="rework">Request Rework</TabsTrigger>
              </TabsList>
              
              <TabsContent value="approve" className="space-y-4">
                <Textarea
                  placeholder="Add review notes (optional)..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve Survey'}
                </Button>
              </TabsContent>
              
              <TabsContent value="rework" className="space-y-4">
                <Textarea
                  placeholder="Explain what needs to be corrected..."
                  value={reworkReason}
                  onChange={(e) => setReworkReason(e.target.value)}
                  required
                />
                <Button
                  onClick={() => requestReworkMutation.mutate()}
                  disabled={requestReworkMutation.isPending || !reworkReason.trim()}
                  variant="destructive"
                  className="w-full"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {requestReworkMutation.isPending ? 'Requesting...' : 'Request Rework'}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}