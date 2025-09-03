import React from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiCard } from '@/components/scheduling/KpiCard';
import { useOpsKpis } from '@/hooks/useOpsKpis';
import { 
  Quote, 
  FileText, 
  Calendar, 
  CalendarCheck, 
  AlertTriangle, 
  CreditCard, 
  CheckCircle, 
  Ban 
} from 'lucide-react';

export function OpsKpiRow() {
  const navigate = useNavigate();
  const { kpis, loading } = useOpsKpis();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const kpiTiles = [
    {
      title: 'Quotes Awaiting Action',
      value: kpis.quotesAwaitingAction,
      icon: Quote,
      variant: (kpis.quotesAwaitingAction > 5 ? 'warning' : 'neutral') as 'warning' | 'neutral',
      onClick: () => navigate('/admin/quotes?status=sent'),
    },
    {
      title: 'Surveys Pending Review',
      value: kpis.surveysAwaitingReview,
      icon: FileText,
      variant: (kpis.surveysAwaitingReview > 10 ? 'warning' : 'neutral') as 'warning' | 'neutral',
      onClick: () => navigate('/admin/orders?status=awaiting_survey_review'),
    },
    {
      title: 'Jobs Awaiting Schedule',
      value: kpis.jobsAwaitingScheduling,
      icon: Calendar,
      variant: (kpis.jobsAwaitingScheduling > 15 ? 'danger' : 'neutral') as 'danger' | 'neutral',
      onClick: () => navigate('/admin/schedule/status/needs-scheduling'),
    },
    {
      title: 'Scheduled This Week',
      value: kpis.jobsScheduledThisWeek,
      icon: CalendarCheck,
      variant: 'info' as const,
      onClick: () => navigate('/admin/schedule/status/scheduled'),
    },
    {
      title: 'Installs at Risk',
      value: kpis.installsAtRisk,
      icon: AlertTriangle,
      variant: (kpis.installsAtRisk > 0 ? 'danger' : 'success') as 'danger' | 'success',
      subtitle: 'Within 24h',
      onClick: () => navigate('/admin/schedule?filter=at-risk'),
    },
    {
      title: 'Payments Overdue',
      value: kpis.paymentsOverdue,
      icon: CreditCard,
      variant: (kpis.paymentsOverdue > 0 ? 'danger' : 'success') as 'danger' | 'success',
      onClick: () => navigate('/admin/orders?status=awaiting_payment'),
    },
    {
      title: 'QA Backlog',
      value: kpis.qaBacklog,
      icon: CheckCircle,
      variant: (kpis.qaBacklog > 5 ? 'warning' : 'neutral') as 'warning' | 'neutral',
      onClick: () => navigate('/admin/orders?status=install_completed_pending_qa'),
    },
    {
      title: 'Partner Blocked Jobs',
      value: kpis.partnerBlockedJobs,
      icon: Ban,
      variant: (kpis.partnerBlockedJobs > 0 ? 'warning' : 'success') as 'warning' | 'success',
      onClick: () => navigate('/admin/orders?status=on_hold_parts_docs'),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Key Performance Indicators</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {kpiTiles.map((tile, index) => (
          <KpiCard
            key={index}
            title={tile.title}
            value={tile.value}
            icon={tile.icon}
            variant={tile.variant}
            onClick={tile.onClick}
            subtitle={tile.subtitle}
          />
        ))}
      </div>
    </div>
  );
}