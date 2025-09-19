
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ExternalLink, 
  Calendar, 
  MapPin, 
  Quote, 
  Undo2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QuoteMetadataPanel } from '@/components/quote/QuoteMetadataPanel';

interface PartnerQuoteDrawerProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    address: string;
    job_type: 'installation' | 'assessment' | 'service_call';
    partner_status: string;
    partner_job_id: string;
    partner_external_id: string;
    created_at: string;
    partner_id: string;
    postcode: string;
    total_amount: number;
    latest_quote?: {
      id: string;
      amount: number;
      currency: string;
      status: 'submitted' | 'approved' | 'rejected' | 'rework' | 'withdrawn';
      submitted_at: string;
      decision_at?: string;
      file_url?: string;
      notes?: string;
      decision_notes?: string;
    };
    sla_hours?: number;
    require_file?: boolean;
    quote_override?: {
      id: string;
      override_type: 'quoted_pending_approval' | 'standard_quote_marked';
      notes?: string;
      created_at: string;
    };
    client: {
      full_name: string;
      email: string;
      postcode?: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteUpdated: () => void;
  partnerName: string;
  onMarkAsQuoted: (job: any, quoteType: 'custom' | 'standard') => void;
  onClearOverride: (job: any) => void;
}

export function PartnerQuoteDrawer({ 
  job, 
  open, 
  onOpenChange, 
  onQuoteUpdated, 
  partnerName,
  onMarkAsQuoted,
  onClearOverride
}: PartnerQuoteDrawerProps) {
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [clientCollapsed, setClientCollapsed] = useState(true);

  // Fetch order data when drawer opens
  useEffect(() => {
    if (open && job.id) {
      fetchOrderData();
    }
  }, [open, job.id]);

  const fetchOrderData = async () => {
    setLoadingOrder(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', job.id)
        .maybeSingle();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order data:', error);
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleSaveOrderMetadata = async (metadata: any) => {
    if (!order) {
      toast({
        title: "Error",
        description: "No order data available",
        variant: "destructive",
      });
      return;
    }
    
    console.log('🔧 Saving order metadata:', metadata);
    console.log('🔧 Order ID:', order.id);
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(metadata)
        .eq('id', order.id)
        .select();

      console.log('🔧 Update response:', { data, error });

      if (error) {
        console.error('🚨 Database error:', error);
        toast({
          title: "Error saving metadata",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
      
      toast({
        title: "Success",
        description: "Quote metadata saved successfully",
      });
      
      // Refresh order data
      await fetchOrderData();
      onQuoteUpdated();
    } catch (error) {
      console.error('🚨 Error saving order metadata:', error);
      toast({
        title: "Error",
        description: "Failed to save metadata. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleSendQuote = async () => {
    if (!order) return;
    
    try {
      // For partner orders, we could update a status or create a quote record
      // For now, just mark as quoted in the order status
      const { error } = await supabase
        .from('orders')
        .update({ 
          quote_type: order.quote_type || 'standard'
        })
        .eq('id', order.id);

      if (error) throw error;
      
      // Refresh order data
      await fetchOrderData();
      onQuoteUpdated();
    } catch (error) {
      console.error('Error sending quote:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string, override?: any) => {
    // Show override status if present
    if (override) {
      if (override.override_type === 'quoted_pending_approval') {
        return 'bg-blue-100 text-blue-800';
      }
      if (override.override_type === 'standard_quote_marked') {
        return 'bg-green-100 text-green-800';
      }
    }

    switch (status) {
      case 'AWAITING_QUOTATION': return 'bg-orange-100 text-orange-800';
      case 'WAITING_FOR_APPROVAL': 
      case 'WAITING_FOR_OHME_APPROVAL': return 'bg-blue-100 text-blue-800';
      case 'AWAITING_INSTALL_DATE':
      case 'INSTALL_DATE_CONFIRMED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'REWORK_REQUESTED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string, override?: any) => {
    // Show override status if present
    if (override) {
      if (override.override_type === 'quoted_pending_approval') {
        return 'Custom Quote (Manual)';
      }
      if (override.override_type === 'standard_quote_marked') {
        return 'Standard Quote (Manual)';
      }
    }

    switch (status) {
      case 'AWAITING_QUOTATION': return 'Awaiting Quotation';
      case 'WAITING_FOR_APPROVAL': return 'Waiting for Approval';
      case 'WAITING_FOR_OHME_APPROVAL': return 'Waiting for Ohme Approval';
      case 'AWAITING_INSTALL_DATE': return 'Awaiting Install Date';
      case 'INSTALL_DATE_CONFIRMED': return 'Install Date Confirmed';
      case 'REJECTED': return 'Quote Rejected';
      case 'REWORK_REQUESTED': return 'Rework Required';
      default: return status;
    }
  };

  const handleOpenInPartner = () => {
    const partnerUrl = `https://connect.ohme-ev.com/en/jobs/job/${job.partner_job_id}`;
    window.open(partnerUrl, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Job Details</SheetTitle>
            <Badge className={getStatusColor(job.partner_status, job.quote_override)}>
              {getStatusLabel(job.partner_status, job.quote_override)}
            </Badge>
          </div>
          <SheetDescription>{job.order_number} • {partnerName}</SheetDescription>
          
          {/* Open in Partner System - Always visible at top */}
          <Button
            className="w-full mt-3"
            onClick={handleOpenInPartner}
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Partner System
          </Button>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {job.quote_override && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  <p>Override created: {format(new Date(job.quote_override.created_at), 'PPp')}</p>
                  {job.quote_override.notes && (
                    <p className="mt-1">Notes: {job.quote_override.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collapsible Client Information */}
          <Card>
            <CardHeader 
              className="cursor-pointer" 
              onClick={() => setClientCollapsed(!clientCollapsed)}
            >
              <CardTitle className="flex items-center justify-between">
                <span>Client Information</span>
                {clientCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
            {!clientCollapsed && (
              <CardContent className="max-h-60 overflow-y-auto scroll-smooth">
                <div className="space-y-3 pr-2">
                  <div className="font-medium text-base">{job.client.full_name}</div>
                  <div className="text-sm text-muted-foreground">{job.client.email}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{job.client.postcode || job.postcode}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Job Type:</span> <span className="capitalize">{job.job_type.replace('_', ' ')}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Value:</span> <span className="font-mono">£{job.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Created: {format(new Date(job.created_at), 'PPp')}</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Quote Configuration */}
          {order && (
            <QuoteMetadataPanel
              quoteId={order.id}
              initialData={{
                quote_type: order.quote_type,
                part_required: order.part_required || false,
                groundworks_required: order.groundworks_required || false,
                multiple_engineers_required: order.multiple_engineers_required || false,
                specific_engineer_required: order.specific_engineer_required || false,
                specific_engineer_id: order.specific_engineer_id,
                expected_duration_days: order.expected_duration_days,
                charger_model_id: order.charger_model_id,
                partner_id: order.partner_id
              }}
              onSave={handleSaveOrderMetadata}
              onSendQuote={handleSendQuote}
              isReadOnly={false}
              isSaving={false}
              isSending={false}
            />
          )}

          {/* Actions - Only show Clear Override if override exists */}
          {job.quote_override && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onClearOverride(job)}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Clear Override
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
