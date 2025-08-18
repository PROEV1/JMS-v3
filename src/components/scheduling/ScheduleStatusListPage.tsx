
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Search, 
  Filter,
  Send,
  Wrench,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Order } from '@/utils/schedulingUtils';
import { SendOfferModal } from './SendOfferModal';
import { SmartAssignmentModal } from './SmartAssignmentModal';
import { AutoScheduleReviewModal } from './AutoScheduleReviewModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduleStatusListPageProps {
  orders: Order[];
  engineers: any[];
  onUpdate?: () => void;
  title: string;
  showAutoSchedule?: boolean;
}

export function ScheduleStatusListPage({ 
  orders, 
  engineers, 
  onUpdate, 
  title,
  showAutoSchedule = false 
}: ScheduleStatusListPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showSendOffer, setShowSendOffer] = useState(false);
  const [showSmartAssign, setShowSmartAssign] = useState(false);
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);

  const filteredOrders = orders.filter(order => 
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.client?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_install_booking':
        return 'destructive';
      case 'scheduled':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'completed':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleSendOffer = (order: Order) => {
    setSelectedOrder(order);
    setShowSendOffer(true);
  };

  const handleSmartAssign = (order: Order) => {
    setSelectedOrder(order);
    setShowSmartAssign(true);
  };

  const handleAssignment = async (engineerId: string, date: string, action: 'send_offer' | 'confirm_book') => {
    if (!selectedOrder) return;

    try {
      if (action === 'send_offer') {
        // Send offer to client
        const { data, error } = await supabase.functions.invoke('send-offer', {
          body: {
            order_id: selectedOrder.id,
            engineer_id: engineerId,
            offered_date: date,
            time_window: selectedOrder.time_window,
            delivery_channel: 'email'
          }
        });

        if (error || data?.error) {
          throw new Error(data?.error || 'Failed to send offer');
        }

        // Log activity
        await supabase.rpc('log_order_activity', {
          p_order_id: selectedOrder.id,
          p_activity_type: 'offer_sent',
          p_description: `Installation offer sent via Smart Assignment`,
          p_details: {
            engineer_id: engineerId,
            offered_date: date,
            time_window: selectedOrder.time_window,
            method: 'smart_assignment'
          }
        });

      } else if (action === 'confirm_book') {
        // Direct booking - update order
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            engineer_id: engineerId,
            scheduled_install_date: date,
            status_enhanced: 'scheduled'
          })
          .eq('id', selectedOrder.id);

        if (updateError) {
          throw new Error('Failed to book installation');
        }

        // Log activity
        await supabase.rpc('log_order_activity', {
          p_order_id: selectedOrder.id,
          p_activity_type: 'installation_booked',
          p_description: `Installation directly booked via Smart Assignment`,
          p_details: {
            engineer_id: engineerId,
            scheduled_date: date,
            time_window: selectedOrder.time_window,
            method: 'smart_assignment_direct'
          }
        });
      }

      // Refresh the parent component
      if (onUpdate) {
        onUpdate();
      }

    } catch (error: any) {
      console.error('Assignment error:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">
            {filteredOrders.length} job{filteredOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {showAutoSchedule && (
          <Button 
            onClick={() => setShowAutoSchedule(true)}
            className="flex items-center gap-2"
          >
            <CalendarIcon className="w-4 h-4" />
            Auto-Schedule & Review
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by order number, client name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No jobs found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'No jobs match the current status.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{order.order_number}</h3>
                        <p className="text-muted-foreground">{order.client?.full_name}</p>
                      </div>
                      <Badge variant={getStatusColor(order.status_enhanced)}>
                        {order.status_enhanced.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">
                          {order.job_address || order.client?.address || 'No address'}
                        </span>
                      </div>

                      {order.scheduled_install_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {new Date(order.scheduled_install_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {order.engineer_id && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {engineers.find(e => e.id === order.engineer_id)?.name || 'Unknown Engineer'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{order.estimated_duration_hours || 2}h duration</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {order.status_enhanced === 'awaiting_install_booking' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSmartAssign(order)}
                          className="flex items-center gap-2"
                        >
                          <Wrench className="w-4 h-4" />
                          Smart Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendOffer(order)}
                          className="flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Send Offer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      {selectedOrder && (
        <>
          <SendOfferModal
            isOpen={showSendOffer}
            onClose={() => {
              setShowSendOffer(false);
              setSelectedOrder(null);
            }}
            order={selectedOrder}
            engineers={engineers}
            onOfferSent={onUpdate}
          />

          <SmartAssignmentModal
            isOpen={showSmartAssign}
            onClose={() => {
              setShowSmartAssign(false);
              setSelectedOrder(null);
            }}
            order={selectedOrder}
            engineers={engineers}
            onAssign={handleAssignment}
          />
        </>
      )}

      <AutoScheduleReviewModal
        isOpen={showAutoSchedule}
        onClose={() => setShowAutoSchedule(false)}
        orders={filteredOrders}
        engineers={engineers}
        onOffersSubmitted={onUpdate}
      />
    </div>
  );
}
