
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Package, Calendar, MapPin } from 'lucide-react';
import { useStockRequests } from '@/hooks/useStockRequests';
import { StockRequestStatus, StockRequestPriority } from '@/types/stock-request';
import { format } from 'date-fns';

interface StockRequestHistoryProps {
  engineerId: string;
}

const getStatusColor = (status: StockRequestStatus) => {
  switch (status) {
    case 'submitted': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'in_pick': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'in_transit': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority: StockRequestPriority) => {
  switch (priority) {
    case 'high': return 'destructive';
    case 'medium': return 'outline';
    case 'low': return 'secondary';
    default: return 'outline';
  }
};

const formatStatus = (status: StockRequestStatus) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const StockRequestHistory: React.FC<StockRequestHistoryProps> = ({ engineerId }) => {
  const { data: requests, isLoading } = useStockRequests(engineerId);
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading request history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests?.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stock requests yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id}>
          <Collapsible
            open={openItems.has(request.id)}
            onOpenChange={() => toggleItem(request.id)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {openItems.has(request.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div>
                      <CardTitle className="text-base">
                        Request #{request.id.slice(0, 8)}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                        <MapPin className="h-3 w-3 ml-2" />
                        {request.destination_location.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(request.priority)}>
                      {request.priority}
                    </Badge>
                    <Badge className={getStatusColor(request.status)}>
                      {formatStatus(request.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {request.lines.length} item{request.lines.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {request.needed_by && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Needed by:</span>
                      <span>{format(new Date(request.needed_by), 'MMM d, yyyy')}</span>
                    </div>
                  )}

                  {request.order && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Linked to order:</span>
                      <span>{request.order.order_number}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Items requested:</h4>
                    <div className="space-y-2">
                      {request.lines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <span className="font-medium">{line.item.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">({line.item.sku})</span>
                            {line.notes && (
                              <div className="text-sm text-muted-foreground mt-1">{line.notes}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{line.qty}</span>
                            <span className="text-sm text-muted-foreground ml-1">{line.item.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {request.notes && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Notes:</h4>
                      <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                        {request.notes}
                      </p>
                    </div>
                  )}

                  {request.photo_url && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Photo:</h4>
                      <img 
                        src={request.photo_url} 
                        alt="Request attachment"
                        className="max-w-sm rounded-lg border"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
};
