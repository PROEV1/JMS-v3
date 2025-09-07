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

  // Create a simplified orders array that just has the counts we need
  // This avoids the 1000-row limit issue by using the count-based hook
  const mockOrdersForDashboard: any[] = [];

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Status Buckets Overview</h2>
      </div>
      
      {/* Jobs Pipeline - Show pipeline with actual counts */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Jobs Pipeline</h3>
        
        {/* Show pipeline summary using the count hook */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Scheduling Pipeline</h2>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="px-3 py-1">
              Total Jobs (Loading...)
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              {scheduleStatusCounts.needsScheduling} Need Scheduling
            </Badge>
            <Badge variant="default" className="px-3 py-1">
              {scheduleStatusCounts.scheduled + scheduleStatusCounts.dateOffered + scheduleStatusCounts.readyToBook} In Progress
            </Badge>
            <Badge variant="default" className="px-3 py-1">
              {scheduleStatusCounts.completed} Completed
            </Badge>
            <Badge variant="destructive" className="px-3 py-1">
              {scheduleStatusCounts.onHold} Issues
            </Badge>
          </div>
        </div>

        {/* Status Tiles Grid using actual counts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Needs Scheduling */}
          <Card 
            className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={() => navigate('/admin/schedule/status/needs-scheduling')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Needs Scheduling</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{scheduleStatusCounts.needsScheduling}</div>
                  <div className="text-xs text-muted-foreground">
                    Jobs awaiting schedule
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date Offered */}
          <Card 
            className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={() => navigate('/admin/schedule/status/date-offered')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Date Offered</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{scheduleStatusCounts.dateOffered}</div>
                  <div className="text-xs text-muted-foreground">
                    Pending response
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ready to Book */}
          <Card 
            className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={() => navigate('/admin/schedule/status/ready-to-book')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Ready to Book</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{scheduleStatusCounts.readyToBook}</div>
                  <div className="text-xs text-muted-foreground">
                    Ready for booking
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled */}
          <Card 
            className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={() => navigate('/admin/schedule/status/scheduled')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Scheduled</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{scheduleStatusCounts.scheduled}</div>
                  <div className="text-xs text-muted-foreground">
                    Booked for install
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* On Hold */}
          <Card 
            className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={() => navigate('/admin/schedule/status/on-hold')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">On Hold</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{scheduleStatusCounts.onHold}</div>
                  <div className="text-xs text-muted-foreground">
                    Parts/Docs needed
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card 
            className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:border-emerald-300 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={() => navigate('/admin/schedule/status/completed')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Completed</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">{scheduleStatusCounts.completed}</div>
                  <div className="text-xs text-muted-foreground">
                    Install complete
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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