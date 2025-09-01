
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface PartnerQuoteKPIsProps {
  partnerId: string;
  jobs: any[];
}

interface KPIData {
  needsQuotation: number;
  waitingApproval: number;
  approvedLast7Days: number;
  rejectedLast7Days: number;
  avgApprovalTimeHours: number;
}

export function PartnerQuoteKPIs({ partnerId, jobs }: PartnerQuoteKPIsProps) {
  const [kpiData, setKpiData] = useState<KPIData>({
    needsQuotation: 0,
    waitingApproval: 0,
    approvedLast7Days: 0,
    rejectedLast7Days: 0,
    avgApprovalTimeHours: 0
  });

  useEffect(() => {
    calculateKPIs();
  }, [jobs, partnerId]);

  const calculateKPIs = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      // Get quote statistics
      const { data: quotesData } = await supabase
        .from('partner_quotes')
        .select('status, submitted_at, decision_at')
        .eq('partner_id', partnerId)
        .gte('submitted_at', sevenDaysAgo.toISOString());

      const approvedLast7Days = quotesData?.filter(q => 
        q.status === 'approved' && new Date(q.decision_at) >= sevenDaysAgo
      ).length || 0;

      const rejectedLast7Days = quotesData?.filter(q => 
        q.status === 'rejected' && new Date(q.decision_at) >= sevenDaysAgo
      ).length || 0;

      // Calculate average approval time
      const approvedQuotes = quotesData?.filter(q => 
        q.status === 'approved' && q.decision_at
      ) || [];
      
      let avgApprovalTimeHours = 0;
      if (approvedQuotes.length > 0) {
        const totalHours = approvedQuotes.reduce((sum, quote) => {
          const submitted = new Date(quote.submitted_at);
          const decided = new Date(quote.decision_at);
          const hours = (decided.getTime() - submitted.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgApprovalTimeHours = Math.round(totalHours / approvedQuotes.length);
      }

      // Helper to check if job should be in review bucket (scheduled but awaiting approval)
      const isReviewJob = (job: any) => {
        const approvalStatuses = ['WAITING_FOR_APPROVAL', 'WAITING_FOR_OHME_APPROVAL'];
        const scheduledStatuses = ['scheduled', 'in_progress', 'install_completed_pending_qa', 'completed'];
        return approvalStatuses.includes(job.partner_status) && scheduledStatuses.includes(job.status_enhanced);
      };

      // Apply the same filtering logic as the tabs
      const getBucketJobs = (...statuses: string[]) => {
        return jobs.filter(job => {
          // Check for quote overrides first
          if (job.quote_override) {
            if (job.quote_override.override_type === 'quoted_pending_approval') {
              return statuses.includes('WAITING_FOR_APPROVAL');
            }
            if (job.quote_override.override_type === 'standard_quote_marked') {
              return statuses.includes('NEEDS_SCHEDULING');
            }
          }

          // For waiting approval, exclude review jobs
          if (statuses.includes('WAITING_FOR_APPROVAL') || statuses.includes('WAITING_FOR_OHME_APPROVAL')) {
            if (isReviewJob(job)) return false; // Exclude review jobs from waiting approval
          }

          // Check partner status
          if (statuses.includes(job.partner_status)) {
            return true;
          }

          return false;
        });
      };

      setKpiData({
        needsQuotation: getBucketJobs('NEW_JOB', 'AWAITING_QUOTATION').length,
        waitingApproval: getBucketJobs('WAITING_FOR_APPROVAL', 'WAITING_FOR_OHME_APPROVAL').length,
        approvedLast7Days,
        rejectedLast7Days,
        avgApprovalTimeHours
      });
    } catch (error) {
      console.error('Error calculating KPIs:', error);
    }
  };

  const kpiCards = [
    {
      title: 'Needs Quotation',
      value: kpiData.needsQuotation,
      icon: AlertTriangle,
      color: 'text-orange-600'
    },
    {
      title: 'Waiting Approval', 
      value: kpiData.waitingApproval,
      icon: Clock,
      color: 'text-blue-600'
    },
    {
      title: 'Approved (7d)',
      value: kpiData.approvedLast7Days,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      title: 'Rejected (7d)',
      value: kpiData.rejectedLast7Days,
      icon: XCircle,
      color: 'text-red-600'
    },
    {
      title: 'Avg Approval Time',
      value: `${kpiData.avgApprovalTimeHours}h`,
      icon: TrendingUp,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {kpiCards.map((kpi, index) => {
        const IconComponent = kpi.icon;
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <IconComponent className={`h-5 w-5 ${kpi.color}`} />
                <div>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <div className="text-xs text-muted-foreground">{kpi.title}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
