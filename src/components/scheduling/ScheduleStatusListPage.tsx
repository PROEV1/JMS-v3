import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, Send, Wrench, User, Calendar as CalendarIcon, MapPin, RotateCcw, XCircle, Calendar, Check, X, Eye, Filter, ArrowUpDown, Clock } from 'lucide-react';
import { Order, Engineer, getOrderEstimatedHours } from '@/utils/schedulingUtils';
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
  
  // New state for improved UI
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');
  const [valueFilter, setValueFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [compactView, setCompactView] = useState(false);
  
  // Fetch all job offers for the displayed orders
  const { offers, refetch: refetchOffers, releaseOffer, resendOffer } = useJobOffers();

  // Enhanced filtering logic
  const filteredAndSortedOrders = (() => {
    let filtered = orders.filter(order => {
      // Text search
      const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Job type filter
      const matchesJobType = jobTypeFilter === 'all' || order.job_type === jobTypeFilter;
      
      // Value filter
      const orderValue = order.total_amount || 0;
      const matchesValue = valueFilter === 'all' || 
        (valueFilter === 'high' && orderValue > 300) ||
        (valueFilter === 'low' && orderValue <= 300);
      
      // Urgency filter (date within 3 days)
      const isUrgent = order.scheduled_install_date && 
        new Date(order.scheduled_install_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const matchesUrgency = urgencyFilter === 'all' || 
        (urgencyFilter === 'urgent' && isUrgent) ||
        (urgencyFilter === 'normal' && !isUrgent);
      
      return matchesSearch && matchesJobType && matchesValue && matchesUrgency;
    });

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return (b.total_amount || 0) - (a.total_amount || 0);
        case 'postcode':
          return (getBestPostcode(a) || '').localeCompare(getBestPostcode(b) || '');
        case 'date':
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });

    return filtered;
  })();

  // Helper functions for status chips
  const getJobStatusChip = (order: Order) => {
    const status = order.status_enhanced;
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let text = status;

    switch (status) {
      case 'awaiting_install_booking':
        variant = "destructive";
        text = "Needs Scheduling";
        break;
      case 'scheduled':
        variant = "default";
        text = "Scheduled";
        break;
      case 'in_progress':
        variant = "secondary";
        text = "In Progress";
        break;
      case 'completed':
        variant = "default";
        text = "Completed";
        break;
    }

    return <Badge variant={variant} className="text-xs">{text}</Badge>;
  };

  const getAssignmentChip = (order: Order) => {
    const hasEngineer = order.engineer_id;
    return (
      <Badge variant={hasEngineer ? "default" : "destructive"} className="text-xs">
        {hasEngineer ? "Assigned" : "Unassigned"}
      </Badge>
    );
  };

  const getOffersChip = (orderId: string) => {
    const activeOffers = offers.filter(offer => 
      offer.order_id === orderId && 
      offer.status === 'pending' && 
      new Date(offer.expires_at) > new Date()
    );
    const totalOffers = offers.filter(offer => offer.order_id === orderId);
    
    if (activeOffers.length > 0) {
      return <Badge variant="default" className="text-xs">{activeOffers.length} Active</Badge>;
    } else if (totalOffers.length > 0) {
      return <Badge variant="outline" className="text-xs">{totalOffers.length} Offer{totalOffers.length !== 1 ? 's' : ''}</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs">No Offers</Badge>;
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
            {filteredAndSortedOrders.length} job{filteredAndSortedOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Compact View Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="compact-mode"
              checked={compactView}
              onCheckedChange={setCompactView}
            />
            <Label htmlFor="compact-mode" className="text-sm">Compact</Label>
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
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by order number, client name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="installation">Installation</SelectItem>
              <SelectItem value="service_call">Service Call</SelectItem>
              <SelectItem value="assessment">Assessment</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={valueFilter} onValueChange={setValueFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Values</SelectItem>
              <SelectItem value="high">High (£300+)</SelectItem>
              <SelectItem value="low">Lower (£300-)</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="urgent">Urgent (3 days)</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 ml-4">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Sort:</span>
          </div>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="value">Value</SelectItem>
              <SelectItem value="postcode">Postcode</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="space-y-3">
        {filteredAndSortedOrders.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No jobs found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria.' : 'No jobs match the current filters.'}
              </p>
            </div>
          </Card>
        ) : (
          filteredAndSortedOrders.map((order, index) => {
            const isEven = index % 2 === 0;
            return (
              <Card 
                key={order.id} 
                className={`transition-all hover:shadow-md ${
                  isEven ? 'bg-background' : 'bg-muted/30'
                } ${compactView ? 'p-4' : 'p-6'}`}
              >
                <CardContent className={`${compactView ? 'p-0' : 'p-0'} space-y-4`}>
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      {/* Primary Title */}
                      <h3 className="font-bold text-lg">
                        {order.job_type && (
                          <span className="capitalize">
                            {order.job_type.replace('_', ' ')} –{' '}
                          </span>
                        )}
                        {order.order_number}
                      </h3>
                      
                      {/* Status Chips */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {getJobStatusChip(order)}
                        {getAssignmentChip(order)}
                        {getOffersChip(order.id)}
                      </div>
                      
                      {/* Key Info Line */}
                      <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {order.client?.full_name || 'Unknown Client'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {getBestPostcode(order) || 'N/A'}
                        </span>
                        <span className="font-medium text-foreground">
                          £{order.total_amount ? Number(order.total_amount).toLocaleString() : '0'}
                        </span>
                        {order.created_at && (
                          <span>
                            {new Date(order.created_at).toLocaleDateString('en-GB')}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Clock className="w-3 h-3" />
                          Duration: {getOrderEstimatedHours(order)}h
                        </span>
                      </div>
                      
                      {/* Secondary Info */}
                      {!compactView && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {order.engineer_id && (
                            <div>
                              Assigned: {engineers.find(e => e.id === order.engineer_id)?.name || 'Unknown Engineer'}
                              {order.scheduled_install_date && (
                                <span className="ml-2">
                                  • Scheduled: {new Date(order.scheduled_install_date).toLocaleDateString('en-GB')}
                                </span>
                              )}
                            </div>
                          )}
                          {(() => {
                            const latestOffer = getLatestOfferForOrder(order.id);
                            return latestOffer && (
                              <div className="flex items-center gap-2">
                                <span>Latest Offer:</span>
                                <OfferStatusBadge offer={latestOffer} showTimeRemaining />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const activeOffer = getActiveOfferForOrder(order.id);
                        const latestOffer = getLatestOfferForOrder(order.id);
                        
                        if (title === 'Ready to Book') {
                          return (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleConfirmAndSchedule(order.id)}
                                className="flex items-center gap-1"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Schedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelAndRestart(order.id)}
                                className="flex items-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancel
                              </Button>
                            </>
                          );
                        } else if (activeOffer && title === 'Date Offered') {
                          return (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAcceptOffer(order.id)}
                                className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                              >
                                <Check className="w-4 h-4" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectOffer(order.id)}
                                className="flex items-center gap-1"
                              >
                                <X className="w-4 h-4" />
                                Reject
                              </Button>
                            </>
                          );
                        } else if (order.status_enhanced === 'awaiting_install_booking') {
                          if (activeOffer) {
                            return (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendOffer(order.id)}
                                  className="flex items-center gap-1"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  Resend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReleaseOffer(order.id)}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Release
                                </Button>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/admin/order/${order.id}`)}
                                  className="flex items-center gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Job
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSmartAssign(order)}
                                  className="flex items-center gap-1"
                                >
                                  <Wrench className="w-4 h-4" />
                                  Smart Assign
                                </Button>
                              </>
                            );
                          }
                        } else if (title === 'Date Rejected') {
                          return (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/admin/order/${order.id}`)}
                                className="flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4" />
                                View Job
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSmartAssign(order)}
                                className="flex items-center gap-1"
                              >
                                <Wrench className="w-4 h-4" />
                                Smart Assign
                              </Button>
                            </>
                          );
                        } else {
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/order/${order.id}`)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              View Job
                            </Button>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
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