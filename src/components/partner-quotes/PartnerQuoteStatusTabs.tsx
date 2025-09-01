
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, Calendar, XCircle, Eye } from 'lucide-react';

interface PartnerQuoteStatusTabsProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  statusCounts: Record<string, number>;
}

const statusConfigs = [
  {
    id: 'needs_quotation',
    label: 'Needs Quotation',
    icon: FileText,
    colorClass: 'text-orange-600 bg-orange-50 border-orange-200'
  },
  {
    id: 'waiting_approval',
    label: 'Waiting for Approval',
    icon: Clock,
    colorClass: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    id: 'review',
    label: 'Review',
    icon: Eye,
    colorClass: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  {
    id: 'needs_scheduling',
    label: 'Needs Scheduling',
    icon: Calendar,
    colorClass: 'text-green-600 bg-green-50 border-green-200'
  },
  {
    id: 'rejected_rework',
    label: 'Rejected/Rework',
    icon: XCircle,
    colorClass: 'text-red-600 bg-red-50 border-red-200'
  }
];

export function PartnerQuoteStatusTabs({ 
  activeStatus, 
  onStatusChange, 
  statusCounts 
}: PartnerQuoteStatusTabsProps) {
  return (
    <Tabs value={activeStatus} onValueChange={onStatusChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5 bg-muted p-1 h-auto">
        {statusConfigs.map((status) => {
          const IconComponent = status.icon;
          const count = statusCounts[status.id] || 0;
          
          return (
            <TabsTrigger
              key={status.id}
              value={status.id}
              className="flex flex-col items-center gap-2 p-3 data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                <span className="font-medium">{status.label}</span>
              </div>
              <Badge 
                variant="secondary" 
                className={`${status.colorClass} text-xs px-2 py-1 font-semibold`}
              >
                {count}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
