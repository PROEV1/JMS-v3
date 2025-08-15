import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EnhancedJobStatusBadge, OrderStatusEnhanced } from "./EnhancedJobStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrderStatusManagerProps {
  orderId: string;
  currentStatus: OrderStatusEnhanced;
  manualOverride: boolean;
  manualNotes?: string;
  onUpdate: () => void;
}

export function OrderStatusManager({ 
  orderId, 
  currentStatus, 
  manualOverride,
  manualNotes,
  onUpdate 
}: OrderStatusManagerProps) {
  const { toast } = useToast();
  const [isManualOverride, setIsManualOverride] = useState(manualOverride);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusEnhanced>(currentStatus);
  const [notes, setNotes] = useState(manualNotes || '');
  const [isLoading, setIsLoading] = useState(false);

  const statusOptions: { value: OrderStatusEnhanced; label: string }[] = [
    { value: 'quote_accepted', label: 'Quote Accepted' },
    { value: 'awaiting_payment', label: 'Awaiting Payment' },
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'awaiting_agreement', label: 'Awaiting Agreement' },
    { value: 'agreement_signed', label: 'Agreement Signed' },
    { value: 'awaiting_install_booking', label: 'Awaiting Install Booking' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'install_completed_pending_qa', label: 'Install Completed (Pending QA)' },
    { value: 'completed', label: 'Completed' },
    { value: 'revisit_required', label: 'Revisit Required' },
    { value: 'awaiting_final_payment', label: 'Awaiting Final Payment' },
  ];

  const handleUpdateStatus = async () => {
    setIsLoading(true);
    try {
      const updates: any = {
        manual_status_override: isManualOverride,
        manual_status_notes: notes
      };

      if (isManualOverride) {
        updates.status_enhanced = selectedStatus;
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: isManualOverride 
          ? `Status manually set to ${selectedStatus}` 
          : "Automatic status calculation re-enabled",
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    isManualOverride !== manualOverride ||
    selectedStatus !== currentStatus ||
    notes !== (manualNotes || '');

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Job Status Management</h3>
            <p className="text-muted-foreground text-sm">
              Current status is calculated automatically based on order data
            </p>
          </div>
          <EnhancedJobStatusBadge 
            status={currentStatus} 
            manualOverride={manualOverride}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch 
            id="manual-override"
            checked={isManualOverride}
            onCheckedChange={setIsManualOverride}
          />
          <Label htmlFor="manual-override">Manual Status Override</Label>
        </div>

        {isManualOverride && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="status-select">Override Status</Label>
              <Select 
                value={selectedStatus} 
                onValueChange={(value) => setSelectedStatus(value as OrderStatusEnhanced)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-notes">Override Notes</Label>
              <Textarea
                id="status-notes"
                placeholder="Explain why you're overriding the automatic status..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {hasChanges && (
          <Button 
            onClick={handleUpdateStatus}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Updating..." : "Update Status"}
          </Button>
        )}
      </div>
    </Card>
  );
}