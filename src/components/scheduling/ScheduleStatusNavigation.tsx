import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Calendar, CheckCircle, XCircle, AlertTriangle, Package, Ban, FileCheck, Trophy, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScheduleStatusCounts } from '@/hooks/useScheduleStatusCounts';

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
    icon: Ban,
    colorClass: 'bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200 hover:border-pink-300',
    route: '/admin/schedule/status/date-rejected',
    statusKey: 'date-rejected'
  },
  {
    id: 'offer_expired',
    title: 'Expired Offers',
    icon: Clock,
    colorClass: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300',
    route: '/admin/schedule/status/offer-expired',
    statusKey: 'offer-expired'
  },
  {
    id: 'scheduled',
    title: 'Scheduled',
    icon: Calendar,
    colorClass: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300',
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
    colorClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:border-emerald-300',
    route: '/admin/schedule/status/completed',
    statusKey: 'completed'
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    icon: XCircle,
    colorClass: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300',
    route: '/admin/schedule/status/cancelled',
    statusKey: 'cancelled'
  },
  {
    id: 'on_hold',
    title: 'On Hold',
    icon: AlertTriangle,
    colorClass: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300',
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
  const { counts, loading } = useScheduleStatusCounts();

  // Map the counts from the hook to the status keys used in this component
  const statusCounts = {
    'needs-scheduling': counts.needsScheduling,
    'date-offered': counts.dateOffered,
    'ready-to-book': counts.readyToBook,
    'scheduled': counts.scheduled,
    'completion-pending': counts.completionPending,
    'completed': counts.completed,
    'cancelled': counts.cancelled,
    'on-hold': counts.onHold
  };

  // Show loading placeholders
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-background/95 to-background border border-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-3">
          {statusTiles.map((tile) => (
            <Card key={tile.id} className="animate-pulse bg-muted/50 min-w-[140px] min-h-[88px]">
              <CardContent className="p-3">
                <div className="h-10 bg-muted rounded mb-2"></div>
                <div className="h-6 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-background/95 to-background border border-border rounded-lg p-4 mb-6">
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-3">
        {statusTiles.map((tile) => (
          <StatusNavTile
            key={tile.id}
            tile={tile}
            count={statusCounts[tile.statusKey as keyof typeof statusCounts] || 0}
            isActive={currentStatus === tile.statusKey}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}