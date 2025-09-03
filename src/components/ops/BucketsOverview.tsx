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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Surveys */}
            <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/orders?tab=surveys')}>
              <h3 className="font-semibold mb-4">Surveys</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Awaiting Submission</span>
                  <Badge variant={buckets.surveys.awaitingSubmission > 10 ? "destructive" : "outline"}>
                    {buckets.surveys.awaitingSubmission}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Awaiting Review</span>
                  <Badge variant={buckets.surveys.awaitingReview > 15 ? "destructive" : "outline"}>
                    {buckets.surveys.awaitingReview}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Rework Requested</span>
                  <Badge variant={buckets.surveys.reworkRequested > 0 ? "secondary" : "outline"}>
                    {buckets.surveys.reworkRequested}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Approved</span>
                  <Badge variant="outline">{buckets.surveys.approved}</Badge>
                </div>
              </div>
            </Card>

            {/* Quality Assurance */}
            <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/orders?status=install_completed_pending_qa')}>
              <h3 className="font-semibold mb-4">Quality Assurance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Pending</span>
                  <Badge variant={buckets.qa.pending > 5 ? "destructive" : "outline"}>
                    {buckets.qa.pending}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">In Review</span>
                  <Badge variant="outline">{buckets.qa.inReview}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Passed</span>
                  <Badge variant="outline">{buckets.qa.passed}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Failed</span>
                  <Badge variant={buckets.qa.failed > 0 ? "destructive" : "outline"}>
                    {buckets.qa.failed}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Escalated</span>
                  <Badge variant={buckets.qa.escalated > 0 ? "destructive" : "outline"}>
                    {buckets.qa.escalated}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Payments */}
            <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/orders?status=awaiting_payment')}>
              <h3 className="font-semibold mb-4">Payments</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Deposit Due</span>
                  <Badge variant={buckets.payments.depositDue > 0 ? "destructive" : "outline"}>
                    {buckets.payments.depositDue}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Balance Due</span>
                  <Badge variant={buckets.payments.balanceDue > 0 ? "secondary" : "outline"}>
                    {buckets.payments.balanceDue}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Paid</span>
                  <Badge variant="outline">{buckets.payments.paid}</Badge>
                </div>
              </div>
            </Card>
          </div>
    </div>
  );
}
