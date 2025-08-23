import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, FileText, Image, Video, Eye } from 'lucide-react';
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

  const { data: survey, isLoading } = useQuery({
    queryKey: ['survey', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_surveys')
        .select(`
          *,
          client_survey_media (*)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['survey', orderId] });
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
      queryClient.invalidateQueries({ queryKey: ['survey', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error requesting rework:', error);
      toast({ title: 'Error requesting rework', variant: 'destructive' });
    },
  });

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
      {/* Survey Status and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CardTitle>Survey Status</CardTitle>
              {getStatusBadge(survey.status)}
            </div>
            
            {survey.status === 'submitted' || survey.status === 'resubmitted' ? (
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
              </div>
            ) : null}
          </div>
        </CardHeader>
        
        {(survey.status === 'submitted' || survey.status === 'resubmitted') && (
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

          {/* Add other response sections... */}
        </CardContent>
      </Card>

      {/* Media Gallery */}
      {media.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map((item: any) => (
                <div key={item.id} className="relative group">
                  {item.media_type === 'image' ? (
                    <img
                      src={item.file_url}
                      alt={item.file_name}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-lg border flex items-center justify-center">
                      <Video className="h-8 w-8 text-slate-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => window.open(item.file_url, '_blank')}
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