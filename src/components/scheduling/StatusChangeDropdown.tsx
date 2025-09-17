import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Order {
  id: string;
  status_enhanced?: string;
  engineer_id?: string | null;
  scheduled_install_date?: string | null;
}

interface StatusChangeDropdownProps {
  order: Order;
  onStatusChanged?: () => void;
}

// Define which statuses can be changed and their display names
const STATUS_OPTIONS = [
  { value: 'awaiting_install_booking', label: 'Needs Scheduling' },
  { value: 'on_hold_parts_docs', label: 'On Hold - Parts/Docs' },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'awaiting_agreement', label: 'Awaiting Agreement' },
  { value: 'awaiting_survey_submission', label: 'Awaiting Survey' },
  { value: 'awaiting_survey_review', label: 'Survey Under Review' },
  { value: 'survey_rework_requested', label: 'Survey Rework Needed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export function StatusChangeDropdown({ order, onStatusChanged }: StatusChangeDropdownProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Check if this order can have its status changed
  const canChangeStatus = () => {
    // Don't allow status changes for orders that are:
    // - Already scheduled/assigned to an engineer
    // - Currently in progress or completed
    // - Have active offers that would conflict
    const blockedStatuses = [
      'scheduled', 
      'in_progress', 
      'install_completed_pending_qa', 
      'completed',
      'date_offered', // Has active offer
      'date_accepted' // Has accepted offer
    ];
    
    return !blockedStatuses.includes(order.status_enhanced || '') && 
           !order.engineer_id && // Not assigned to engineer
           !order.scheduled_install_date; // Not scheduled yet
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order.id || isChanging) return;

    setIsChanging(true);
    
    try {
      const { error } = await supabase.rpc('admin_set_order_status', {
        p_order_id: order.id,
        p_status: newStatus as any,
        p_reason: `Status changed from ${order.status_enhanced} to ${newStatus} via admin dropdown`
      });

      if (error) {
        console.error('❌ Status change error:', error);
        toast.error('Failed to change status: ' + error.message);
        return;
      }

      const statusLabel = STATUS_OPTIONS.find(opt => opt.value === newStatus)?.label || newStatus;
      toast.success(`Status changed to: ${statusLabel}`);
      
      if (onStatusChanged) {
        onStatusChanged();
      }
      
      // Dispatch refresh event to update other components
      window.dispatchEvent(new CustomEvent('scheduling:refresh'));
      
    } catch (error) {
      console.error('❌ Status change error:', error);
      toast.error('Failed to change status');
    } finally {
      setIsChanging(false);
      setSelectedStatus('');
    }
  };

  if (!canChangeStatus()) {
    return null;
  }

  // Get current status label for display
  const currentStatusLabel = STATUS_OPTIONS.find(opt => opt.value === order.status_enhanced)?.label 
    || order.status_enhanced || 'Unknown';

  return (
    <Select
      value={selectedStatus}
      onValueChange={setSelectedStatus}
      disabled={isChanging}
    >
      <SelectTrigger className="w-36 h-8 text-xs">
        <SelectValue placeholder="Change Status" />
        <ChevronDown className="h-3 w-3" />
      </SelectTrigger>
      <SelectContent className="z-50">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
          Current: {currentStatusLabel}
        </div>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-xs cursor-pointer"
            disabled={option.value === order.status_enhanced}
            onSelect={() => {
              if (option.value !== order.status_enhanced) {
                handleStatusChange(option.value);
              }
            }}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}