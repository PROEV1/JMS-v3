import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Send, Wrench, User, Calendar as CalendarIcon, MapPin, RotateCcw, XCircle, Calendar, Check, X, Eye, Filter, ArrowUpDown, Clock, Bot, Grid, List, MoreHorizontal } from 'lucide-react';
import { Order, Engineer, getOrderEstimatedHours, isDefaultEstimatedHours } from '@/utils/schedulingUtils';
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
  
  // DEBUGGING: Log props to console
  console.log('ScheduleStatusListPage props:', { 
    ordersCount: orders?.length, 
    engineersCount: engineers?.length, 
    title,
    orders: orders?.slice(0, 2) // First 2 orders for debugging
  });
  
  // Fetch all job offers for the displayed orders
  const { offers, refetch: refetchOffers, releaseOffer, resendOffer } = useJobOffers();

  // Enhanced filtering logic with null safety
  const filteredAndSortedOrders = (() => {
    console.log('Starting filtering with orders:', orders?.length);
    
    if (!orders || !Array.isArray(orders)) {
      console.warn('Orders is not an array:', orders);
      return [];
    }
    
    let filtered = orders.filter(order => {
      // CRITICAL: Filter out null/undefined orders first
      if (!order || !order.id) {
        console.warn('Found null/undefined order, filtering out:', order);
        return false;
      }
      
      // Text search with null safety
      const matchesSearch = (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.client?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.client?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
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

    console.log('After filtering:', filtered?.length);

    // Sorting with null safety
    filtered.sort((a, b) => {
      try {
        switch (sortBy) {
          case 'value':
            return (b.total_amount || 0) - (a.total_amount || 0);
          case 'postcode':
            const postcodeA = getBestPostcode(a) || '';
            const postcodeB = getBestPostcode(b) || '';
            return postcodeA.localeCompare(postcodeB);
          case 'date':
          default:
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
        }
      } catch (error) {
        console.error('Error during sorting:', error);
        return 0;
      }
    });

    console.log('Final filtered and sorted orders:', filtered?.length);
    return filtered;
  })();

  // Helper functions for status chips
  const getJobStatusChip = (order: Order) => {
    const status = order.status_enhanced;
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let text = status;

    // Check if order has accepted offer to show "Ready to Book"
    const acceptedOffer = offers.find(offer => 
      offer.order_id === order.id && offer.status === 'accepted'
    );

    switch (status) {
      case 'needs_quote_acceptance':
        variant = "outline";
        text = "Needs Quote Acceptance";
        break;
      case 'awaiting_payment':
        variant = "destructive";
        text = "Awaiting Payment";
        break;
      case 'awaiting_agreement':
        variant = "destructive";
        text = "Awaiting Agreement";
        break;
      case 'needs_scheduling':
      case 'awaiting_install_booking':
        variant = "destructive";
        // If there's an accepted offer, show "Ready to Book", otherwise "Needs Scheduling"
        text = acceptedOffer ? "Ready to Book" : "Needs Scheduling";
        break;
      case 'date_offered':
        variant = "outline";
        text = "Date Offered";
        break;
      case 'date_accepted':
        variant = "default";
        text = "Ready to Book";
        break;
      case 'date_rejected':
        variant = "destructive";
        text = "Date Rejected";
        break;
      case 'offer_expired':
        variant = "destructive";
        text = "Offer Expired";
        break;
      case 'scheduled':
        variant = "default";
        text = "Scheduled";
        break;
      case 'in_progress':
        variant = "secondary";
        text = "In Progress";
        break;
      case 'install_completed_pending_qa':
        variant = "outline";
        text = "Pending QA";
        break;
      case 'completed':
        variant = "default";
        text = "Completed";
        break;
      default:
        variant = "secondary";
        text = status || "Unknown";
        break;
    }

    return { label: text, variant };
  };

  const getAssignmentChip = (order: Order) => {
    const hasEngineer = order.engineer_id;
    return {
      label: hasEngineer ? "Assigned" : "Unassigned",
      variant: (hasEngineer ? "default" : "destructive") as "default" | "secondary" | "destructive" | "outline"
    };
  };

  const getOffersChip = (order: Order) => {
    const orderId = order.id;
    const activeOffers = offers.filter(offer => 
      offer.order_id === orderId && 
      offer.status === 'pending' && 
      new Date(offer.expires_at) > new Date()
    );
    const totalOffers = offers.filter(offer => offer.order_id === orderId);
    
    return {
      label: activeOffers.length > 0 
        ? `${activeOffers.length} Active` 
        : totalOffers.length > 0 
          ? `${totalOffers.length} Offer${totalOffers.length !== 1 ? 's' : ''}` 
          : 'No Offers',
      variant: (activeOffers.length > 0 ? "default" : totalOffers.length > 0 ? "outline" : "secondary") as "default" | "secondary" | "destructive" | "outline"
    };
  };

  const handleSendOffer = (order: Order) => {
    setSelectedOrder(order);
    setShowSendOffer(true);
  };

  const handleSmartAssign = (order: Order) => {
    setSelectedOrder(order);
    setShowSmartAssign(true);
  };

  // Helper function to calculate time remaining until expiry (nearest hour)
  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Expired';
    }
    
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      return '< 1h';
    } else if (diffHours === 1) {
      return '1 hour';
    } else if (diffHours < 24) {
      return `${diffHours} hours`;
    } else {
      const days = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      if (remainingHours === 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
      }
      return `${days}d ${remainingHours}h`;
    }
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

  // Helper function to get accepted offer details for display
  const getAcceptedOfferDetails = (orderId: string) => {
    const acceptedOffer = offers.find(offer => 
      offer.order_id === orderId && offer.status === 'accepted'
    );
    
    if (!acceptedOffer) return null;
    
    const engineer = engineers.find(e => e.id === acceptedOffer.engineer_id);
    const offerDate = new Date(acceptedOffer.offered_date);
    const formattedDate = offerDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const isPastDate = offerDate < new Date();
    
    return {
      engineerName: engineer?.name || 'Unknown Engineer',
      date: formattedDate,
      timeWindow: acceptedOffer.time_window || 'All Day',
      isPastDate,
      acceptedAt: acceptedOffer.accepted_at
    };
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

        if (error) {
          console.error('Function invocation error:', error);
          throw new Error('Failed to send offer');
        }

        if (data?.error) {
          // Handle specific error types from send-offer function
          if (data.error === 'engineer_not_available') {
            const engineerName = engineers.find(e => e.id === engineerId)?.name || 'Engineer';
            const availableDays = data.details?.available_days?.join(', ') || 'weekdays';
            throw new Error(`${engineerName} is not available on ${data.details?.requested_day}. Available days: ${availableDays}`);
          } else if (data.message && data.message.includes('at capacity')) {
            throw new Error('Engineer is at capacity on this date. Please choose a different date or engineer.');
          } else if (data.message && data.message.includes('exceed working hours')) {
            throw new Error('This booking would exceed the engineer\'s working hours. Please choose a different date or engineer.');
          } else {
            throw new Error(data.message || data.error || 'Failed to send offer');
          }
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
      
      // Handle specific error types more gracefully
      if (error.message && error.message.includes('not available on')) {
        toast.error(error.message);
      } else if (error.message && error.message.includes('at capacity')) {
        toast.error(error.message);
      } else if (error.message && error.message.includes('exceed working hours')) {
        toast.error(error.message);
      } else {
        toast.error(error.message || 'Failed to process assignment');
      }
    }
  };

  // Main render with error boundary and debugging
  console.log('About to render ScheduleStatusListPage with', filteredAndSortedOrders.length, 'orders');
  
  try {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">
              {filteredAndSortedOrders.length} job{filteredAndSortedOrders.length !== 1 ? 's' : ''} | DEBUG: Original count: {orders?.length || 0}
            </p>
          </div>
        
        <div className="flex items-center gap-3">
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

      {/* Jobs List with Column Headers and Hybrid Table-Card Layout */}
      <div className="space-y-3">
        {/* Column Headers - Desktop Only */}
        <div className="hidden lg:grid lg:grid-cols-10 gap-4 px-4 py-3 text-sm font-medium text-muted-foreground bg-muted/30 border-b rounded-t-lg">
          <div className="col-span-2">Job ID</div>
          <div className="col-span-2">Client</div>
          <div className="col-span-1">Value</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Created</div>
          <div className="col-span-2">Actions</div>
        </div>

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
          <div className="space-y-1">
            {filteredAndSortedOrders.map((order, index) => {
              // CRITICAL: Additional null safety check before rendering
              if (!order || !order.id) {
                console.warn('Skipping render for null/undefined order at index:', index);
                return null;
              }
              
              const isEven = index % 2 === 0;
              const jobStatus = getJobStatusChip(order);
              const assignmentStatus = getAssignmentChip(order);
              const offersStatus = getOffersChip(order);
              
              return (
                <Card 
                  key={order.id} 
                  className={`transition-all hover:shadow-lg border border-border/50 ${
                    isEven ? 'bg-background' : 'bg-muted/20'
                  } py-2`}
                >
                  <CardContent className="px-4 py-2">
                    {/* Desktop Layout - Table-like Grid */}
                    <div className="hidden lg:grid lg:grid-cols-10 gap-4 items-center">
                      {/* Job ID */}
                      <div className="col-span-2">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-foreground capitalize">
                            {order.job_type?.replace('_', ' ') || 'Installation'}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {order.order_number}
                          </div>
                        </div>
                      </div>

                      {/* Client with Postcode and Duration */}
                      <div className="col-span-2">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-foreground">
                            {order.client?.full_name || 'Unknown Client'}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {getBestPostcode(order) || 'No postcode'} • <span className={`${isDefaultEstimatedHours(order) ? 'text-amber-600' : 'text-green-600'}`}>
                              {getOrderEstimatedHours(order)}h
                            </span>
                            {isDefaultEstimatedHours(order) && (
                              <Badge variant="outline" className="ml-1 text-xs px-1 py-0 text-amber-600 border-amber-300">
                                Default
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Value */}
                      <div className="col-span-1">
                        {order.total_amount ? (
                          <span className="text-sm text-green-600 font-medium">
                            £{order.total_amount}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>

                        {/* Status - Horizontal Badges */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1 flex-wrap">
                             <Badge 
                               variant={getJobStatusChip(order).variant} 
                               className="text-xs px-2 py-1 bg-slate-100 text-slate-600 border-slate-200"
                             >
                               {getJobStatusChip(order).label}
                             </Badge>
                             {order.is_partner_job && (
                               <Badge variant="outline" className={`text-xs px-1 py-0 ${order.partner_status ? 'border-blue-300 text-blue-600' : 'border-blue-300 text-blue-600'}`}>
                                 {order.partner_status ? `Partner: ${order.partner_status}` : 'Partner'}
                               </Badge>
                             )}
                            <Badge variant="outline" className="text-xs px-2 py-1 border-slate-300 text-slate-600">
                              {getOffersChip(order).label}
                            </Badge>
                          </div>
                          
                          {/* Show accepted offer details if available */}
                          {(() => {
                            const acceptedDetails = getAcceptedOfferDetails(order.id);
                            if (acceptedDetails) {
                              return (
                                <div className={`text-xs mt-1 flex items-center gap-1 ${acceptedDetails.isPastDate ? 'text-amber-600' : 'text-green-600'}`}>
                                  <Check className="w-3 h-3" />
                                  <span>
                                    Accepted: {acceptedDetails.engineerName} on {acceptedDetails.date} ({acceptedDetails.timeWindow})
                                  </span>
                                  {acceptedDetails.isPastDate && (
                                    <Badge variant="outline" className="ml-1 text-xs px-1 py-0 text-amber-600 border-amber-300">
                                      Past Date
                                    </Badge>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                         </div>

                       {/* Created */}
                      <div className="col-span-1">
                        <span className="text-sm text-muted-foreground">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
                        </span>
                      </div>

                      {/* Actions - Right Aligned */}
                      <div className="col-span-2">
                        <div className="flex gap-2 justify-end">
                          {(() => {
                            // CRITICAL: Null safety check before accessing order.id
                            if (!order || !order.id) return null;
                            
                            const activeOffer = getActiveOfferForOrder(order.id);
                            const latestOffer = getLatestOfferForOrder(order.id);
                            
                             if (title === 'Ready to Book') {
                               return (
                                 <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => order?.id && handleConfirmAndSchedule(order.id)}
                                      className="text-xs px-3 py-1 h-7"
                                      disabled={!order?.id}
                                    >
                                      Confirm & Schedule
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => order?.id && handleCancelAndRestart(order.id)}
                                      className="text-xs px-3 py-1 h-7"
                                      disabled={!order?.id}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                      className="text-xs px-3 py-1 h-7"
                                      disabled={!order?.id}
                                    >
                                      View Job
                                    </Button>
                                 </div>
                               );
                             } else if (activeOffer && title === 'Date Offered') {
                               const timeRemaining = getTimeRemaining(activeOffer.expires_at);
                               return (
                                 <div className="flex flex-col gap-1 items-end">
                                   <div className="text-xs text-muted-foreground">
                                     Expires: {timeRemaining}
                                   </div>
                                   <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => order?.id && handleAcceptOffer(order.id)}
                                        className="text-xs px-3 py-1 h-7 bg-green-600 hover:bg-green-700"
                                        disabled={!order?.id}
                                      >
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => order?.id && handleRejectOffer(order.id)}
                                        className="text-xs px-3 py-1 h-7"
                                        disabled={!order?.id}
                                      >
                                        Reject
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                        className="text-xs px-3 py-1 h-7"
                                        disabled={!order?.id}
                                      >
                                        View Job
                                      </Button>
                                   </div>
                                 </div>
                               );
                             } else if (title === 'Date Rejected') {
                               return (
                                 <div className="flex gap-2">
                                    <Button
                                      onClick={() => order && handleSmartAssign(order)}
                                      size="sm"
                                      className="text-xs px-3 py-1 h-7"
                                      disabled={!order}
                                    >
                                      Smart Assign
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                      className="text-xs px-3 py-1 h-7"
                                      disabled={!order?.id}
                                    >
                                      View Job
                                    </Button>
                                 </div>
                               );
                            } else if (order.status_enhanced === 'awaiting_install_booking') {
                              if (activeOffer) {
                                return (
                                  <>
                                     <Button
                                       size="sm"
                                       variant="outline"
                                       onClick={() => order?.id && handleResendOffer(order.id)}
                                       className="text-xs px-3 py-1 h-7"
                                       disabled={!order?.id}
                                     >
                                       Resend
                                     </Button>
                                     <Button
                                       size="sm"
                                       variant="outline"
                                       onClick={() => order?.id && handleReleaseOffer(order.id)}
                                       className="text-xs px-3 py-1 h-7"
                                       disabled={!order?.id}
                                     >
                                       Release
                                     </Button>
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                     <Button
                                       onClick={() => order && handleSmartAssign(order)}
                                       size="sm"
                                       className="text-xs px-3 py-1 h-7"
                                       disabled={!order}
                                     >
                                       Smart Assign
                                     </Button>
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                       className="text-xs px-3 py-1 h-7"
                                       disabled={!order?.id}
                                     >
                                       View Job
                                     </Button>
                                  </>
                                );
                              }
                            } else {
                               return (
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                   className="text-xs px-3 py-1 h-7"
                                   disabled={!order?.id}
                                 >
                                   View Job
                                 </Button>
                               );
                            }
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Layout - Stacked */}
                    <div className="lg:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-foreground capitalize">
                            {order.job_type?.replace('_', ' ') || 'Installation'}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {order.order_number}
                          </div>
                        </div>
                         <div className="flex gap-1">
                            <Badge 
                              variant={getJobStatusChip(order).variant} 
                              className="text-xs px-2 py-1 bg-slate-100 text-slate-600 border-slate-200"
                            >
                              {getJobStatusChip(order).label}
                            </Badge>
                            {order.is_partner_job && (
                              <Badge variant="outline" className={`text-xs px-1 py-0 ${order.partner_status ? 'border-blue-300 text-blue-600' : 'border-blue-300 text-blue-600'}`}>
                                {order.partner_status ? `P: ${order.partner_status}` : 'Partner'}
                              </Badge>
                            )}
                         </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-foreground">
                              {order.client?.full_name || 'Unknown Client'}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {getBestPostcode(order) || 'No postcode'} • {getOrderEstimatedHours(order)}h{isDefaultEstimatedHours(order) && ' (Default)'}
                            </div>
                          </div>
                           <div className="flex gap-1">
                              <Badge 
                                variant={getJobStatusChip(order).variant} 
                                className="text-xs px-2 py-1 bg-slate-100 text-slate-600 border-slate-200"
                              >
                                {getJobStatusChip(order).label}
                              </Badge>
                              {order.is_partner_job && (
                                <Badge variant="outline" className={`text-xs px-1 py-0 ${order.partner_status ? 'border-blue-300 text-blue-600' : 'border-blue-300 text-blue-600'}`}>
                                  {order.partner_status ? `P: ${order.partner_status}` : 'Partner'}
                                </Badge>
                              )}
                             <Badge variant="outline" className="text-xs px-2 py-1 border-slate-300 text-slate-600">
                               {offersStatus.label}
                             </Badge>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'No date'}
                          </span>
                          {order.total_amount && (
                            <span className="text-green-600 font-medium">£{order.total_amount}</span>
                          )}
                        </div>

                        {order.job_address && (
                          <div className="text-xs text-muted-foreground">
                            {order.job_address}
                          </div>
                        )}
                      </div>

                        <div className="flex gap-2 pt-2 border-t">
                          {(() => {
                            // CRITICAL: Null safety check before accessing order.id
                            if (!order || !order.id) return null;
                            
                            const activeOffer = getActiveOfferForOrder(order.id);
                           
                           if (title === 'Ready to Book') {
                             return (
                               <>
                                  <Button
                                    size="sm"
                                    onClick={() => order?.id && handleConfirmAndSchedule(order.id)}
                                    className="flex-1 text-xs h-7"
                                    disabled={!order?.id}
                                  >
                                    Confirm & Schedule
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => order?.id && handleCancelAndRestart(order.id)}
                                    className="flex-1 text-xs h-7"
                                    disabled={!order?.id}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                    className="flex-1 text-xs h-7"
                                    disabled={!order?.id}
                                  >
                                    View Job
                                  </Button>
                               </>
                             );
                            } else if (activeOffer && title === 'Date Offered') {
                              const timeRemaining = getTimeRemaining(activeOffer.expires_at);
                              return (
                                <>
                                  <div className="w-full mb-2">
                                    <div className="text-xs text-muted-foreground text-center">
                                      Expires in: {timeRemaining}
                                    </div>
                                  </div>
                                    <Button
                                      onClick={() => order?.id && handleAcceptOffer(order.id)}
                                      size="sm"
                                      className="flex-1 text-xs h-7 bg-green-600 hover:bg-green-700"
                                      disabled={!order?.id}
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => order?.id && handleRejectOffer(order.id)}
                                      className="flex-1 text-xs h-7"
                                      disabled={!order?.id}
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                      className="flex-1 text-xs h-7"
                                      disabled={!order?.id}
                                    >
                                      View Job
                                    </Button>
                                </>
                              );
                            } else if (title === 'Date Rejected') {
                              return (
                                <>
                                  <Button
                                    onClick={() => order && handleSmartAssign(order)}
                                    size="sm"
                                    className="flex-1 text-xs h-7"
                                    disabled={!order}
                                  >
                                    Smart Assign
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                    className="flex-1 text-xs h-7"
                                    disabled={!order?.id}
                                  >
                                    View Job
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
                                      onClick={() => order?.id && handleResendOffer(order.id)}
                                      className="flex-1 text-xs h-7"
                                      disabled={!order?.id}
                                    >
                                      Resend
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => order?.id && handleReleaseOffer(order.id)}
                                      className="flex-1 text-xs h-7"
                                      disabled={!order?.id}
                                    >
                                      Release
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                      className="flex-1 text-xs h-7"
                                      disabled={!order?.id}
                                    >
                                      View Job
                                    </Button>
                                 </>
                               );
                             } else {
                               return (
                                 <>
                                    <Button
                                      onClick={() => order && handleSmartAssign(order)}
                                      size="sm"
                                      className="flex-1 text-xs h-7"
                                      disabled={!order}
                                    >
                                      Smart Assign
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                      className="flex-1 text-xs h-7"
                                      disabled={!order?.id}
                                    >
                                      View Job
                                    </Button>
                                 </>
                               );
                             }
                           } else {
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => order?.id && navigate(`/orders/${order.id}`)}
                                  className="w-full text-xs h-7"
                                  disabled={!order?.id}
                                >
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
          }
          </div>
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
  } catch (error) {
    console.error('Error rendering ScheduleStatusListPage:', error);
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800">Error Loading {title}</h3>
          <p className="text-red-600 mt-1">
            There was an error loading the job list. Check the console for details.
          </p>
          <p className="text-sm text-red-500 mt-2">
            Orders: {orders?.length || 0}, Engineers: {engineers?.length || 0}
          </p>
        </div>
      </div>
    );
  }
}