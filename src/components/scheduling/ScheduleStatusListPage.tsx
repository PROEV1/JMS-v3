
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);

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
            onClick={() => setShowAutoScheduleModal(true)}
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

      {/* Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Engineer</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No jobs found</h3>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'No jobs match the current status.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {order.order_number}
                      <Badge variant={getStatusColor(order.status_enhanced)} className="text-xs">
                        {order.status_enhanced === 'awaiting_install_booking' ? 'Unassigned' : 
                         order.engineer_id ? engineers.find(e => e.id === order.engineer_id)?.name || 'Assigned' : 'Unassigned'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {order.client?.full_name || 'Unknown Client'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {order.postcode || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      £{order.total_amount ? Number(order.total_amount).toLocaleString() : '0'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.engineer_id ? (
                      engineers.find(e => e.id === order.engineer_id)?.name || 'Unknown Engineer'
                    ) : (
                      <Badge variant="destructive" className="text-xs">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {(order as any).created_at ? 
                        new Date((order as any).created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : 'Recent'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.status_enhanced === 'awaiting_install_booking' ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSmartAssign(order)}
                          className="text-xs"
                        >
                          <Wrench className="w-4 h-4 mr-1" />
                          Smart Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendOffer(order)}
                          className="text-xs"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Send Offer
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs">
                        View Details
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

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
        isOpen={showAutoScheduleModal}
        onClose={() => setShowAutoScheduleModal(false)}
        orders={filteredOrders}
        engineers={engineers}
        onOffersSubmitted={onUpdate}
      />
    </div>
  );
}
