import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, FileText, Image, Video, Eye, Copy, ExternalLink, Send, Link } from 'lucide-react';
import { SignedImage } from '@/components/ui/SignedImage';
import { SignedFile } from '@/components/ui/SignedFile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SurveySectionProps {
  orderId: string;
}

export function SurveySection({ orderId }: SurveySectionProps) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: surveyData, isLoading } = useQuery({
    queryKey: ['survey-with-order', orderId],
    queryFn: async () => {
      // Fetch both survey and order data
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
            survey_token,
            survey_token_expires_at,
            survey_required,
            order_number,
            is_partner_job,
            partner_id,
            client:clients(full_name, email)
          `)
          .eq('id', orderId)
          .single()
      ]);

      if (surveyResult.error && surveyResult.error.code !== 'PGRST116') throw surveyResult.error;
      if (orderResult.error) throw orderResult.error;

      return {
        survey: surveyResult.data,
        order: orderResult.data
      };
    },
  });

  const survey = surveyData?.survey;
  const order = surveyData?.order;

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!survey) return;
      
      const { error } = await supabase
        .from('client_surveys')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', survey.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Survey approved successfully' });
      queryClient.invalidateQueries({ queryKey: ['survey-with-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error approving survey:', error);
      toast({ title: 'Error approving survey', variant: 'destructive' });
    },
  });

  const requestReworkMutation = useMutation({
    mutationFn: async () => {
      if (!survey) return;
      
      const { error } = await supabase
        .from('client_surveys')
        .update({
          status: 'rework_requested',
          reviewed_at: new Date().toISOString(),
          rework_reason: reworkReason,
        })
        .eq('id', survey.id);

      if (error) throw error;

      // Send rework email notification
      await supabase.functions.invoke('send-survey-rework-email', {
        body: {
          orderId,
          surveyId: survey.id,
          reworkReason,
        },
      });
    },
    onSuccess: () => {
      toast({ title: 'Rework request sent to client' });
      queryClient.invalidateQueries({ queryKey: ['survey-with-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error requesting rework:', error);
      toast({ title: 'Error requesting rework', variant: 'destructive' });
    },
  });

  // Generate survey link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('generate_survey_token');
      if (error) throw error;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          survey_token_expires_at: expiresAt.toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Survey Link Generated",
        description: "A new survey link has been generated and is ready to share.",
      });
      queryClient.invalidateQueries({ queryKey: ['survey-with-order', orderId] });
    },
    onError: (error) => {
      console.error('Error generating survey link:', error);
      toast({
        title: "Error",
        description: "Failed to generate survey link",
        variant: "destructive",
      });
    },
  });

  // Resend survey email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('send-survey-email', {
        body: {
          order_id: orderId,
          client_name: order?.client.full_name,
          client_email: order?.client.email,
          order_number: order?.order_number,
          survey_token: order?.survey_token
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Survey Email Sent",
        description: "Survey email has been resent to the client.",
      });
    },
    onError: (error) => {
      console.error('Error resending survey email:', error);
      toast({
        title: "Error",
        description: "Failed to resend survey email",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Survey link copied successfully",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const getSurveyLink = () => {
    if (!order?.survey_token) return null;
    return `${window.location.origin}/survey/${orderId}?token=${order.survey_token}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <div className="text-slate-500">Loading survey data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!survey) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <div className="text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-2" />
            <div className="text-slate-500">No survey submitted yet</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
      submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
      under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
      rework_requested: { label: 'Rework Requested', color: 'bg-red-100 text-red-700' },
      resubmitted: { label: 'Resubmitted', color: 'bg-purple-100 text-purple-700' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={config?.color || 'bg-slate-100 text-slate-700'}>
        {config?.label || status}
      </Badge>
    );
  };

  const responses = survey.responses as any;
  const media = survey.client_survey_media || [];

  return (
    <div className="space-y-6">
      {/* Survey Access Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Survey Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order?.survey_token ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Shareable Survey Link</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 p-2 bg-muted rounded border text-sm font-mono break-all">
                    {getSurveyLink()}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(getSurveyLink()!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(getSurveyLink(), '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {order.survey_token_expires_at && (
                <div className="text-sm text-muted-foreground">
                  Expires: {new Date(order.survey_token_expires_at).toLocaleDateString()}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resendEmailMutation.mutate()}
                  disabled={resendEmailMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {resendEmailMutation.isPending ? 'Sending...' : 'Resend Email'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-3">No survey link generated yet</p>
              <Button
                onClick={() => generateLinkMutation.mutate()}
                disabled={generateLinkMutation.isPending}
              >
                <Link className="h-4 w-4 mr-2" />
                {generateLinkMutation.isPending ? 'Generating...' : 'Generate Survey Link'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Survey Status and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CardTitle>Survey Status</CardTitle>
              {getStatusBadge(survey.status)}
            </div>
            
            {survey && (survey.status === 'submitted' || survey.status === 'resubmitted') ? (
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestReworkMutation.mutate()}
                  disabled={requestReworkMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Request Rework
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                {order?.survey_token && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`${window.location.origin}/survey-view/${orderId}?token=${order.survey_token}`, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Survey
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </CardHeader>
        
        {survey && (survey.status === 'submitted' || survey.status === 'resubmitted') && (
          <CardContent className="space-y-4">
            <Tabs defaultValue="approve" className="w-full">
              <TabsList>
                <TabsTrigger value="approve">Approve</TabsTrigger>
                <TabsTrigger value="rework">Request Rework</TabsTrigger>
              </TabsList>
              
              <TabsContent value="approve" className="space-y-3">
                <Label htmlFor="reviewNotes">Review Notes (optional)</Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about the approval..."
                  rows={3}
                />
              </TabsContent>
              
              <TabsContent value="rework" className="space-y-3">
                <Label htmlFor="reworkReason">Reason for Rework *</Label>
                <Textarea
                  id="reworkReason"
                  value={reworkReason}
                  onChange={(e) => setReworkReason(e.target.value)}
                  placeholder="Explain what needs to be changed or added..."
                  rows={3}
                  required
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>

      {/* Survey Responses */}
      {survey ? (
        <Card>
          <CardHeader>
            <CardTitle>Survey Responses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Property Details */}
            {responses.propertyDetails && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Property Details</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Property Type:</span>
                    <span className="ml-2 font-medium">{responses.propertyDetails.propertyType}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Parking:</span>
                    <span className="ml-2 font-medium">{responses.propertyDetails.parkingType}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Postcode:</span>
                    <span className="ml-2 font-medium">{responses.propertyDetails.postcode}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Year Built:</span>
                    <span className="ml-2 font-medium">{responses.propertyDetails.yearBuilt}</span>
                  </div>
                </div>
                {responses.propertyDetails.notes && (
                  <div className="text-sm">
                    <span className="text-slate-600">Notes:</span>
                    <span className="ml-2">{responses.propertyDetails.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Survey Responses */}
          {responses.parkingAccess && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Parking Access</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm">
                  <span className="text-slate-600">Access:</span>
                  <span className="ml-2 font-medium">{responses.parkingAccess}</span>
                </div>
              </div>
            </div>
          )}

          {/* Charger Location */}
          {responses.chargerLocation && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Charger Location</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm">
                  <span className="text-slate-600">Location:</span>
                  <span className="ml-2 font-medium">{responses.chargerLocation}</span>
                </div>
              </div>
            </div>
          )}

          {/* Consumer Unit */}
          {responses.consumerUnit && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Consumer Unit</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(responses.consumerUnit).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="ml-2 font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Video Summary */}
          {responses.videoSummary && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Video Summary</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm">{responses.videoSummary}</p>
              </div>
            </div>
          )}

            {/* Media Gallery */}
            {media.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Uploaded Media</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {media.map((item, index) => (
                    <div key={index} className="relative group">
                      {item.media_type === 'image' ? (
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                          {item.storage_path ? (
                            <SignedImage
                              bucket={item.storage_bucket || 'client-documents'}
                              path={item.storage_path}
                              fallbackUrl="/placeholder.svg"
                              className="w-full h-full object-cover"
                              alt={item.file_name || 'Survey image'}
                            />
                          ) : (
                            <img
                              src={item.file_url}
                              alt={item.file_name || 'Survey image'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                            <Image className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                          </div>
                        </div>
                      ) : item.media_type === 'video' ? (
                        <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                          {item.storage_path ? (
                            <SignedFile
                              bucket={item.storage_bucket || 'client-documents'}
                              path={item.storage_path}
                              fileName={item.file_name}
                              variant="ghost"
                              className="w-full h-full"
                              showIcon={false}
                            >
                              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                <Video size={32} className="mb-2" />
                                <span className="text-xs text-center px-2">{item.file_name}</span>
                              </div>
                            </SignedFile>
                          ) : (
                            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full text-slate-600 hover:text-slate-800">
                              <Video size={32} className="mb-2" />
                              <span className="text-xs text-center px-2">{item.file_name}</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square rounded-lg bg-slate-100 flex items-center justify-center">
                          {item.storage_path ? (
                            <SignedFile
                              bucket={item.storage_bucket || 'client-documents'}
                              path={item.storage_path}
                              fileName={item.file_name}
                              variant="ghost"
                              className="w-full h-full"
                              showIcon={false}
                            >
                              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                <FileText size={32} className="mb-2" />
                                <span className="text-xs text-center px-2">{item.file_name}</span>
                              </div>
                            </SignedFile>
                          ) : (
                            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full text-slate-600 hover:text-slate-800">
                              <FileText size={32} className="mb-2" />
                              <span className="text-xs text-center px-2">{item.file_name}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw data fallback for debugging */}
            <details className="border rounded-lg">
              <summary className="p-3 cursor-pointer font-medium">View All Raw Data</summary>
              <div className="p-3 pt-0">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(responses, null, 2)}
                </pre>
              </div>
            </details>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <div className="text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-2" />
              <div className="text-slate-500">
                {order?.survey_required === false ? 'Survey not required for this order' : 'No survey submitted yet'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legacy Media Gallery Card - Remove this if media is shown above */}
      {survey && media.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Media Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map((item: any) => (
                <div key={item.id} className="relative group">
                  {item.media_type === 'image' ? (
                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                      {item.storage_path ? (
                        <SignedImage
                          bucket={item.storage_bucket || 'client-documents'}
                          path={item.storage_path}
                          fallbackUrl="/placeholder.svg"
                          className="w-full h-full object-cover"
                          alt={item.file_name || 'Survey image'}
                        />
                      ) : (
                        <img
                          src={item.file_url}
                          alt={item.file_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-slate-100 rounded-lg border flex items-center justify-center">
                      <Video className="h-8 w-8 text-slate-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        if (item.storage_path) {
                          // For secure files, we would need to get signed URL
                          window.open(item.file_url, '_blank');
                        } else {
                          window.open(item.file_url, '_blank');
                        }
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  {item.is_main && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-primary text-white text-xs">Main</Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}