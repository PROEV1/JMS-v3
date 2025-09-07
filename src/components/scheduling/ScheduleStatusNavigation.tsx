import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Calendar, CheckCircle, XCircle, AlertTriangle, Package, Ban, FileCheck, Trophy, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { buildSafeUuidInClause } from '@/utils/schedulingUtils';

interface ScheduleStatusNavigationProps {
  currentStatus?: string;
}

interface StatusTile {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  route: string;
  statusKey: string;
}

const statusTiles: StatusTile[] = [
  {
    id: 'needs_scheduling',
    title: 'Needs Scheduling',
    icon: Clock,
    colorClass: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300',
    route: '/admin/schedule/status/needs-scheduling',
    statusKey: 'needs-scheduling'
  },
  {
    id: 'date_offered',
    title: 'Date Offered',
    icon: Calendar,
    colorClass: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300',
    route: '/admin/schedule/status/date-offered',
    statusKey: 'date-offered'
  },
  {
    id: 'ready_to_book',
    title: 'Ready to Book',
    icon: CheckCircle,
    colorClass: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300',
    route: '/admin/schedule/status/ready-to-book',
    statusKey: 'ready-to-book'
  },
  {
    id: 'scheduled',
    title: 'Scheduled',
    icon: Calendar,
    colorClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:border-emerald-300',
    route: '/admin/schedule/status/scheduled',
    statusKey: 'scheduled'
  },
  {
    id: 'completion_pending',
    title: 'Completion Pending',
    icon: FileCheck,
    colorClass: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:border-amber-300',
    route: '/admin/schedule/status/completion-pending',
    statusKey: 'completion-pending'
  },
  {
    id: 'completed',
    title: 'Completed',
    icon: Trophy,
    colorClass: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300',
    route: '/admin/schedule/status/completed',
    statusKey: 'completed'
  },
  {
    id: 'on_hold',
    title: 'On Hold',
    icon: Package,
    colorClass: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300',
    route: '/admin/schedule/status/on-hold',
    statusKey: 'on-hold'
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    icon: Ban,
    colorClass: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300',
    route: '/admin/schedule/status/cancelled',
    statusKey: 'cancelled'
  },
  {
    id: 'date_rejected',
    title: 'Date Rejected',
    icon: XCircle,
    colorClass: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300',
    route: '/admin/schedule/status/date-rejected',
    statusKey: 'date-rejected'
  },
  {
    id: 'offer_expired',
    title: 'Offer Expired',
    icon: AlertTriangle,
    colorClass: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300',
    route: '/admin/schedule/status/offer-expired',
    statusKey: 'offer-expired'
  },
];

function StatusNavTile({ tile, count, isActive, navigate }: {
  tile: StatusTile;
  count: number;
  isActive: boolean;
  navigate: (path: string) => void;
}) {
  const IconComponent = tile.icon;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-shadow transition-colors duration-200 hover:shadow-md active:translate-y-px min-w-[140px] min-h-[88px]",
        tile.colorClass,
        isActive && "ring-inset ring-2 ring-primary"
      )}
      onClick={() => {
        console.log(`StatusNavTile: Navigating to ${tile.route} for ${tile.title}`);
        navigate(tile.route);
      }}
    >
      <CardContent className="p-3 flex flex-col justify-between">
        <div className="flex items-start gap-2 mb-2">
          <div className="p-1.5 bg-white/60 rounded-md flex-shrink-0">
            <IconComponent className="h-3.5 w-3.5 text-foreground" />
          </div>
          <h3 className="font-medium text-xs text-foreground leading-tight min-h-[2.5rem] flex items-center">{tile.title}</h3>
        </div>
        
        <div className="text-center">
          <div className="text-xl font-bold text-foreground tabular-nums min-w-[2ch]">{count}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScheduleStatusNavigation({ currentStatus }: ScheduleStatusNavigationProps) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Use the exact same logic as the original useScheduleStatusCounts hook
        
        // Date offered with fallback - use both status and active pending offers
        const [statusBasedDateOffered, offersBasedDateOffered] = await Promise.all([
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'date_offered')
            .eq('scheduling_suppressed', false),
          supabase
            .from('job_offers')
            .select('order_id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
        ]);

        const dateOfferedCount = Math.max(
          statusBasedDateOffered.count || 0,
          offersBasedDateOffered.count || 0
        );

        // Direct status mappings
        const [
          scheduledResult, 
          onHoldResult, 
          completionPendingResult,
          completedResult,
          cancelledResult
        ] = await Promise.all([
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'scheduled')
            .eq('scheduling_suppressed', false),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'on_hold_parts_docs'),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'install_completed_pending_qa'),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'completed'),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'cancelled')
        ]);

        // CRITICAL: Must exclude orders with active offers since trigger isn't working
        const { data: ordersWithActiveOffers } = await supabase
          .from('job_offers')
          .select('order_id')
          .or('status.eq.accepted,and(status.eq.pending,expires_at.gt.' + new Date().toISOString() + ')');
        
        let needsSchedulingQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'awaiting_install_booking')
          .eq('scheduling_suppressed', false);
        
        if (ordersWithActiveOffers?.length) {
          needsSchedulingQuery = needsSchedulingQuery.not('id', 'in', `(${ordersWithActiveOffers.map(o => o.order_id).join(',')})`);
        }
        
        const { count: needsSchedulingCount } = await needsSchedulingQuery;

        // For ready-to-book, use EXACT same logic as useScheduleStatusCounts
        let readyToBookCount = 0;
        const { data: acceptedOffers } = await supabase
          .from('job_offers')
          .select('order_id')
          .eq('status', 'accepted');
        
        if (acceptedOffers?.length) {
          const { count: ordersWithAcceptedOffersCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'awaiting_install_booking')
            .is('scheduled_install_date', null)
            .eq('scheduling_suppressed', false)
            .in('id', acceptedOffers.map(offer => offer.order_id));
          
          readyToBookCount = ordersWithAcceptedOffersCount || 0;
        }

        // For date-rejected, count unique orders with rejected offers but no active offers
        let dateRejectedCount = 0;
        const { data: rejectedOffers } = await supabase
          .from('job_offers')
          .select('order_id')
          .eq('status', 'rejected');

        if (rejectedOffers?.length) {
          const { data: activeOffers } = await supabase
            .from('job_offers')
            .select('order_id')
            .in('status', ['pending', 'accepted'])
            .gt('expires_at', new Date().toISOString());

          const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
          const uniqueRejectedOrderIds = [...new Set(rejectedOffers.map(offer => offer.order_id))]
            .filter(orderId => !ordersWithActiveOffers.has(orderId));
          dateRejectedCount = uniqueRejectedOrderIds.length;
        }

        // For offer expired
        const { count: expiredCount } = await supabase
          .from('job_offers')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'expired');

        setCounts({
          'needs-scheduling': needsSchedulingCount || 0,
          'date-offered': dateOfferedCount,
          'ready-to-book': readyToBookCount,
          'date-rejected': dateRejectedCount,
          'offer-expired': expiredCount || 0,
          'scheduled': scheduledResult.count || 0,
          'completion-pending': completionPendingResult.count || 0,
          'completed': completedResult.count || 0,
          'on-hold': onHoldResult.count || 0,
          'cancelled': cancelledResult.count || 0
        });
      } catch (error) {
        console.error('Error fetching status counts:', error);
        setCounts({
          'needs-scheduling': 0,
          'date-offered': 0,
          'ready-to-book': 0,
          'date-rejected': 0,
          'offer-expired': 0,
          'scheduled': 0,
          'completion-pending': 0,
          'completed': 0,
          'on-hold': 0,
          'cancelled': 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
    
    // Set up real-time subscriptions for orders and job_offers
    const ordersChannel = supabase
      .channel('status-nav-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers' }, fetchCounts)
      .subscribe();
    
    // Listen for scheduling refresh events
    const handleRefresh = () => fetchCounts();
    window.addEventListener('scheduling:refresh', handleRefresh);
    
    return () => {
      supabase.removeChannel(ordersChannel);
      window.removeEventListener('scheduling:refresh', handleRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4 overflow-visible pb-2">
        {statusTiles.map(tile => (
          <Card key={tile.id} className="min-w-[140px] min-h-[88px] animate-pulse">
            <CardContent className="p-3">
              <div className="h-12 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4 overflow-visible pt-1 pb-2">
        {statusTiles.map(tile => (
          <StatusNavTile
            key={tile.id}
            tile={tile}
            count={counts[tile.statusKey] || 0}
            isActive={currentStatus === tile.statusKey}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}