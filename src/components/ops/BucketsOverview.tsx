import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOpsBuckets } from '@/hooks/useOpsBuckets';
import { SchedulePipelineDashboard } from '@/components/scheduling/SchedulePipelineDashboard';
import { useScheduleStatusCounts } from '@/hooks/useScheduleStatusCounts';
import { Clock, FileText, CheckCircle, CreditCard } from 'lucide-react';

export function BucketsOverview() {
  const navigate = useNavigate();
  const { buckets, loading } = useOpsBuckets();
  const { counts: scheduleStatusCounts } = useScheduleStatusCounts();

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Status Buckets Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Mock orders data for SchedulePipelineDashboard - it will fetch its own data
  const mockOrders: any[] = [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Status Buckets Overview</h2>
      
      {/* Jobs Pipeline - Use existing SchedulePipelineDashboard */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Jobs Pipeline</h3>
        <SchedulePipelineDashboard orders={mockOrders} />
      </div>

      {/* Other Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Surveys Bucket */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" 
              onClick={() => navigate('/admin/orders?filter=survey-status')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Surveys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Awaiting Client</span>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {buckets.surveys.awaitingClient}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Awaiting Review</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {buckets.surveys.awaitingReview}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Rework Requested</span>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {buckets.surveys.reworkRequested}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Approved</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {buckets.surveys.approved}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QA Bucket */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/admin/orders?filter=qa-status')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Quality Assurance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pending Review</span>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {buckets.qa.pending}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">In Review</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {buckets.qa.inReview}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Escalated</span>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {buckets.qa.escalated}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments Bucket */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/admin/orders?filter=payment-status')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Deposit Due</span>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {buckets.payments.depositDue}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Balance Due</span>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {buckets.payments.balanceDue}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Paid</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {buckets.payments.paid}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
