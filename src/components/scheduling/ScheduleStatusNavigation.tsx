import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Calendar, CheckCircle, XCircle, AlertTriangle, Package, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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
  {
    id: 'scheduled',
    title: 'Scheduled',
    icon: Calendar,
    colorClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:border-emerald-300',
    route: '/admin/schedule/status/scheduled',
    statusKey: 'scheduled'
  },
  {
    id: 'on_hold',
    title: 'On Hold',
    icon: Package,
    colorClass: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300',
    route: '/admin/schedule/status/on-hold',
    statusKey: 'on-hold'
  }
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
      onClick={() => navigate(tile.route)}
    >
      <CardContent className="p-3 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-white/60 rounded-md">
            <IconComponent className="h-3.5 w-3.5 text-foreground" />
          </div>
          <h3 className="font-medium text-xs text-foreground truncate">{tile.title}</h3>
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
        // Fetch offer-based counts
        const [pendingResult, rejectedResult, expiredResult] = await Promise.all([
          supabase
            .from('job_offers')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString()),
          supabase
            .from('job_offers')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected'),
          supabase
            .from('job_offers')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'expired')
        ]);

        // Fetch order-based counts
        const [scheduledResult, onHoldResult] = await Promise.all([
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'scheduled'),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'on_hold_parts_docs')
        ]);

        // For needs-scheduling, get count of orders with no engineer and no active offers
        let needsSchedulingCount = 0;
        
        // First get orders that need scheduling (no engineer assigned)
        const { count: unassignedOrdersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'awaiting_install_booking')
          .is('engineer_id', null);
        
        needsSchedulingCount = unassignedOrdersCount || 0;
        
        // Subtract any unassigned orders that have active offers
        if (needsSchedulingCount > 0) {
          const { data: activeOffers } = await supabase
            .from('job_offers')
            .select('order_id')
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());
          
          if (activeOffers?.length) {
            const { count: unassignedOrdersWithOffersCount } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('status_enhanced', 'awaiting_install_booking')
              .is('engineer_id', null)
              .in('id', activeOffers.map(offer => offer.order_id));
            
            needsSchedulingCount = Math.max(0, needsSchedulingCount - (unassignedOrdersWithOffersCount || 0));
          }
        }

        // For ready-to-book, count orders with status awaiting_install_booking that have accepted offers
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
            .in('id', acceptedOffers.map(offer => offer.order_id));
          
          readyToBookCount = ordersWithAcceptedOffersCount || 0;
        }

        setCounts({
          'needs-scheduling': needsSchedulingCount,
          'date-offered': pendingResult.count || 0,
          'ready-to-book': readyToBookCount,
          'date-rejected': rejectedResult.count || 0,
          'offer-expired': expiredResult.count || 0,
          'scheduled': scheduledResult.count || 0,
          'on-hold': onHoldResult.count || 0
        });
      } catch (error) {
        console.error('Error fetching status counts:', error);
        setCounts({});
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
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
      <div className="flex items-center gap-4 overflow-x-auto overflow-y-visible pt-1 pb-2">
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