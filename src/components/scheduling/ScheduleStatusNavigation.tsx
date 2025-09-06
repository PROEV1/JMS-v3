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
      onClick={() => navigate(tile.route)}
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
        // Fetch all data in parallel for efficient processing
        const [ordersResult, offersResult] = await Promise.all([
          supabase
            .from('orders')
            .select('id, status_enhanced, scheduling_suppressed, scheduled_install_date'),
          supabase
            .from('job_offers')
            .select('order_id, status, expires_at')
        ]);

        const orders = ordersResult.data || [];
        const offers = offersResult.data || [];
        const now = new Date().toISOString();

        // Group offers by order_id for efficient lookup
        const offersByOrder = new Map<string, typeof offers>();
        offers.forEach(offer => {
          if (!offersByOrder.has(offer.order_id)) {
            offersByOrder.set(offer.order_id, []);
          }
          offersByOrder.get(offer.order_id)!.push(offer);
        });

        // Get active offers (pending and not expired)
        const activeOfferOrderIds = new Set<string>();
        const acceptedOfferOrderIds = new Set<string>();
        const rejectedOfferOrderIds = new Set<string>();
        const expiredOfferOrderIds = new Set<string>();

        offers.forEach(offer => {
          if (offer.status === 'pending' && offer.expires_at > now) {
            activeOfferOrderIds.add(offer.order_id);
          } else if (offer.status === 'accepted') {
            acceptedOfferOrderIds.add(offer.order_id);
          } else if (offer.status === 'rejected') {
            rejectedOfferOrderIds.add(offer.order_id);
          } else if (offer.status === 'expired') {
            expiredOfferOrderIds.add(offer.order_id);
          }
        });

        const counts = {
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
        };

        // Process orders using original logic
        orders.forEach(order => {
          // Direct status mappings (unchanged from original)
          if (order.status_enhanced === 'scheduled' && !order.scheduling_suppressed) {
            counts['scheduled']++;
          } else if (order.status_enhanced === 'on_hold_parts_docs') {
            counts['on-hold']++;
          } else if (order.status_enhanced === 'install_completed_pending_qa') {
            counts['completion-pending']++;
          } else if (order.status_enhanced === 'completed') {
            counts['completed']++;
          } else if (order.status_enhanced === 'cancelled') {
            counts['cancelled']++;
          } else if (order.status_enhanced === 'date_offered' && !order.scheduling_suppressed) {
            counts['date-offered']++;
          } else if (order.status_enhanced === 'awaiting_install_booking' && !order.scheduling_suppressed) {
            // Needs Scheduling: No pending or accepted offers
            const hasActiveOffers = activeOfferOrderIds.has(order.id) || acceptedOfferOrderIds.has(order.id);
            
            if (!hasActiveOffers) {
              // Check if it has rejected offers but no active/accepted offers
              if (rejectedOfferOrderIds.has(order.id) && !activeOfferOrderIds.has(order.id) && !acceptedOfferOrderIds.has(order.id)) {
                counts['date-rejected']++;
              } else {
                counts['needs-scheduling']++;
              }
            }
          }
        });

        // Ready to Book: Orders with accepted offers that haven't been scheduled yet
        acceptedOfferOrderIds.forEach(orderId => {
          const order = orders.find(o => o.id === orderId);
          if (order && 
              order.status_enhanced === 'awaiting_install_booking' && 
              !order.scheduled_install_date && 
              !order.scheduling_suppressed) {
            counts['ready-to-book']++;
          }
        });

        // Offer Expired: Count unique expired offers
        counts['offer-expired'] = expiredOfferOrderIds.size;

        setCounts(counts);
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
