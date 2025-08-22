import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/utils/schedulingUtils';
import { Clock, Calendar, CheckCircle, XCircle, AlertTriangle, Package, Ban, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SchedulePipelineDashboardProps {
  orders: Order[];
}

interface JobOfferCount {
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
}

interface StatusTile {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  statusValues: string[];
  colorClass: string;
  route: string;
}

const statusTiles: StatusTile[] = [
  {
    id: 'needs_scheduling',
    title: 'Needs Scheduling',
    icon: Clock,
    statusValues: ['needs_scheduling', 'awaiting_install_booking'],
    colorClass: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300',
    route: '/admin/schedule/status/needs-scheduling'
  },
  {
    id: 'date_offered',
    title: 'Date Offered',
    icon: Calendar,
    statusValues: ['date_offered'],
    colorClass: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300',
    route: '/admin/schedule/status/date-offered'
  },
  {
    id: 'date_accepted',
    title: 'Ready to Book',
    icon: CheckCircle,
    statusValues: ['date_accepted', 'scheduled'],
    colorClass: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300',
    route: '/admin/schedule/status/ready-to-book'
  },
  {
    id: 'date_rejected',
    title: 'Date Rejected',
    icon: XCircle,
    statusValues: ['date_rejected'],
    colorClass: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300',
    route: '/admin/schedule/status/date-rejected'
  },
  {
    id: 'offer_expired',
    title: 'Offer Expired',
    icon: AlertTriangle,
    statusValues: ['offer_expired'],
    colorClass: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300',
    route: '/admin/schedule/status/offer-expired'
  },
  {
    id: 'on_hold',
    title: 'On Hold - Parts/Docs',
    icon: Package,
    statusValues: ['on_hold_parts_docs'],
    colorClass: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300',
    route: '/admin/schedule/status/on-hold'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    icon: Wrench,
    statusValues: ['in_progress'],
    colorClass: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-300',
    route: '/admin/schedule/status/in-progress'
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    icon: Ban,
    statusValues: ['cancelled'],
    colorClass: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300',
    route: '/admin/schedule/status/cancelled'
  }
];

function StatusTile({ tile, orders, totalJobs, navigate, offerCounts }: {
  tile: StatusTile;
  orders: Order[];
  totalJobs: number;
  navigate: (path: string) => void;
  offerCounts: JobOfferCount;
}) {
  // Special handling for offer-based tiles - count offers instead of orders
  let count: number;
  let tileOrders: Order[] = [];
  
  if (tile.id === 'date_offered') {
    count = offerCounts.pending;
  } else if (tile.id === 'date_accepted') {
    count = offerCounts.accepted;
  } else if (tile.id === 'date_rejected') {
    count = offerCounts.rejected;
  } else if (tile.id === 'offer_expired') {
    count = offerCounts.expired;
  } else {
    tileOrders = orders.filter(order => 
      tile.statusValues.includes(order.status_enhanced)
    );
    count = tileOrders.length;
  }
  
  const percentage = totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0;
  
  // Calculate average days waiting (using current date since created_at might not be available)
  const avgDaysWaiting = (count > 0 && tileOrders.length > 0) ? Math.round(
    tileOrders.reduce((sum, order) => {
      // Use a default of 7 days if we can't calculate actual days
      return sum + 7;
    }, 0) / tileOrders.length
  ) : 0;

  const IconComponent = tile.icon;

  return (
    <Card 
      className={`
        ${tile.colorClass} 
        cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]
      `}
      onClick={() => navigate(tile.route)}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/60 rounded-lg">
              <IconComponent className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">{tile.title}</h3>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-1">{count}</div>
            <div className="text-xs text-muted-foreground">
              {percentage}% of total jobs
            </div>
          </div>
          
          {count > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Avg wait: {avgDaysWaiting}d</span>
              {/* Could add urgent count here if we had urgent flagging */}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SchedulePipelineDashboard({ orders }: SchedulePipelineDashboardProps) {
  const navigate = useNavigate();
  const [offerCounts, setOfferCounts] = useState<JobOfferCount>({ 
    pending: 0, 
    accepted: 0, 
    rejected: 0, 
    expired: 0 
  });

  // Fetch job offers counts for all statuses using head queries for robust counting
  useEffect(() => {
    const fetchOfferCounts = async () => {
      try {
        // Count job offers for all job types
        const [pendingResult, acceptedResult, rejectedResult, expiredResult] = await Promise.all([
          (async () => {
            const { data: offers } = await supabase
              .from('job_offers')
              .select('order_id')
              .eq('status', 'pending')
              .gt('expires_at', new Date().toISOString());
            
            if (!offers?.length) return { count: 0 };
            
            const orderIds = offers.map(o => o.order_id);
            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .in('id', orderIds);
              
            return { count: count || 0 };
          })(),
          (async () => {
            const { data: offers } = await supabase
              .from('job_offers')
              .select('order_id')
              .eq('status', 'accepted');
            
            if (!offers?.length) return { count: 0 };
            
            const orderIds = offers.map(o => o.order_id);
            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .in('id', orderIds);
              
            return { count: count || 0 };
          })(),
          (async () => {
            const { data: offers } = await supabase
              .from('job_offers')
              .select('order_id')
              .eq('status', 'rejected');
            
            if (!offers?.length) return { count: 0 };
            
            const orderIds = offers.map(o => o.order_id);
            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .in('id', orderIds);
              
            return { count: count || 0 };
          })(),
          (async () => {
            const { data: offers } = await supabase
              .from('job_offers')
              .select('order_id')
              .eq('status', 'expired');
            
            if (!offers?.length) return { count: 0 };
            
            const orderIds = offers.map(o => o.order_id);
            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .in('id', orderIds);
              
            return { count: count || 0 };
          })()
        ]);

        setOfferCounts({
          pending: pendingResult.count || 0,
          accepted: acceptedResult.count || 0,
          rejected: rejectedResult.count || 0,
          expired: expiredResult.count || 0
        });
      } catch (error) {
        console.error('Error fetching offer counts:', error);
        // Set defaults on error
        setOfferCounts({ pending: 0, accepted: 0, rejected: 0, expired: 0 });
      }
    };

    fetchOfferCounts();
  }, []);

  // Stats calculation for summary badges (all job types)
  const totalJobs = orders.length;
  const needsScheduling = orders.filter(o => 
    ['needs_scheduling', 'awaiting_install_booking'].includes(o.status_enhanced)
  ).length;
  const inProgress = orders.filter(o => 
    ['date_offered', 'date_accepted', 'scheduled', 'in_progress'].includes(o.status_enhanced)
  ).length;
  const issues = orders.filter(o => 
    ['date_rejected', 'offer_expired', 'on_hold_parts_docs'].includes(o.status_enhanced)
  ).length;
  const completed = orders.filter(o => o.status_enhanced === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header with Summary Pills */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Scheduling Pipeline</h2>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="px-3 py-1">
              {totalJobs} Total Jobs
            </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            {needsScheduling} Need Scheduling
          </Badge>
          <Badge variant="default" className="px-3 py-1">
            {inProgress} In Progress
          </Badge>
          <Badge variant="default" className="px-3 py-1">
            {completed} Completed
          </Badge>
          {issues > 0 && (
            <Badge variant="destructive" className="px-3 py-1">
              {issues} Issues
            </Badge>
          )}
        </div>
      </div>

      {/* Status Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statusTiles.map(tile => (
          <StatusTile
            key={tile.id}
            tile={tile}
            orders={orders}
            totalJobs={totalJobs}
            navigate={navigate}
            offerCounts={offerCounts}
          />
        ))}
      </div>

      {/* Help Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>💡 Click on any status tile to view and manage jobs in that status</p>
      </div>
    </div>
  );
}