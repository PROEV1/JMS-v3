import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react';

interface PartnerUser {
  id: string;
  partner_id: string;
  role: string;
}

interface PartnerMetricsProps {
  partnerUser: PartnerUser;
}

export function PartnerMetrics({ partnerUser }: PartnerMetricsProps) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['partner-metrics', partnerUser.partner_id],
    queryFn: async () => {
      let baseQuery = supabase
        .from('orders')
        .select('status_enhanced, scheduled_install_date, created_at')
        .eq('is_partner_job', true);

      // Apply partner-specific filtering
      if (partnerUser.role === 'partner_dealer') {
        baseQuery = baseQuery.eq('partner_id', partnerUser.partner_id);
      } else if (partnerUser.role === 'partner_manufacturer') {
        // Manufacturers can see their own jobs and jobs from dealers under them
        const { data: childPartners } = await supabase
          .from('partners')
          .select('id')
          .eq('parent_partner_id', partnerUser.partner_id);
        
        const partnerIds = [partnerUser.partner_id, ...(childPartners?.map(p => p.id) || [])];
        baseQuery = baseQuery.in('partner_id', partnerIds);
      }

      const { data: orders, error } = await baseQuery;
      if (error) throw error;

      // Calculate metrics
      const total = orders?.length || 0;
      const completed = orders?.filter(o => o.status_enhanced === 'completed').length || 0;
      const scheduled = orders?.filter(o => o.status_enhanced === 'scheduled').length || 0;
      const pending = orders?.filter(o => 
        ['awaiting_payment', 'awaiting_agreement', 'awaiting_install_booking'].includes(o.status_enhanced)
      ).length || 0;

      return {
        total,
        completed,
        scheduled,
        pending,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    }
  });

  if (isLoading) {
    return (
      <>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </>
    );
  }

  const metricCards = [
    {
      title: 'Total Jobs',
      value: metrics?.total || 0,
      icon: Calendar,
      description: 'All jobs submitted'
    },
    {
      title: 'Completed',
      value: metrics?.completed || 0,
      icon: CheckCircle,
      description: `${metrics?.completionRate || 0}% completion rate`,
      className: 'text-green-600'
    },
    {
      title: 'Scheduled',
      value: metrics?.scheduled || 0,
      icon: Clock,
      description: 'Jobs with confirmed dates',
      className: 'text-blue-600'
    },
    {
      title: 'Pending',
      value: metrics?.pending || 0,
      icon: AlertCircle,
      description: 'Awaiting action',
      className: 'text-amber-600'
    }
  ];

  return (
    <>
      {metricCards.map((metric, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {metric.title}
            </CardTitle>
            <metric.icon className={`h-4 w-4 ${metric.className || 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}