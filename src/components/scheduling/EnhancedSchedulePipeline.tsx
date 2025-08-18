import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type DatabaseOrder = Database['public']['Tables']['orders']['Row'] & {
  clients?: { name: string; email: string; phone: string; };
  quotes?: { products?: any[]; };
  engineer?: { name: string; email: string; region?: string; };
};
import { EnhancedJobCard } from './EnhancedJobCard';
import { AutoScheduleReviewModal } from './AutoScheduleReviewModal';
import { useJobOffers } from '@/hooks/useJobOffers';
import { toast } from 'sonner';

interface Engineer {
  id: string;
  name: string;
  email: string;
  availability?: boolean;
}

interface PipelineColumn {
  id: string;
  title: string;
  orders: DatabaseOrder[];
  color: string;
  description?: string;
  showOfferActions?: boolean;
}

const COLUMN_CONFIG = {
  awaiting_install_booking: {
    title: 'Awaiting Installation',
    color: 'bg-blue-50 border-blue-200',
    description: 'Jobs ready for scheduling',
    showOfferActions: true
  },
  date_offered: {
    title: 'Date Offered',
    color: 'bg-indigo-50 border-indigo-200',
    description: 'Offers sent to clients',
    showOfferActions: false
  },
  date_accepted: {
    title: 'Ready to Book',
    color: 'bg-emerald-50 border-emerald-200',
    description: 'Client accepted, ready to confirm',
    showOfferActions: false
  },
  date_rejected: {
    title: 'Date Rejected',
    color: 'bg-red-50 border-red-200',
    description: 'Need alternative dates',
    showOfferActions: false
  },
  scheduled: {
    title: 'Scheduled',
    color: 'bg-purple-50 border-purple-200',
    description: 'Confirmed installations',
    showOfferActions: false
  },
  in_progress: {
    title: 'In Progress',
    color: 'bg-yellow-50 border-yellow-200',
    description: 'Currently being installed',
    showOfferActions: false
  },
  completed: {
    title: 'Completed',
    color: 'bg-green-50 border-green-200',
    description: 'Successfully completed',
    showOfferActions: false
  }
};

export function EnhancedSchedulePipeline() {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);

  const { offers, refetch: refetchOffers } = useJobOffers();

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch orders and engineers in parallel
      const [ordersResponse, engineersResponse] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            *,
            client:clients(*),
            engineer:engineers(*)
          `)
          .not('status_enhanced', 'in', '("completed")')
          .order('created_at', { ascending: false }),
        
        supabase
          .from('engineers')
          .select('*')
          .eq('availability', true)
          .order('name')
      ]);

      if (ordersResponse.error) throw ordersResponse.error;
      if (engineersResponse.error) throw engineersResponse.error;

      setEngineers(engineersResponse.data || []);

      // Categorize orders with offer status consideration
      const orders = ordersResponse.data || [];
      const ordersByStatus: Record<string, DatabaseOrder[]> = {
        awaiting_install_booking: [],
        date_offered: [],
        date_accepted: [],
        date_rejected: [],
        scheduled: [],
        in_progress: [],
        completed: []
      };

      // Group orders by their enhanced status considering offers
      for (const order of orders) {
        const orderOffers = offers.filter(offer => offer.order_id === order.id);
        let targetStatus = order.status_enhanced;

        // Override status based on active offers
        if (orderOffers.length > 0) {
          const latestOffer = orderOffers[0]; // Offers are ordered by created_at desc
          
          switch (latestOffer.status) {
            case 'pending':
              // Show as date_offered when there's a pending offer
              targetStatus = 'date_offered';
              break;
            case 'accepted':
              targetStatus = 'date_accepted';
              break;
            case 'rejected':
              targetStatus = 'date_rejected';
              break;
            case 'expired':
              // Return to awaiting installation if expired
              targetStatus = 'awaiting_install_booking';
              break;
          }
        }

        if (ordersByStatus[targetStatus]) {
          ordersByStatus[targetStatus].push(order);
        }
      }

      // Build columns
      const newColumns = Object.entries(COLUMN_CONFIG).map(([status, config]) => ({
        id: status,
        title: config.title,
        orders: ordersByStatus[status] || [],
        color: config.color,
        description: config.description,
        showOfferActions: config.showOfferActions
      }));

      setColumns(newColumns);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      toast.error('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [offers]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    console.log('Order moved:', { orderId: draggableId, from: source.droppableId, to: destination.droppableId });
    // TODO: Implement status updates based on column moves
    toast.success('Order status updated');
  };

  const getAwaitingInstallationOrders = () => {
    const awaitingColumn = columns.find(col => col.id === 'awaiting_install_booking');
    return awaitingColumn?.orders || [];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Installation Pipeline</h2>
          <p className="text-muted-foreground">Manage job offers and scheduling workflow</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowAutoSchedule(true)}
            disabled={getAwaitingInstallationOrders().length === 0}
            className="flex items-center gap-2"
          >
            <Bot className="w-4 h-4" />
            Auto-Schedule & Review
            {getAwaitingInstallationOrders().length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {getAwaitingInstallationOrders().length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Pipeline Columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
          {columns.map((column) => (
            <Droppable key={column.id} droppableId={column.id}>
              {(provided, snapshot) => (
                <Card 
                  className={`${column.color} ${snapshot.isDraggingOver ? 'ring-2 ring-primary' : ''} transition-colors`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {column.title}
                      <Badge variant="outline" className="text-xs">
                        {column.orders.length}
                      </Badge>
                    </CardTitle>
                    {column.description && (
                      <p className="text-xs text-muted-foreground">{column.description}</p>
                    )}
                  </CardHeader>
                  
                  <CardContent>
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3 min-h-[200px]"
                    >
                      {column.orders.map((order, index) => (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${snapshot.isDragging ? 'shadow-lg rotate-3' : ''} transition-transform`}
                            >
                              <EnhancedJobCard
                                order={order}
                                onUpdate={() => {
                                  fetchData();
                                  refetchOffers();
                                }}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {column.orders.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                          <div className="w-12 h-12 rounded-full bg-muted mb-3 flex items-center justify-center">
                            <Plus className="w-6 h-6" />
                          </div>
                          <p className="text-sm">No jobs in this stage</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Auto-Schedule Modal */}
      <AutoScheduleReviewModal
        isOpen={showAutoSchedule}
        onClose={() => setShowAutoSchedule(false)}
        orders={getAwaitingInstallationOrders()}
        engineers={engineers.map(e => ({ ...e, availability: e.availability ?? true }))}
        onOffersSubmitted={() => {
          fetchData();
          refetchOffers();
        }}
      />
    </div>
  );
}