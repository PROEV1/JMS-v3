import { OrderSection } from "../OrderSectionLayout";
import { UnifiedInstallationForm } from "../UnifiedInstallationForm";
import { EngineerStatusBadge } from "../EngineerStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Check, Copy, Calendar, User, Clock, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  engineer_id: string | null;
  scheduled_install_date: string | null;
  time_window: string | null;
  estimated_duration_hours: number | null;
  internal_install_notes: string | null;
  job_address: string | null;
  amount_paid: number;
  total_amount: number;
  agreement_signed_at: string | null;
  order_number: string;
  engineer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface InstallationManagementSectionProps {
  order: Order;
  onUpdate: () => void;
  paymentRequired?: boolean;
  agreementRequired?: boolean;
}

export function InstallationManagementSection({ 
  order, 
  onUpdate,
  paymentRequired = true,
  agreementRequired = true
}: InstallationManagementSectionProps) {
  const [acceptedOffer, setAcceptedOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const paymentReceived = order.amount_paid >= order.total_amount;
  const agreementSigned = !!order.agreement_signed_at;
  const isScheduled = order.scheduled_install_date && order.engineer;

  // Fetch accepted offer details
  useEffect(() => {
    const fetchAcceptedOffer = async () => {
      try {
        const { data, error } = await supabase
          .from('job_offers')
          .select(`
            *,
            engineer:engineer_id (
              id,
              name,
              email
            )
          `)
          .eq('order_id', order.id)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setAcceptedOffer(data);
      } catch (error) {
        console.error('Error fetching accepted offer:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAcceptedOffer();
  }, [order.id]);

  const handleCopyDetails = () => {
    if (!acceptedOffer) return;
    
    const details = `Engineer: ${acceptedOffer.engineer?.name || 'Unknown'}
Date: ${new Date(acceptedOffer.offered_date).toLocaleDateString('en-GB')}
Time: ${acceptedOffer.time_window || 'All Day'}
Order: ${order.order_number}`;
    
    navigator.clipboard.writeText(details);
    toast.success('Details copied to clipboard');
  };

  const handleScheduleWithAcceptedDate = async () => {
    if (!acceptedOffer) return;
    
    try {
      // Normalize the offered_date to noon UTC to avoid timezone issues
      const originalDate = acceptedOffer.offered_date.slice(0, 10); // Get YYYY-MM-DD
      const utcDate = new Date(originalDate + 'T12:00:00.000Z');
      
      console.log('InstallationManagementSection: Scheduling with accepted date as noon UTC:', {
        originalOfferedDate: acceptedOffer.offered_date,
        normalizedDate: originalDate,
        utcDate: utcDate.toISOString(),
        localDisplay: utcDate.toLocaleDateString()
      });
      
      const { error } = await supabase
        .from('orders')
        .update({
          engineer_id: acceptedOffer.engineer_id,
          scheduled_install_date: utcDate.toISOString(),
          time_window: acceptedOffer.time_window
        })
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success('Order scheduled with accepted date');
      onUpdate();
    } catch (error) {
      console.error('Error scheduling with accepted date:', error);
      toast.error('Failed to schedule with accepted date');
    }
  };

  return (
    <OrderSection 
      id="installation" 
      title="Installation Management" 
      icon={Wrench} 
      defaultOpen={!isScheduled}
    >
      <div className="space-y-4">
        {/* Accepted Offer Info Panel */}
        {!loading && acceptedOffer && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <h4 className="font-medium text-green-800">Client Accepted Offer</h4>
                    <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                      Ready for JMS Booking
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{acceptedOffer.engineer?.name || 'Unknown Engineer'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {new Date(acceptedOffer.offered_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric'
                        })}
                      </span>
                      {new Date(acceptedOffer.offered_date) < new Date() && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          Past Date
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{acceptedOffer.time_window || 'All Day'}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Accepted {acceptedOffer.accepted_at ? new Date(acceptedOffer.accepted_at).toLocaleString('en-GB') : 'recently'} via client link
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyDetails}
                    className="text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Details
                  </Button>
                  
                  {!isScheduled && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleScheduleWithAcceptedDate}
                      className="text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Schedule with Accepted Date
                    </Button>
                  )}
                </div>
              </div>
              
              {new Date(acceptedOffer.offered_date) < new Date() && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Warning: The accepted date has passed. Consider rescheduling or contacting the client.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        <UnifiedInstallationForm
          orderId={order.id}
          currentEngineerId={order.engineer_id}
          currentInstallDate={order.scheduled_install_date}
          timeWindow={order.time_window}
          estimatedDuration={order.estimated_duration_hours}
          internalNotes={order.internal_install_notes}
          jobAddress={order.job_address}
          engineer={order.engineer}
          paymentReceived={paymentReceived}
          agreementSigned={agreementSigned}
          paymentRequired={paymentRequired}
          agreementRequired={agreementRequired}
          onUpdate={onUpdate}
        />
      </div>
    </OrderSection>
  );
}