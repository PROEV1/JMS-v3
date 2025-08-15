import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, Target, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Lead } from '@/hooks/useLeads';

interface LeadStatusKPIsProps {
  leads: Lead[];
  onStatusFilter: (status: string) => void;
}

export const LeadStatusKPIs = ({ leads, onStatusFilter }: LeadStatusKPIsProps) => {
  // Calculate counts for each status
  const statusCounts = leads.reduce((acc, lead) => {
    const status = lead.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Map unknown to new for display
  const newCount = (statusCounts.new || 0) + (statusCounts.unknown || 0);
  const contactedCount = statusCounts.contacted || 0;
  const qualifiedCount = statusCounts.qualified || 0;
  const convertedCount = statusCounts.converted || 0;
  const unqualifiedCount = statusCounts.unqualified || 0;
  const closedCount = statusCounts.closed || 0;

  const totalLeads = leads.length;

  const kpiItems = [
    {
      label: 'Total Leads',
      count: totalLeads,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      badgeVariant: 'secondary' as const,
      filterValue: 'all'
    },
    {
      label: 'New',
      count: newCount,
      icon: Clock,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      badgeVariant: 'default' as const,
      filterValue: 'new'
    },
    {
      label: 'Contacted',
      count: contactedCount,
      icon: UserCheck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      badgeVariant: 'secondary' as const,
      filterValue: 'contacted'
    },
    {
      label: 'Qualified',
      count: qualifiedCount,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      badgeVariant: 'outline' as const,
      filterValue: 'qualified'
    },
    {
      label: 'Converted',
      count: convertedCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      badgeVariant: 'default' as const,
      badgeColor: 'bg-green-600 text-white hover:bg-green-700',
      filterValue: 'converted'
    },
    {
      label: 'Unqualified',
      count: unqualifiedCount,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      badgeVariant: 'destructive' as const,
      filterValue: 'unqualified'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {kpiItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card 
            key={item.label} 
            className="hover:shadow-md transition-all cursor-pointer hover:scale-105"
            onClick={() => onStatusFilter(item.filterValue)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">
                      {item.count}
                    </p>
                    {item.count > 0 && (
                      <Badge 
                        variant={item.badgeVariant}
                        className={item.badgeColor}
                      >
                        {item.count}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={`p-2 rounded-full ${item.bgColor}`}>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
              </div>
              {totalLeads > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">
                    {((item.count / totalLeads) * 100).toFixed(1)}% of total
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className={`h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`}
                      style={{ width: `${(item.count / totalLeads) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};