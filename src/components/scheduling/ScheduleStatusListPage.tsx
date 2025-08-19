import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Send, Wrench, User, Calendar as CalendarIcon, MapPin, RotateCcw, XCircle, Calendar, Check, X, Eye } from 'lucide-react';
import { Order, Engineer } from '@/utils/schedulingUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SendOfferModal } from './SendOfferModal';
import { SmartAssignmentModal } from './SmartAssignmentModal';
import { AutoScheduleReviewModal } from './AutoScheduleReviewModal';
import { OfferStatusBadge } from './OfferStatusBadge';
import { useJobOffers } from '@/hooks/useJobOffers';
import { getBestPostcode } from '@/utils/postcodeUtils';

interface ScheduleStatusListPageProps {
  orders: Order[];
  engineers: Engineer[];
  onUpdate?: () => void;
  title: string;
  showAutoSchedule?: boolean;
}

export function ScheduleStatusListPage({ orders, engineers, onUpdate, title, showAutoSchedule = false }: ScheduleStatusListPageProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showSendOffer, setShowSendOffer] = useState(false);
  const [showSmartAssign, setShowSmartAssign] = useState(false);
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  
  // Fetch all job offers for the displayed orders
  const { offers, refetch: refetchOffers, releaseOffer, resendOffer } = useJobOffers();

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

  // Helper function to get active offer for an order
  const getActiveOfferForOrder = (orderId: string) => {
    return offers.find(offer => 
      offer.order_id === orderId && 
      offer.status === 'pending' && 
      new Date(offer.expires_at) > new Date()
    );
  };

  // Helper function to get latest offer for an order (any status)
  const getLatestOfferForOrder = (orderId: string) => {
    const orderOffers = offers.filter(offer => offer.order_id === orderId);
    return orderOffers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  };

  const handleResendOffer = async (orderId: string) => {
    const latestOffer = getLatestOfferForOrder(orderId);
    if (!latestOffer) return;

    try {
      await resendOffer(latestOffer.id);
      toast.success('Offer resent successfully');
      refetchOffers();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to resend offer');
    }
  };

  const handleReleaseOffer = async (orderId: string) => {
    const activeOffer = getActiveOfferForOrder(orderId);
    if (!activeOffer) return;

    try {
      await releaseOffer(activeOffer.id);
      toast.success('Offer released successfully');
      refetchOffers();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to release offer');
    }
  };

  const handleAcceptOffer = async (orderId: string) => {
    const activeOffer = getActiveOfferForOrder(orderId);
    if (!activeOffer) return;

    try {
      // Update the job offer status to accepted (don't schedule yet)
      const { error: offerError } = await supabase
        .from('job_offers')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', activeOffer.id);

      if (offerError) throw offerError;

      // Log the activity
      await supabase.rpc('log_order_activity', {
        p_order_id: orderId,
        p_activity_type: 'offer_accepted',
        p_description: 'Installation offer accepted by admin - moved to ready-to-book',
        p_details: {
          offer_id: activeOffer.id,
          engineer_id: activeOffer.engineer_id,
          offered_date: activeOffer.offered_date,
          method: 'admin_manual'
        }
      });

      toast.success('Offer accepted - job moved to Ready to Book');
      refetchOffers();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to accept offer:', error);
      toast.error('Failed to accept offer');
    }
  };

  const handleRejectOffer = async (orderId: string) => {
    const activeOffer = getActiveOfferForOrder(orderId);
    if (!activeOffer) return;

    try {
      // Update the job offer status to rejected
      const { error: offerError } = await supabase
        .from('job_offers')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: 'Rejected by admin'
        })
        .eq('id', activeOffer.id);

      if (offerError) throw offerError;

      // Log the activity
      await supabase.rpc('log_order_activity', {
        p_order_id: orderId,
        p_activity_type: 'offer_rejected',
        p_description: 'Installation offer rejected by admin',
        p_details: {
          offer_id: activeOffer.id,
          engineer_id: activeOffer.engineer_id,
          offered_date: activeOffer.offered_date,
          rejection_reason: 'Rejected by admin',
          method: 'admin_manual'
        }
      });

      toast.success('Offer rejected');
      refetchOffers();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to reject offer:', error);
      toast.error('Failed to reject offer');
    }
  };

  const handleConfirmAndSchedule = async (orderId: string) => {
    try {
      // Get the accepted offer for this order
      const acceptedOffer = offers.find(offer => 
        offer.order_id === orderId && offer.status === 'accepted'
      );
      
      if (!acceptedOffer) {
        toast.error('No accepted offer found for this order');
        return;
      }

      // Update the order to scheduled status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          engineer_id: acceptedOffer.engineer_id,
          scheduled_install_date: acceptedOffer.offered_date,
          status_enhanced: 'scheduled'
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Log the activity
      await supabase.rpc('log_order_activity', {
        p_order_id: orderId,
        p_activity_type: 'installation_confirmed',
        p_description: 'Installation confirmed and scheduled by admin',
        p_details: {
          offer_id: acceptedOffer.id,
          engineer_id: acceptedOffer.engineer_id,
          scheduled_date: acceptedOffer.offered_date,
          method: 'admin_confirmation'
        }
      });

      // Send confirmation emails to client and engineer
      await supabase.functions.invoke('send-order-status-email', {
        body: {
          order_id: orderId,
          status: 'scheduled',
          recipient_type: 'both'
        }
      });

      toast.success('Installation confirmed and scheduled. Confirmation emails sent.');
      refetchOffers();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to confirm and schedule:', error);
      toast.error('Failed to confirm and schedule installation');
    }
  };

  const handleCancelAndRestart = async (orderId: string) => {
    try {
      // Find and reject the accepted offer
      const acceptedOffer = offers.find(offer => 
        offer.order_id === orderId && offer.status === 'accepted'
      );
      
      if (!acceptedOffer) {
        toast.error('No accepted offer found for this order');
        return;
      }

      // Update the job offer to rejected
      const { error: offerError } = await supabase
        .from('job_offers')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: 'Booking cancelled by admin'
        })
        .eq('id', acceptedOffer.id);

      if (offerError) throw offerError;

      // Clear any engineer assignment and revert to awaiting_install_booking
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          engineer_id: null,
          scheduled_install_date: null,
          status_enhanced: 'awaiting_install_booking'
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Log the activity
      await supabase.rpc('log_order_activity', {
        p_order_id: orderId,
        p_activity_type: 'booking_cancelled',
        p_description: 'Installation booking cancelled, returned to scheduling queue',
        p_details: {
          offer_id: acceptedOffer.id,
          engineer_id: acceptedOffer.engineer_id,
          offered_date: acceptedOffer.offered_date,
          reason: 'Booking cancelled by admin',
          method: 'admin_cancellation'
        }
      });

      toast.success('Booking cancelled. Job returned to scheduling queue.');
      refetchOffers();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to cancel and restart:', error);
      toast.error('Failed to cancel booking');
    }
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

        toast.success('Offer sent to client successfully');

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

        toast.success('Installation booked successfully');
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
              <TableHead>Offer Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
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
                      {order.job_type && (
                        <Badge variant="secondary" className="text-xs">
                          {order.job_type.charAt(0).toUpperCase() + order.job_type.slice(1).replace('_', ' ')}
                        </Badge>
                      )}
                      <Badge variant={getStatusColor(order.status_enhanced)} className="text-xs">
                        {order.status_enhanced === 'awaiting_install_booking' ? 
                          (order.engineer_id ? 
                            `Needs scheduling — ${engineers.find(e => e.id === order.engineer_id)?.name || 'Assigned'}` : 
                            'Needs scheduling — Unassigned'
                          ) : 
                          (order.engineer_id ? engineers.find(e => e.id === order.engineer_id)?.name || 'Assigned' : 'Unassigned')
                        }
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
                       {getBestPostcode(order) || 'N/A'}
                     </div>
                   </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      £{order.total_amount ? Number(order.total_amount).toLocaleString() : '0'}
                    </div>
                  </TableCell>
                   <TableCell>
                     {(() => {
                       // For Ready to Book page - show accepted offer engineer and date
                       if (title === 'Ready to Book') {
                         const acceptedOffer = offers.find(offer => 
                           offer.order_id === order.id && offer.status === 'accepted'
                         );
                         if (acceptedOffer && acceptedOffer.engineer) {
                           return (
                             <div className="flex flex-col">
                               <span className="font-medium">{acceptedOffer.engineer.name}</span>
                               <span className="text-xs text-muted-foreground">
                                 {new Date(acceptedOffer.offered_date).toLocaleDateString('en-GB', {
                                   day: '2-digit',
                                   month: '2-digit',
                                   year: 'numeric'
                                 })}
                               </span>
                             </div>
                           );
                         } else {
                           return <Badge variant="destructive" className="text-xs">No Engineer</Badge>;
                         }
                       }
                       
                       // For other pages - show active offer engineer or order engineer
                       const activeOffer = getActiveOfferForOrder(order.id);
                       if (activeOffer && activeOffer.engineer) {
                         return (
                           <div className="flex flex-col">
                             <span className="font-medium">{activeOffer.engineer.name}</span>
                             <span className="text-xs text-muted-foreground">
                               {new Date(activeOffer.offered_date).toLocaleDateString('en-GB', {
                                 day: '2-digit',
                                 month: '2-digit',
                                 year: 'numeric'
                               })}
                             </span>
                           </div>
                         );
                       } else if (order.engineer_id) {
                         return engineers.find(e => e.id === order.engineer_id)?.name || 'Unknown Engineer';
                       } else {
                         return <Badge variant="destructive" className="text-xs">Unassigned</Badge>;
                       }
                     })()}
                   </TableCell>
                  <TableCell>
                    {(() => {
                      const latestOffer = getLatestOfferForOrder(order.id);
                      return latestOffer ? (
                        <OfferStatusBadge offer={latestOffer} showTimeRemaining />
                      ) : (
                        <span className="text-xs text-muted-foreground">No offers</span>
                      );
                    })()}
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
                     {(() => {
                       const activeOffer = getActiveOfferForOrder(order.id);
                       const latestOffer = getLatestOfferForOrder(order.id);
                       
                       if (title === 'Ready to Book') {
                         // For Ready to Book page - show Confirm & Schedule and Cancel/Restart buttons
                         return (
                           <div className="flex gap-2">
                             <Button
                               size="sm"
                               variant="destructive"
                               onClick={() => handleConfirmAndSchedule(order.id)}
                               className="text-xs"
                             >
                               <Check className="w-4 h-4 mr-1" />
                               Confirm & Schedule
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => handleCancelAndRestart(order.id)}
                               className="text-xs"
                             >
                               <XCircle className="w-4 h-4 mr-1" />
                               Cancel / Restart Scheduling
                             </Button>
                           </div>
                         );
                       } else if (activeOffer && title === 'Date Offered') {
                         // For Date Offered page - show Accept/Reject buttons
                         return (
                           <div className="flex gap-2">
                             <Button
                               size="sm"
                               variant="default"
                               onClick={() => handleAcceptOffer(order.id)}
                               className="text-xs bg-green-600 hover:bg-green-700"
                             >
                               <Check className="w-4 h-4 mr-1" />
                               Accept
                             </Button>
                             <Button
                               size="sm"
                               variant="destructive"
                               onClick={() => handleRejectOffer(order.id)}
                               className="text-xs"
                             >
                               <X className="w-4 h-4 mr-1" />
                               Reject
                             </Button>
                           </div>
                         );
                       } else if (order.status_enhanced === 'awaiting_install_booking') {
                         if (activeOffer) {
                           // Has active pending offer - show resend/release options
                           return (
                             <div className="flex gap-2">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleResendOffer(order.id)}
                                 className="text-xs"
                               >
                                 <RotateCcw className="w-4 h-4 mr-1" />
                                 Resend
                               </Button>
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleReleaseOffer(order.id)}
                                 className="text-xs"
                               >
                                 <XCircle className="w-4 h-4 mr-1" />
                                 Release
                               </Button>
                             </div>
                           );
                         } else {
                           // No active offer - show normal actions
                           return (
                              <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/admin/order/${order.id}`)}
                                    className="text-xs"
                                  >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View Job
                                </Button>
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
                                  {latestOffer ? 'Send New Offer' : 'Send Offer'}
                                </Button>
                              </div>
                           );
                         }
                        } else if (title === 'Date Rejected') {
                          // For Date Rejected - always show Smart Assign and working View Job link
                          return (
                            <div className="flex gap-2">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => navigate(`/admin/order/${order.id}`)}
                                 className="text-xs"
                               >
                                <Eye className="w-4 h-4 mr-1" />
                                View Job
                              </Button>
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
                          );
                        } else {
                          return (
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="text-xs"
                               onClick={() => navigate(`/admin/order/${order.id}`)}
                             >
                              <Eye className="w-4 h-4 mr-1" />
                              View Job
                            </Button>
                          );
                        }
                     })()}
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
            onOfferSent={() => {
              if (onUpdate) onUpdate();
              refetchOffers();
            }}
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

      {showAutoSchedule && showAutoScheduleModal && (
        <AutoScheduleReviewModal
          isOpen={showAutoScheduleModal}
          onClose={() => setShowAutoScheduleModal(false)}
          orders={orders.filter(order => order.status_enhanced === 'awaiting_install_booking')}
          engineers={engineers}
          onOffersSubmitted={() => {
            if (onUpdate) onUpdate();
            refetchOffers();
          }}
        />
      )}
    </div>
  );
}